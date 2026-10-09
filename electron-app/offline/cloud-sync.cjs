'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');

const ORIGIN = 'https://axis.huvrs.chatgpt.site';
const COOKIE = 'axis_email_session';
const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 78 * 1024 ** 3;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const QUEUE_STATES = new Set(['waiting', 'queued', 'syncing', 'retry', 'paused', 'synced']);
const FILE_STATES = new Set(['queued', 'uploading', 'complete']);
const OUTPUT_EXTENSIONS = {archive:'zip',orthophoto:'tif',dsm:'tif',report:'pdf',stats:'json',quality:'json',delivery:'json'};

class SyncError extends Error {
  constructor(code, message, status = 0) { super(message); this.code = code; this.status = status; }
}
const problem = (code, message, status) => new SyncError(code, message, status);
function uuid(value) { return typeof value === 'string' && UUID.test(value); }
function safeText(value, length = 180) { return String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, length); }
function safeName(name, id, key) {
  const title = safeText(name, 110).replace(/[\\/:*?"<>|]/g, '_').replace(/[. ]+$/g, '') || 'Orthomosaic';
  return `${title}-${id.slice(0, 8)}-${key}.${OUTPUT_EXTENSIONS[key]}`;
}

async function atomicWrite(target, bytes) {
  const temporary = `${target}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fsp.open(temporary, 'wx', 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close(); handle = null;
    await fsp.rename(temporary, target);
    let directory;
    try { directory = await fsp.open(path.dirname(target), 'r'); await directory.sync(); }
    catch (error) { if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EISDIR', 'EINVAL', 'ENOTSUP'].includes(error.code)) throw error; }
    finally { if (directory) await directory.close(); }
  } finally {
    if (handle) await handle.close();
    await fsp.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function readBounded(file, maxBytes) {
  let handle;
  try {
    handle = await fsp.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw problem('storage', 'Saved cloud sync data is not a valid bounded file.');
    return await handle.readFile();
  } finally { if (handle) await handle.close(); }
}

function validateQueue(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.jobs) || data.jobs.length > 10000) throw problem('storage', 'Saved cloud sync queue is unreadable. Local output files are unchanged.');
  const seen = new Set();
  for (const row of data.jobs) {
    if (!row || !uuid(row.jobId) || !uuid(row.pilotId) || !uuid(row.missionId) || seen.has(row.jobId)
      || !QUEUE_STATES.has(row.state) || !Array.isArray(row.files) || row.files.length > Object.keys(OUTPUT_EXTENSIONS).length
      || !Number.isSafeInteger(row.failures) || row.failures < 0 || !Number.isFinite(row.nextAttemptAt)
      || typeof row.missionTitle !== 'string' || row.missionTitle.length > 200
      || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))
      || row.error !== null && typeof row.error !== 'string') throw problem('storage', 'Saved cloud sync queue is unreadable. Local output files are unchanged.');
    seen.add(row.jobId);
    const keys = new Set();
    for (const file of row.files) {
      if (!file || !Object.hasOwn(OUTPUT_EXTENSIONS,file.key) || keys.has(file.key) || !uuid(file.clientUploadId)
        || file.uploadId !== null && !uuid(file.uploadId) || !FILE_STATES.has(file.state)
        || typeof file.name !== 'string' || file.name.length > 180 || /[\\/\x00-\x1f]/.test(file.name)
        || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_FILE_BYTES
        || !Number.isFinite(file.mtimeMs) || !Number.isSafeInteger(file.attempt) || file.attempt < 0
        || file.chunkSize !== CHUNK_SIZE || file.partCount !== Math.ceil(file.size / CHUNK_SIZE)
        || !Array.isArray(file.parts) || file.parts.length > file.partCount) throw problem('storage', 'Saved upload state is unreadable. Local output files are unchanged.');
      keys.add(file.key);
      for (const [index, part] of file.parts.entries()) {
        if (!part || part.partNumber !== index + 1 || typeof part.etag !== 'string' || !part.etag || part.etag.length > 200) throw problem('storage', 'Saved upload parts are unreadable. Local output files are unchanged.');
      }
    }
  }
  return data;
}

class CloudSync extends EventEmitter {
  constructor({ service, dataDir, safeStorage, fetcher = globalThis.fetch } = {}) {
    super();
    if (!service || typeof service.get !== 'function' || typeof service.getOutputPath !== 'function') throw new Error('CloudSync needs a local job service.');
    if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir)) throw new Error('CloudSync dataDir must be absolute.');
    if (typeof fetcher !== 'function') throw new Error('CloudSync needs fetch.');
    this.service = service; this.dataDir = path.resolve(dataDir); this.safeStorage = safeStorage; this.fetcher = fetcher;
    this.queuePath = path.join(this.dataDir, 'cloud-sync-queue.json');
    this.sessionPath = path.join(this.dataDir, 'cloud-sync-session.enc');
    this.queue = { schemaVersion: 1, jobs: [] };
    this.pilot = null; this.cookie = null; this.authorization = null; this.expiresAt = 0;
    this.state = 'unlinked'; this.message = 'Link your own Axis field account to sync completed outputs.';
    this.running = false; this.initialized = false; this.storageError = false; this.epoch = 0; this._initPromise = null;
    this._saveTail = Promise.resolve(); this._authTail = Promise.resolve();
    this._runPromise = null; this._controller = null; this._timer = null;
    this._onEngineChange = job => { if (!job || job.status === 'completed') this._kick(); };
  }

  _secure() {
    try {
      return !!this.safeStorage?.isEncryptionAvailable?.()
        && this.safeStorage?.getSelectedStorageBackend?.() !== 'basic_text';
    } catch { return false; }
  }

  async init() {
    if (this.initialized) return this.status();
    if (!this._initPromise) this._initPromise = this._init();
    return this._initPromise;
  }
  async _init() {
    await fsp.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    try {
      const bytes = await readBounded(this.queuePath, 16 * 1024 * 1024);
      this.queue = validateQueue(JSON.parse(bytes.toString('utf8')));
      for (const row of this.queue.jobs) if (row.state === 'syncing') row.state = 'queued';
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.storageError = true; this.state = 'paused';
        this.message = 'Saved cloud sync queue is unreadable. Local output files are unchanged.';
      }
    }
    if (!this.storageError && this._secure()) {
      try {
        const encrypted = await readBounded(this.sessionPath, 64 * 1024);
        const session = JSON.parse(this.safeStorage.decryptString(encrypted));
        const validCookie=typeof session?.cookie==='string'&&new RegExp(`^${COOKIE}=[A-Za-z0-9_-]{40,100}$`).test(session.cookie),validAuthorization=typeof session?.authorization==='string'&&/^Bearer axisortho_[A-Za-z0-9_-]{64}$/.test(session.authorization);
        if (!session || !validCookie&&!validAuthorization
          || !uuid(session.pilot?.id) || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) throw new Error('Expired session');
        this.cookie = validCookie?session.cookie:null; this.authorization=validAuthorization?session.authorization:null; this.pilot = this._safePilot(session.pilot); this.expiresAt = session.expiresAt;
        this.state = 'linked'; this.message = 'Linked. Completed outputs sync after you choose their mission.';
      } catch (error) {
        if (error.code !== 'ENOENT') { this.state = 'sign_in_required'; this.message = 'Sign in again to resume cloud sync. Local outputs are safe.'; }
      }
    }
    this.initialized = true;
    return this.status();
  }

  _safePilot(pilot) { return { id: pilot.id, name: safeText(pilot.full_name || pilot.name || 'Pilot', 160), email: safeText(pilot.email, 254) }; }
  _snapshot() {
    return {
      linked: !!(this.cookie||this.authorization) && !!this.pilot && this.expiresAt > Date.now(), pilot: this.pilot ? { ...this.pilot } : null,
      state: this.state, message: this.message, running: this.running, secureStorage: this._secure(),
      queue: this.queue.jobs.filter(row => row.pilotId === this.pilot?.id).map(row => ({
        jobId: row.jobId, missionId: row.missionId, missionTitle: row.missionTitle, state: row.state, error: row.error,
        updatedAt: row.updatedAt, files: row.files.map(file => ({
          key: file.key, name: file.name, size: file.size, state: file.state,
          uploadedBytes: file.state === 'complete' ? file.size : Math.min(file.size, file.parts.length * file.chunkSize),
        })),
      })),
    };
  }
  async status() { return this._snapshot(); }
  _notify() { this.emit('change', this._snapshot()); }
  _authOperation(callback) {
    const operation = this._authTail.catch(() => {}).then(callback);
    this._authTail = operation.catch(() => {});
    return operation;
  }
  _saveQueue() {
    if (this.storageError) return Promise.reject(problem('storage', this.message));
    const bytes = JSON.stringify(validateQueue(this.queue), null, 2) + '\n';
    const operation = this._saveTail.catch(() => {}).then(() => atomicWrite(this.queuePath, bytes));
    this._saveTail = operation.catch(() => {});
    return operation.catch(() => {
      this.storageError = true; this.state = 'paused'; this.message = 'Could not save cloud sync progress. Local output files are unchanged.';
      throw problem('storage', this.message);
    });
  }
  _touch(row) { row.updatedAt = new Date().toISOString(); }
  _context() {
    if (!(this.cookie||this.authorization) || !this.pilot || this.expiresAt <= Date.now()) throw problem('auth', 'Sign in again to resume cloud sync.', 401);
    return { cookie: this.cookie, authorization:this.authorization, pilotId: this.pilot.id, epoch: this.epoch, signal: this._controller?.signal };
  }
  _check(context) {
    if (context.epoch !== this.epoch || context.signal?.aborted) throw problem('aborted', 'Cloud sync stopped.');
  }
  async _request(route, context, { method = 'GET', body, binary = false } = {}) {
    this._check(context);
    const url = new URL(route, ORIGIN);
    if (url.origin !== ORIGIN || !url.pathname.startsWith('/api/')) throw problem('protocol', 'Invalid cloud sync destination.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    context.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, binary ? 120000 : 30000); timer.unref?.();
    try {
      const headers = { Origin: ORIGIN, 'X-Axis-Request': url.pathname==='/api/ortho-connect'?'ortho-desktop':'pilot', Accept: 'application/json' };
      if (context.cookie) headers.Cookie = context.cookie;
      if (context.authorization) headers.Authorization = context.authorization;
      if (body !== undefined) headers['Content-Type'] = binary ? 'application/octet-stream' : 'application/json';
      const response = await this.fetcher(url.toString(), {
        method, headers, body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
        redirect: 'error', cache: 'no-store', signal: controller.signal,
      });
      this._check(context);
      if (!response.ok) {
        const code = response.status === 401 ? 'auth' : [403, 404].includes(response.status) ? 'access' : response.status === 410 ? 'expired' : response.status >= 500 || [408, 429].includes(response.status) ? 'offline' : 'protocol';
        throw problem(code, code === 'auth' ? 'Sign in again to resume cloud sync.'
          : code === 'access' ? 'Cloud sync is paused. Confirm your account still has access to this mission.'
          : code === 'expired' ? 'The upload expired and will be restarted.'
          : code === 'offline' ? 'Cloud connection unavailable. Sync will retry; local files are safe.'
          : 'The cloud service could not accept this upload. Local files are safe.', response.status);
      }
      let data;
      try { data = await response.json(); } catch { throw problem('protocol', 'The cloud service returned an unreadable response.'); }
      this._check(context);
      return { data, headers: response.headers };
    } catch (error) {
      if (error instanceof SyncError) throw error;
      this._check(context);
      throw problem('offline', 'Cloud connection unavailable. Sync will retry; local files are safe.');
    } finally { clearTimeout(timer); context.signal?.removeEventListener('abort', abort); }
  }

  async _missions(context) {
    const collected = [], seenOffsets = new Set();
    let offset = 0, pilot = null;
    for (let page = 0; page < 200; page++) {
      if (seenOffsets.has(offset)) throw problem('protocol', 'Mission pagination could not be verified.');
      seenOffsets.add(offset);
      const route=context.authorization?'/api/ortho/missions':'/api/field';
      const { data } = await this._request(route + (offset ? `?offset=${offset}` : ''), context);
      if (!uuid(data?.pilot?.id) || data.preview || !context.authorization&&data.owner || !Array.isArray(data.missions)) throw problem('access', !context.authorization&&data?.owner?'Sign in with your own field account. Administrative preview cannot sync files.':'Sign in with an account that can upload mission files.', 403);
      if (context.pilotId && data.pilot.id !== context.pilotId || pilot && data.pilot.id !== pilot.id) throw problem('auth', 'The signed-in field account changed. Sign in again before syncing.', 401);
      pilot = this._safePilot(data.pilot);
      for (const mission of data.missions) {
        if (!uuid(mission?.id)) throw problem('protocol', 'The service returned invalid mission data.');
        if (!collected.some(row => row.id === mission.id)) collected.push({ id: mission.id, title: safeText(mission.title || mission.site_name || 'Mission', 200), siteName: safeText(mission.site_name, 200) });
      }
      if (data.nextOffset === null || data.nextOffset === undefined) return { pilot, missions: collected };
      if (!Number.isSafeInteger(data.nextOffset) || data.nextOffset <= offset) throw problem('protocol', 'Mission pagination could not be verified.');
      offset = data.nextOffset;
    }
    throw problem('protocol', 'Too many missions to load safely. Contact your coordinator.');
  }

  async _halt() {
    this.epoch++;
    this._controller?.abort();
    await this._runPromise;
    let changed = false;
    for (const row of this.queue.jobs) if (row.state === 'syncing') {
      row.state = 'queued'; this._touch(row); changed = true;
    }
    if (changed && !this.storageError) await this._saveQueue();
  }
  async _forgetSession() {
    this.cookie = null; this.authorization=null; this.expiresAt = 0;
    await fsp.unlink(this.sessionPath).catch(error => { if (error.code !== 'ENOENT') throw problem('storage', 'Could not remove the saved sign-in session.'); });
  }
  async link({ email, password } = {}) {
    return this._authOperation(async () => {
      await this.init();
      if (this.storageError) throw problem('storage', this.message);
      if (!this._secure()) throw problem('storage', 'Secure operating-system credential storage is unavailable. Cloud sign-in is disabled.');
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254
        || typeof password !== 'string' || !password || password.length > 4096) throw problem('input', 'Enter your Axis email address and password.');
      await this._halt();
      await this._forgetSession(); this.pilot = null;
      this.state = 'sign_in_required'; this.message = 'Signing in to your own Axis field account.';
      const context = { epoch: this.epoch, cookie: null, authorization:null, pilotId: null };
      try {
        const response = await this._request('/api/auth/session', context, { method: 'POST', body: { action: 'login', email: email.trim(), password } });
        const cookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
        const raw = cookies.find(value => new RegExp(`(?:^|[,;]\\s*)${COOKIE}=`).test(value));
        const token = raw?.match(new RegExp(`(?:^|[,;]\\s*)${COOKIE}=([A-Za-z0-9_-]{40,100})(?:;|$)`))?.[1];
        if (!token) throw problem('auth', 'The cloud service did not return a usable sign-in session.', 401);
        const age = raw.match(/(?:^|;)\s*Max-Age=(\d+)/i)?.[1];
        const expiry = raw.match(/(?:^|;)\s*Expires=([^;]+)/i)?.[1];
        const proposed = age ? Date.now() + Number(age) * 1000 : expiry ? Date.parse(expiry) : Date.now() + 14 * 86400000;
        const expiresAt = Math.min(proposed, Date.now() + 14 * 86400000);
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw problem('auth', 'The returned sign-in session has expired.', 401);
        const cookie = `${COOKIE}=${token}`;
        const verified = await this._missions({ ...context, cookie });
        this._check(context);
        const session = this.safeStorage.encryptString(JSON.stringify({ cookie, pilot: verified.pilot, expiresAt }));
        await atomicWrite(this.sessionPath, session);
        this.cookie = cookie; this.authorization=null; this.pilot = verified.pilot; this.expiresAt = expiresAt;
        for (const row of this.queue.jobs) if (row.pilotId === this.pilot.id && row.state !== 'synced') {
          row.state = 'queued'; row.failures = 0; row.nextAttemptAt = 0; row.error = null; this._touch(row);
        }
        await this._saveQueue();
        this.state = 'linked'; this.message = 'Linked. Choose a mission for each completed job to sync it.';
        this._notify(); this._kick(); return this.status();
      } catch (error) {
        this.cookie = null; this.authorization=null; this.pilot = null; this.expiresAt = 0;
        await fsp.unlink(this.sessionPath).catch(() => {});
        this.state = 'sign_in_required'; this.message = error instanceof SyncError ? error.message : 'Could not securely save this sign-in. Try again.';
        this._notify(); throw problem(error.code || 'auth', this.message, error.status);
      }
    });
  }
  async linkOwner(openExternal) {
    return this._authOperation(async()=>{
      await this.init();if(this.storageError)throw problem('storage',this.message);if(!this._secure())throw problem('storage','Secure operating-system credential storage is unavailable. Cloud sign-in is disabled.');if(typeof openExternal!=='function')throw problem('input','Browser sign-in is unavailable.');
      await this._halt();await this._forgetSession();this.pilot=null;this.state='sign_in_required';this.message='Waiting for ChatGPT approval in your browser.';this._notify();
      const verifier=randomBytes(32).toString('base64url'),verifierHash=createHash('sha256').update(verifier).digest('base64url'),context={epoch:this.epoch,cookie:null,authorization:null,pilotId:null};
      try{
        const started=(await this._request('/api/ortho-connect',context,{method:'POST',body:{action:'start',verifierHash}})).data;
        if(!uuid(started?.deviceId)||typeof started.verificationUri!=='string'||new URL(started.verificationUri).origin!==ORIGIN)throw problem('protocol','Axis returned an invalid owner sign-in request.');
        await openExternal(started.verificationUri);
        let exchanged=null;
        for(let attempt=0;attempt<150&&!exchanged?.token;attempt++){
          await new Promise(resolve=>setTimeout(resolve,2000));this._check(context);
          const result=(await this._request('/api/ortho-connect',context,{method:'POST',body:{action:'exchange',deviceId:started.deviceId,verifier}})).data;
          if(result?.pending)continue;exchanged=result;
        }
        if(!/^axisortho_[A-Za-z0-9_-]{64}$/.test(exchanged?.token||'')||!Number.isFinite(Date.parse(exchanged?.expiresAt)))throw problem('auth','ChatGPT approval timed out. Start the connection again.',401);
        const authorization='Bearer '+exchanged.token,expiresAt=Math.min(Date.parse(exchanged.expiresAt),Date.now()+14*86400000),verified=await this._missions({...context,authorization});this._check(context);
        const session=this.safeStorage.encryptString(JSON.stringify({authorization,pilot:verified.pilot,expiresAt}));await atomicWrite(this.sessionPath,session);
        this.cookie=null;this.authorization=authorization;this.pilot=verified.pilot;this.expiresAt=expiresAt;this.state='linked';this.message='Connected with ChatGPT. Choose a mission for each completed job.';this._notify();this._kick();return this.status();
      }catch(error){this.cookie=null;this.authorization=null;this.pilot=null;this.expiresAt=0;await fsp.unlink(this.sessionPath).catch(()=>{});this.state='sign_in_required';this.message=error instanceof SyncError?error.message:'ChatGPT sign-in could not be completed.';this._notify();throw problem(error.code||'auth',this.message,error.status)}
    });
  }
  async unlink() {
    return this._authOperation(async () => {
      await this.init(); await this._halt(); await this._forgetSession(); this.pilot = null;
      this.state = 'unlinked'; this.message = 'Unlinked. Local files and saved upload progress are preserved.';
      this._notify(); return this.status();
    });
  }
  async missions() {
    await this.init();
    try { return (await this._missions(this._context())).missions; }
    catch (error) { await this._globalError(error); throw error; }
  }
  async setJobMission(id, missionId) {
    return this._authOperation(() => this._setJobMission(id, missionId));
  }
  async _setJobMission(id, missionId) {
    await this.init();
    if (this.storageError) throw problem('storage', this.message);
    if (!uuid(id) || !uuid(missionId)) throw problem('input', 'Choose a valid job and mission.');
    const context = this._context();
    const existing = this.queue.jobs.find(row => row.jobId === id);
    if (existing && existing.pilotId !== context.pilotId) throw problem('access', 'This job is linked to another pilot account. Sign in with that account to sync it.');
    if (existing && existing.missionId !== missionId && existing.files.some(file => file.uploadId || file.state === 'complete')) throw problem('access', 'This job has started uploading to its chosen mission. Its destination cannot be changed.');
    const [job, assigned] = await Promise.all([this.service.get(id), this._missions(context)]);
    this._check(context);
    if (!job || job.id !== id || job.status === 'unavailable') throw problem('input', 'The local job is unavailable.');
    const mission = assigned.missions.find(row => row.id === missionId);
    if (!mission) throw problem('access', 'Choose a mission assigned to your signed-in field account.', 403);
    // An upload may have started while mission permissions were being fetched.
    if (existing && existing.missionId !== missionId && existing.files.some(file => file.uploadId || file.state === 'complete')) throw problem('access', 'This job has started uploading to its chosen mission. Its destination cannot be changed.');
    if (existing?.state === 'synced') return this.status();
    if (existing?.state === 'syncing') return this.status();
    const row = existing || { jobId: id, pilotId: context.pilotId, files: [] };
    Object.assign(row, { missionId, missionTitle: mission.title, state: 'queued', failures: 0, nextAttemptAt: 0, error: null });
    this._touch(row); if (!existing) this.queue.jobs.push(row);
    await this._saveQueue(); this._notify(); this._kick(); return this.status();
  }

  async start() {
    await this.init();
    if (!this.running) {
      this.running = true; this.service.on?.('change', this._onEngineChange);
      this._timer = setInterval(() => this._kick(), 15000); this._timer.unref?.();
    }
    this._kick(); return this.status();
  }
  async stop() {
    this.running = false; clearInterval(this._timer); this._timer = null;
    this.service.off?.('change', this._onEngineChange);
    await this._halt(); await this._saveTail; this._notify(); return this.status();
  }
  async whenIdle() { await this._runPromise; await this._saveTail; }
  _kick() {
    if (!this.running || !(this.cookie||this.authorization) || !this.pilot || this.storageError || this._runPromise) return;
    this._controller = new AbortController();
    const operation = this._pass().catch(error => this._globalError(error)).finally(() => {
      if (this._runPromise === operation) { this._runPromise = null; this._controller = null; }
      this._notify();
    });
    this._runPromise = operation;
  }
  async _globalError(error) {
    if (error?.code === 'aborted') return;
    if (error?.code === 'auth') {
      this.epoch++; this._controller?.abort();
      try {
        await this._forgetSession();
        this.state = 'sign_in_required'; this.message = 'Sign in again to resume cloud sync. Local outputs are safe.';
      } catch {
        this.storageError = true; this.state = 'paused'; this.message = 'Could not remove an expired saved sign-in session. Cloud sync is paused.';
      }
    } else if (error?.code === 'offline') {
      this.state = 'offline'; this.message = 'Cloud connection unavailable. Sync will retry; local files are safe.';
    } else {
      this.state = 'paused'; this.message = error instanceof SyncError ? error.message : 'Cloud sync paused. Local output files are unchanged.';
    }
    this._notify();
  }
  _retry(row) {
    row.failures = Math.min(10, row.failures + 1);
    row.nextAttemptAt = Date.now() + Math.min(300000, 5000 * 2 ** (row.failures - 1));
    row.state = 'retry'; row.error = 'Cloud connection unavailable. Sync will retry; local files are safe.'; this._touch(row);
  }
  async _pass() {
    const context = this._context();
    const due = this.queue.jobs.filter(row => row.pilotId === context.pilotId && ['waiting', 'queued', 'retry'].includes(row.state) && row.nextAttemptAt <= Date.now());
    if (!due.length) return;
    let assigned;
    try { assigned = await this._missions(context); }
    catch (error) {
      if (error.code === 'offline') { for (const row of due) this._retry(row); await this._saveQueue(); }
      if (error.code === 'access') {
        for (const row of due) { row.state = 'paused'; row.error = error.message; this._touch(row); }
        await this._saveQueue();
      }
      throw error;
    }
    for (const row of due) {
      this._check(context);
      try {
        if (!assigned.missions.some(mission => mission.id === row.missionId)) throw problem('access', 'This mission is no longer assigned to your pilot account. Sync is paused.', 403);
        const job = await this.service.get(row.jobId); this._check(context);
        if (job.status !== 'completed') { row.state = 'waiting'; this._touch(row); await this._saveQueue(); continue; }
        if (!row.files.length) {
          const files = [];
          for (const key of Object.keys(OUTPUT_EXTENSIONS)) if (job.outputs?.[key]) {
            const outputPath = await this.service.getOutputPath(job.id, key); this._check(context);
            const stat = await fsp.lstat(outputPath);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_FILE_BYTES) throw problem('input', 'An output is unavailable or larger than the 78 GiB upload limit. Local files are unchanged.');
            files.push({ key, name: safeName(job.name, job.id, key), size: stat.size, mtimeMs: stat.mtimeMs,
              attempt: job.attempt || 0, state: 'queued', clientUploadId: randomUUID(), uploadId: null,
              chunkSize: CHUNK_SIZE, partCount: Math.ceil(stat.size / CHUNK_SIZE), parts: [] });
          }
          if (!files.length) throw problem('input', 'This completed job has no output files available to sync.');
          row.files = files;
          await this._saveQueue();
        }
        row.state = 'syncing'; row.error = null; this._touch(row); await this._saveQueue();
        this.state = 'syncing'; this.message = 'Syncing completed outputs. Local files stay on this computer.'; this._notify();
        for (const file of row.files) {
          this._check(context);
          if (file.state !== 'complete') await this._upload(row, file, job, context);
        }
        row.state = 'synced'; row.failures = 0; row.nextAttemptAt = 0; row.error = null;
        this._touch(row); await this._saveQueue();
        this.state = 'linked'; this.message = 'Completed outputs synced successfully. Local copies are preserved.'; this._notify();
      } catch (error) {
        if (error.code === 'aborted') throw error;
        if (error.code === 'offline') this._retry(row);
        else {
          row.state = error.code === 'expired' ? 'retry' : 'paused';
          row.nextAttemptAt = error.code === 'expired' ? Date.now() + 5000 : 0;
          row.error = error instanceof SyncError ? error.message : 'A local output could not be verified. Sync is paused; local files are unchanged.';
          this._touch(row);
        }
        await this._saveQueue();
        await this._globalError(error);
        if (error.code === 'auth' || error.code === 'storage') break;
      }
    }
  }

  _uploadRoute(row, file, extra = {}) {
    const params = new URLSearchParams({ missionId: row.missionId, ...(file?.uploadId ? { uploadId: file.uploadId } : {}), ...extra });
    return '/api/pilot/uploads?' + params;
  }
  _serverUpload(data, file) {
    if (!uuid(data?.id) || data.chunkSize !== CHUNK_SIZE || data.partCount !== file.partCount
      || data.size !== undefined && data.size !== file.size || file.uploadId && data.id !== file.uploadId) throw problem('protocol', 'Cloud upload metadata did not match the local output.');
    return data;
  }
  async _complete(row, file) {
    file.state = 'complete'; this._touch(row); await this._saveQueue(); this._notify();
  }
  async _upload(row, file, job, context) {
    if ((job.attempt || 0) !== file.attempt) throw problem('input', 'This job was processed again after sync was queued. Its earlier upload is paused.');
    const outputPath = await this.service.getOutputPath(job.id, file.key); this._check(context);
    let handle;
    try {
      handle = await fsp.open(outputPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const verify = async () => {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size !== file.size || stat.mtimeMs !== file.mtimeMs) throw problem('input', 'A local output changed after it was queued. Sync is paused.');
      };
      await verify();
      for (let resets = 0; resets < 2; resets++) {
        try {
          if (file.uploadId) {
            const status = this._serverUpload((await this._request(this._uploadRoute(row, file, { status: '1' }), context)).data, file);
            if (status.state === 'complete') return await this._complete(row, file);
            if (['expired', 'cancelled'].includes(status.state)) throw problem('expired', 'The upload expired and will be restarted.', 410);
          } else {
            const result = this._serverUpload((await this._request(this._uploadRoute(row), context, { method: 'POST', body: {
              name: file.name, size: file.size, category: 'drone', notes: `Axis Ortho ${file.key} output from local job ${row.jobId}.`,
              location: { source: 'manual', label: 'Orthomosaic results' }, clientUploadId: file.clientUploadId,
            } })).data, file);
            file.uploadId = result.id; file.state = 'uploading'; this._touch(row); await this._saveQueue();
            if (result.state === 'complete') return await this._complete(row, file);
          }
          for (let partNumber = file.parts.length + 1; partNumber <= file.partCount; partNumber++) {
            this._check(context); await verify();
            const start = (partNumber - 1) * file.chunkSize, length = Math.min(file.chunkSize, file.size - start);
            const buffer = Buffer.allocUnsafe(length);
            let read = 0;
            while (read < length) {
              const { bytesRead } = await handle.read(buffer, read, length - read, start + read);
              if (!bytesRead) throw problem('input', 'A local output is incomplete. Sync is paused.');
              read += bytesRead;
            }
            await verify();
            const { data } = await this._request(this._uploadRoute(row, file, { partNumber: String(partNumber) }), context, { method: 'PUT', body: buffer, binary: true });
            if (data?.partNumber !== partNumber || typeof data.etag !== 'string' || !data.etag || data.etag.length > 200) throw problem('protocol', 'The service did not confirm the uploaded chunk.');
            file.parts.push({ partNumber, etag: data.etag }); this._touch(row); await this._saveQueue(); this._notify();
          }
          await verify(); this._check(context);
          const { data } = await this._request(this._uploadRoute(row, file), context, { method: 'POST', body: { parts: file.parts } });
          if (data?.saved !== true) throw problem('protocol', 'The service did not confirm the completed output.');
          await this._complete(row, file); return;
        } catch (error) {
          if (error.code !== 'expired') throw error;
          file.clientUploadId = randomUUID(); file.uploadId = null; file.parts = []; file.state = 'queued';
          this._touch(row); await this._saveQueue();
          if (resets === 1) throw error;
        }
      }
    } finally { if (handle) await handle.close(); }
  }
}

module.exports = { CloudSync };
