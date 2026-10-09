'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { CloudSync } = require('./cloud-sync.cjs');

const ORIGIN = 'https://axis.huvrs.chatgpt.site';
const CHUNK = 8 * 1024 * 1024;
const A = { id: '11111111-1111-4111-8111-111111111111', name: 'Pilot A', email: 'a@example.com' };
const B = { id: '22222222-2222-4222-8222-222222222222', name: 'Pilot B', email: 'b@example.com' };
const MA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOKEN_A = 'a'.repeat(64), TOKEN_B = 'b'.repeat(64), PASSWORD = 'test-password-should-not-leak';
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: value => Buffer.from(Buffer.from(value).map(byte => byte ^ 0xab)),
  decryptString: value => Buffer.from(value.map(byte => byte ^ 0xab)).toString('utf8'),
};
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function server() {
  const state = { requests: [], uploads: new Map(), byClient: new Map(), failPart: null, failStatus: 0,
    loseComplete: false, loseInit: false, owner: false, expired: new Set(), missionStatus: 0,
    blockPut: null, secondPage: false };
  state.fetch = async (urlString, options = {}) => {
    const url = new URL(urlString), method = options.method || 'GET', headers = options.headers || {};
    assert.equal(url.origin, ORIGIN);
    assert.equal(headers.Origin, ORIGIN);
    assert.equal(headers['X-Axis-Request'], 'pilot');
    assert.equal(options.redirect, 'error');
    assert.equal(url.searchParams.has('pilotId'), false);
    const record = { url: url.toString(), method, headers: { ...headers }, body: options.body };
    state.requests.push(record);
    if (url.pathname === '/api/auth/session') {
      assert.equal(headers.Cookie, undefined);
      const body = JSON.parse(options.body);
      assert.equal(body.action, 'login'); assert.equal(body.password, PASSWORD);
      const token = body.email === A.email ? TOKEN_A : TOKEN_B;
      return reply({ signedIn: true }, 200, { 'Set-Cookie': `axis_email_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600` });
    }
    const pilot = headers.Cookie === `axis_email_session=${TOKEN_A}` ? A : headers.Cookie === `axis_email_session=${TOKEN_B}` ? B : null;
    if (!pilot) return reply({}, 401);
    if (url.pathname === '/api/field') {
      if (state.missionStatus) return reply({ error: TOKEN_A }, state.missionStatus);
      if (state.owner) return reply({ owner: true, pilots: [A] });
      const mission = { id: pilot === A ? MA : MB, title: pilot === A ? 'Mission A' : 'Mission B', site_name: 'Site' };
      if (state.secondPage && !url.searchParams.has('offset')) return reply({ pilot, preview: false, missions: [], nextOffset: 50 });
      return reply({ pilot, preview: false, missions: [mission], nextOffset: null });
    }
    assert.equal(url.pathname, '/api/pilot/uploads');
    const missionId = url.searchParams.get('missionId');
    assert.equal(missionId, pilot === A ? MA : MB);
    if (state.failStatus) return reply({ error: PASSWORD + TOKEN_A }, state.failStatus);
    const uploadId = url.searchParams.get('uploadId');
    let upload = uploadId && state.uploads.get(uploadId);
    if (uploadId && (!upload || upload.pilotId !== pilot.id || upload.missionId !== missionId)) return reply({}, 404);
    const metadata = row => ({ id: row.id, size: row.size, chunkSize: CHUNK, partCount: Math.ceil(row.size / CHUNK), state: row.state });
    if (method === 'GET') {
      assert.equal(url.searchParams.get('status'), '1');
      if (state.expired.has(uploadId)) { state.expired.delete(uploadId); upload.state = 'expired'; return reply({}, 410); }
      return reply(metadata(upload));
    }
    if (method === 'POST' && !uploadId) {
      const body = JSON.parse(options.body);
      assert.match(body.clientUploadId, /^[\da-f-]{36}$/);
      assert.equal(body.category, 'drone');
      assert.deepEqual(body.location, { source: 'manual', label: 'Orthomosaic results' });
      assert.equal(/[\\/\x00-\x1f]/.test(body.name), false);
      const clientKey = pilot.id + '/' + body.clientUploadId;
      upload = state.byClient.get(clientKey);
      if (!upload) {
        upload = { ...body, id: randomUUID(), pilotId: pilot.id, missionId, state: 'uploading', parts: [] };
        state.uploads.set(upload.id, upload); state.byClient.set(clientKey, upload);
      }
      if (state.loseInit) { state.loseInit = false; throw new Error('Connection dropped ' + PASSWORD); }
      return reply(metadata(upload));
    }
    if (method === 'PUT') {
      const partNumber = Number(url.searchParams.get('partNumber'));
      assert.ok(Buffer.isBuffer(options.body));
      assert.equal(options.body.length, Math.min(CHUNK, upload.size - (partNumber - 1) * CHUNK));
      if (state.blockPut) return state.blockPut(options.signal);
      if (state.failPart === partNumber) { state.failPart = null; throw new Error('Network unavailable ' + TOKEN_A); }
      const part = { partNumber, etag: `etag-${partNumber}` };
      upload.parts[partNumber - 1] = part;
      return reply(part);
    }
    assert.equal(method, 'POST');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.parts, upload.parts);
    assert.equal(body.parts.length, Math.ceil(upload.size / CHUNK));
    upload.state = 'complete';
    if (state.loseComplete) { state.loseComplete = false; throw new Error('Completion reply lost ' + TOKEN_A); }
    return reply({ saved: true, id: upload.id });
  };
  return state;
}

async function fixture(t, { size = 12, both = false, secure = safeStorage, status = 'completed' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'axis-cloud-sync-'));
  const dataDir = path.join(root, 'sync');
  const service = new EventEmitter();
  const jobs = new Map(), files = new Map();
  service.get = async id => { if (!jobs.has(id)) throw new Error('Job unavailable'); return structuredClone(jobs.get(id)); };
  service.getOutputPath = async (id, key) => { if (!files.has(id + '/' + key)) throw new Error('Output unavailable'); return files.get(id + '/' + key); };
  const addJob = async (name = 'Job ../ with : bad chars') => {
    const id = randomUUID(), outputs = {};
    for (const key of both ? ['archive', 'orthophoto'] : ['archive']) {
      const output = path.join(root, `${id}-${key}.${key === 'archive' ? 'zip' : 'tif'}`);
      const handle = await fs.open(output, 'w');
      try { await handle.write(Buffer.from(key === 'archive' ? 'PK\x03\x04' : 'II\x2a\0', 'binary')); await handle.truncate(size); }
      finally { await handle.close(); }
      files.set(id + '/' + key, output); outputs[key] = { relativePath: `output/${key}`, size };
    }
    const job = { id, name, status, attempt: 1, outputs }; jobs.set(id, job); return job;
  };
  const job = await addJob(), remote = server(), instances = [];
  const instance = () => {
    const sync = new CloudSync({ service, dataDir, safeStorage: secure, fetcher: remote.fetch }); instances.push(sync); return sync;
  };
  const sync = instance();
  t.after(async () => { for (const value of instances) await value.stop(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, dataDir, service, job, jobs, files, addJob, remote, sync, instance };
}
async function link(sync, pilot = A) { return sync.link({ email: pilot.email, password: PASSWORD }); }
async function bind(f, sync = f.sync) { await link(sync); await sync.setJobMission(f.job.id, MA); }
async function run(sync) { await sync.start(); await sync.whenIdle(); }
function puts(f) { return f.remote.requests.filter(row => row.method === 'PUT'); }
function initializations(f) { return f.remote.requests.filter(row => row.method === 'POST' && row.url.includes('/uploads?') && !row.url.includes('uploadId=')); }

test('sign-in and status never expose secrets, session is encrypted, and missions are paginated', async t => {
  const f = await fixture(t);
  const events = []; f.sync.on('change', state => events.push(state));
  f.remote.secondPage = true;
  const state = await link(f.sync);
  assert.equal(state.linked, true); assert.deepEqual(state.pilot, A);
  assert.deepEqual(await f.sync.missions(), [{ id: MA, title: 'Mission A', siteName: 'Site' }]);
  const saved = await fs.readFile(path.join(f.dataDir, 'cloud-sync-session.enc'));
  assert.equal(saved.includes(Buffer.from(TOKEN_A)), false);
  const publicData = JSON.stringify([state, events, await f.sync.status()]);
  assert.equal(publicData.includes(TOKEN_A), false); assert.equal(publicData.includes(PASSWORD), false);
  const queue = await fs.readFile(path.join(f.dataDir, 'cloud-sync-queue.json'), 'utf8');
  assert.equal(queue.includes(TOKEN_A), false); assert.equal(queue.includes(PASSWORD), false);
  const reopened = f.instance(); assert.equal((await reopened.init()).linked, true);
});

test('unavailable encryption and admin preview cannot create a cloud session', async t => {
  const f = await fixture(t, { secure: { ...safeStorage, isEncryptionAvailable: () => false } });
  await assert.rejects(link(f.sync), /Secure operating-system/);
  assert.equal(f.remote.requests.length, 0);
  const weak = new CloudSync({ service: f.service, dataDir: f.dataDir, safeStorage: { ...safeStorage, getSelectedStorageBackend: () => 'basic_text' }, fetcher: f.remote.fetch });
  await assert.rejects(link(weak), /Secure operating-system/);
  const preview = new CloudSync({ service: f.service, dataDir: f.dataDir, safeStorage, fetcher: f.remote.fetch });
  f.remote.owner = true;
  await assert.rejects(link(preview), /own field account/);
  assert.equal((await preview.status()).linked, false);
  await assert.rejects(fs.stat(path.join(f.dataDir, 'cloud-sync-session.enc')), { code: 'ENOENT' });
});

test('completed outputs wait for an explicit own mission then both files sync', async t => {
  const f = await fixture(t, { both: true });
  await link(f.sync); await run(f.sync);
  assert.equal(initializations(f).length, 0);
  await assert.rejects(f.sync.setJobMission(f.job.id, MB), /assigned/);
  await f.sync.setJobMission(f.job.id, MA); await f.sync.whenIdle();
  const state = await f.sync.status();
  assert.equal(state.queue[0].state, 'synced');
  assert.deepEqual(state.queue[0].files.map(file => file.key), ['archive', 'orthophoto']);
  assert.equal(state.queue[0].files.every(file => file.uploadedBytes === file.size), true);
  assert.equal(initializations(f).length, 2);
  assert.equal((await fs.stat(f.files.get(f.job.id + '/archive'))).size, 12);
});

test('concurrent mission binding creates one durable queue row', async t => {
  const f = await fixture(t); await link(f.sync);
  await Promise.all([f.sync.setJobMission(f.job.id, MA), f.sync.setJobMission(f.job.id, MA)]);
  assert.equal((await f.sync.status()).queue.length, 1);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.dataDir, 'cloud-sync-queue.json'), 'utf8')).jobs.length, 1);
});

test('account switching hides and never uploads or reassigns another pilot queue', async t => {
  const f = await fixture(t); await bind(f);
  await link(f.sync, B);
  assert.deepEqual((await f.sync.status()).queue, []);
  await assert.rejects(f.sync.setJobMission(f.job.id, MB), /another pilot account/);
  await run(f.sync); assert.equal(initializations(f).length, 0);
  const second = await f.addJob('Pilot B job');
  await f.sync.setJobMission(second.id, MB); await f.sync.whenIdle();
  assert.equal(initializations(f).length, 1);
  assert.equal([...f.remote.uploads.values()][0].pilotId, B.id);
  await f.sync.stop(); await link(f.sync, A); await run(f.sync);
  assert.equal((await f.sync.status()).queue[0].jobId, f.job.id);
  assert.equal([...f.remote.uploads.values()].filter(upload => upload.pilotId === A.id).length, 1);
});

test('restart resumes saved parts and does not reupload acknowledged chunks', async t => {
  const f = await fixture(t, { size: CHUNK + 7 }); f.remote.failPart = 2;
  await bind(f); await run(f.sync);
  assert.equal((await f.sync.status()).queue[0].state, 'retry');
  const persisted = JSON.parse(await fs.readFile(path.join(f.dataDir, 'cloud-sync-queue.json'), 'utf8'));
  assert.deepEqual(persisted.jobs[0].files[0].parts, [{ partNumber: 1, etag: 'etag-1' }]);
  await f.sync.stop();
  const reopened = f.instance(); await reopened.init(); await reopened.setJobMission(f.job.id, MA); await run(reopened);
  assert.equal((await reopened.status()).queue[0].state, 'synced');
  assert.equal(puts(f).filter(row => row.url.includes('partNumber=1')).length, 1);
  assert.equal(puts(f).filter(row => row.url.includes('partNumber=2')).length, 2);
  assert.equal(initializations(f).length, 1);
});

test('lost completion reply reconciles server completion without repeating upload', async t => {
  const f = await fixture(t); f.remote.loseComplete = true;
  await bind(f); await run(f.sync);
  assert.equal((await f.sync.status()).queue[0].state, 'retry');
  assert.equal([...f.remote.uploads.values()][0].state, 'complete');
  await f.sync.setJobMission(f.job.id, MA); await f.sync.whenIdle();
  assert.equal((await f.sync.status()).queue[0].state, 'synced');
  assert.equal(puts(f).length, 1);
  assert.equal(f.remote.requests.filter(row => row.method === 'POST' && row.url.includes('uploadId=')).length, 1);
});

test('lost initialization reply reuses client upload UUID and one server upload', async t => {
  const f = await fixture(t); f.remote.loseInit = true;
  await bind(f); await run(f.sync);
  assert.equal((await f.sync.status()).queue[0].state, 'retry');
  await f.sync.setJobMission(f.job.id, MA); await f.sync.whenIdle();
  assert.equal((await f.sync.status()).queue[0].state, 'synced');
  assert.equal(f.remote.uploads.size, 1);
  assert.equal(new Set(initializations(f).map(row => JSON.parse(row.body).clientUploadId)).size, 1);
});

test('expired upload restarts with a new client UUID and preserves local file', async t => {
  const f = await fixture(t, { size: CHUNK + 1 }); f.remote.failPart = 2;
  await bind(f); await run(f.sync);
  const previous = [...f.remote.uploads.keys()][0]; f.remote.expired.add(previous);
  await f.sync.setJobMission(f.job.id, MA); await f.sync.whenIdle();
  assert.equal((await f.sync.status()).queue[0].state, 'synced');
  assert.equal(f.remote.uploads.size, 2);
  assert.equal(new Set(initializations(f).map(row => JSON.parse(row.body).clientUploadId)).size, 2);
  assert.equal((await fs.stat(f.files.get(f.job.id + '/archive'))).size, CHUNK + 1);
  assert.equal(f.remote.requests.some(row => row.method === 'DELETE'), false);
});

test('401 requires new sign-in and returns no server error text or credentials', async t => {
  const f = await fixture(t); await bind(f); f.remote.failStatus = 401; await run(f.sync);
  const state = await f.sync.status();
  assert.equal(state.linked, false); assert.equal(state.state, 'sign_in_required');
  assert.equal(state.queue[0].state, 'paused');
  assert.equal(JSON.stringify(state).includes(PASSWORD), false);
  assert.equal(JSON.stringify(state).includes(TOKEN_A), false);
  await assert.rejects(fs.stat(path.join(f.dataDir, 'cloud-sync-session.enc')), { code: 'ENOENT' });
  const before = f.remote.requests.length; f.service.emit('change'); await f.sync.whenIdle();
  assert.equal(f.remote.requests.length, before);
  f.remote.failStatus = 0; await link(f.sync); await f.sync.whenIdle();
  assert.equal((await f.sync.status()).queue[0].state, 'synced');
});

test('403 and 404 pause, while transient failures use bounded backoff', async t => {
  for (const status of [403, 404, 503]) {
    const f = await fixture(t); await bind(f); f.remote.failStatus = status; await run(f.sync);
    const state = await f.sync.status();
    assert.equal(state.queue[0].state, status === 503 ? 'retry' : 'paused');
    const before = f.remote.requests.length;
    f.service.emit('change'); await f.sync.whenIdle(); assert.equal(f.remote.requests.length, before);
    if (status === 503) {
      const row = JSON.parse(await fs.readFile(path.join(f.dataDir, 'cloud-sync-queue.json'), 'utf8')).jobs[0];
      assert.equal(row.failures, 1); assert.ok(row.nextAttemptAt > Date.now()); assert.ok(row.nextAttemptAt <= Date.now() + 300000);
    }
    assert.equal((await fs.stat(f.files.get(f.job.id + '/archive'))).size, 12);
    await f.sync.stop();
  }
});

test('changed queued output pauses rather than mixing bytes in resumed upload', async t => {
  const f = await fixture(t, { size: CHUNK + 1 }); f.remote.failPart = 2;
  await bind(f); await run(f.sync);
  const before = puts(f).length;
  await fs.writeFile(f.files.get(f.job.id + '/archive'), 'changed');
  await f.sync.setJobMission(f.job.id, MA); await f.sync.whenIdle();
  assert.equal((await f.sync.status()).queue[0].state, 'paused');
  assert.equal(puts(f).length, before);
});

test('switching accounts aborts an active transfer before new account can upload', async t => {
  const f = await fixture(t); await bind(f);
  let entered;
  const transferStarted = new Promise(resolve => { entered = resolve; });
  f.remote.blockPut = signal => new Promise((resolve, reject) => {
    entered();
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await f.sync.start(); await transferStarted;
  await link(f.sync, B);
  assert.equal((await f.sync.status()).pilot.id, B.id);
  assert.deepEqual((await f.sync.status()).queue, []);
  assert.equal(puts(f).length, 1);
  assert.equal(f.remote.requests.filter(row => row.url.includes('/uploads?') && row.headers.Cookie === `axis_email_session=${TOKEN_B}`).length, 0);
});

test('corrupt queue is explicit and is never replaced by a fresh empty queue', async t => {
  const f = await fixture(t);
  await fs.mkdir(f.dataDir); const queuePath = path.join(f.dataDir, 'cloud-sync-queue.json');
  await fs.writeFile(queuePath, '{broken');
  const state = await f.sync.init();
  assert.equal(state.state, 'paused'); assert.match(state.message, /unreadable/);
  await assert.rejects(link(f.sync), /unreadable/);
  assert.equal(await fs.readFile(queuePath, 'utf8'), '{broken');
  assert.equal(f.remote.requests.length, 0);
});

test('stop and start in the same process resumes an aborted transfer', async t => {
  const f = await fixture(t); await bind(f);
  let entered;
  const transferStarted = new Promise(resolve => { entered = resolve; });
  f.remote.blockPut = signal => new Promise((resolve, reject) => {
    entered(); signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await f.sync.start(); await transferStarted; await f.sync.stop();
  assert.equal((await f.sync.status()).queue[0].state, 'queued');
  f.remote.blockPut = null; await run(f.sync);
  assert.equal((await f.sync.status()).queue[0].state, 'synced');
  assert.equal(initializations(f).length, 1);
});

test('failure to verify one output does not silently omit it from a later sync', async t => {
  const f = await fixture(t, { both: true });
  const original = f.service.getOutputPath;
  f.service.getOutputPath = async (id, key) => { if (key === 'orthophoto') throw new Error('Temporarily unavailable'); return original(id, key); };
  await bind(f); await run(f.sync);
  assert.equal((await f.sync.status()).queue[0].state, 'paused');
  assert.equal((await f.sync.status()).queue[0].files.length, 0);
  assert.equal(initializations(f).length, 0);
  f.service.getOutputPath = original;
  await f.sync.setJobMission(f.job.id, MA); await f.sync.whenIdle();
  assert.equal((await f.sync.status()).queue[0].files.length, 2);
  assert.equal(initializations(f).length, 2);
});


test('native delivery uploads the GeoTIFF, quality report and checksum manifest to the same authorized mission',async t=>{
 const f=await fixture(t,{both:true});
 for(const [key,extension] of Object.entries({dsm:'tif',report:'pdf',stats:'json',quality:'json',delivery:'json'})){
   const file=path.join(f.root,key+'.'+extension);await fs.writeFile(file,'delivery fixture');
   f.files.set(f.job.id+'/'+key,file);f.jobs.get(f.job.id).outputs[key]={relativePath:'output/'+key+'.'+extension,size:16};
 }
 await bind(f);await run(f.sync);
 assert.equal((await f.sync.status()).queue[0].state,'synced');
 assert.deepEqual((await f.sync.status()).queue[0].files.map(f=>f.key),['archive','orthophoto','dsm','report','stats','quality','delivery']);
 assert.ok(initializations(f).every(r=>r.url.includes('missionId='+MA)));
 assert.ok(initializations(f).some(r=>JSON.parse(r.body).name.endsWith('-quality.json')));
 const reopened=f.instance();await reopened.init();await link(reopened);
 assert.equal((await reopened.status()).queue[0].files.length,7);
});
