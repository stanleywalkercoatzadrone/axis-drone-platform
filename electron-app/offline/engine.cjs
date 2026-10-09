'use strict';

// This module deliberately has no application configuration, database, or cloud imports.
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { setTimeout: delay } = require('node:timers/promises');
const { JobStore } = require('./store.cjs');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE = new Set(['starting', 'uploading', 'processing', 'downloading', 'interrupted']);
const OUTPUTS = Object.freeze({
  'odm_orthophoto/odm_orthophoto.tif': ['orthophoto', 'orthophoto.tif'],
  'odm_dem/dsm.tif': ['dsm', 'dsm.tif'],
  'odm_report/report.pdf': ['report', 'report.pdf'],
  'odm_report/stats.json': ['stats', 'stats.json'],
});
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

function loopbackEndpoint(value) {
  let u;
  try { u = new URL(value); } catch { throw new Error('Choose a valid local NodeODM address.'); }
  if (u.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(u.hostname) ||
      u.username || u.password || u.search || u.hash || !['', '/'].includes(u.pathname)) {
    throw new Error('NodeODM must use a loopback IP address without credentials or a URL path.');
  }
  return u.origin;
}
function optionsFor(preset) {
  return [
    { name: 'auto-boundary', value: true }, { name: 'dsm', value: true },
    { name: 'fast-orthophoto', value: preset === 'fast' },
    { name: 'feature-quality', value: preset === 'fast' ? 'low' : 'high' },
    { name: 'min-num-features', value: preset === 'fast' ? 4000 : 8000 },
  ];
}
function aborted() { const e = new Error('Local processing interrupted.'); e.name = 'AbortError'; return e; }
function check(signal) { if (signal?.aborted) throw aborted(); }
function safeArchiveName(name) {
  return typeof name === 'string' && !name.includes('\0') && !name.includes('\\') &&
    !name.startsWith('/') && !/^[A-Za-z]:/.test(name) && !name.split('/').includes('..');
}
async function syncFile(file) { const h = await fsp.open(file, 'r+'); try { await h.sync(); } finally { await h.close(); } }
async function syncDirectory(directory) {
  let handle;
  try { handle = await fsp.open(directory, 'r'); await handle.sync(); }
  catch (error) {
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EISDIR', 'EINVAL', 'ENOTSUP'].includes(error.code)) throw error;
  } finally { if (handle) await handle.close(); }
}

class OrthoService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.endpoint = loopbackEndpoint(options.endpoint || options.nodeOdmUrl || 'http://127.0.0.1:58000');
    this.token = options.token ?? options.nodeOdmToken ?? '';
    if (typeof this.token !== 'string' || this.token.length > 4096) throw new Error('Invalid local engine token.');
    this.store = options.store || new JobStore(options);
    this.runner = options.runner || null;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30000;
    this.transferTimeoutMs = options.transferTimeoutMs ?? 30 * 60 * 1000;
    this.maxPollFailures = options.maxPollFailures ?? 5;
    this.maxArchiveBytes = options.maxArchiveBytes ?? 50 * 1024 ** 3;
    this.maxExtractedBytes = options.maxExtractedBytes ?? 100 * 1024 ** 3;
    this.maxArchiveEntries = options.maxArchiveEntries ?? 100000;
    this.active = new Map();
    this.imports = new Map();
    this.closing = false;
  }

  _importRow(id) {
    for (const entry of this.imports.values()) if (entry.row?.id === id) return structuredClone(entry.row);
    return null;
  }
  async list() {
    const before = new Map([...this.imports.values()].filter(entry => entry.row).map(entry => [entry.row.id, structuredClone(entry.row)]));
    const saved = await this.store.list();
    const importing = new Map([...this.imports.values()].filter(entry => entry.row).map(entry => [entry.row.id, structuredClone(entry.row)]));
    const result = saved.map(job => importing.get(job.id) || (job.status === 'unavailable' && before.get(job.id)) || job);
    const seen = new Set(result.map(job => job.id));
    for (const [id, row] of importing) if (!seen.has(id)) result.push(row);
    return result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id));
  }
  async get(id) {
    const importing = this._importRow(id); if (importing) return importing;
    try { return await this.store.get(id); }
    catch (error) { const started = this._importRow(id); if (started) return started; throw error; }
  }
  async create(details) {
    if (this.closing) throw new Error('The local processor is closing.');
    const token = randomUUID(), entry = { row: null, promise: null };
    this.imports.set(token, entry);
    entry.promise = Promise.resolve().then(() => this.store.create(details, { onProgress: progress => {
      const { id, name, preset, createdAt, totalFiles, copiedFiles, totalBytes, copiedBytes } = progress;
      entry.row = {
        schemaVersion: 1, id, name, preset, inputs: [], outputs: {}, status: 'importing',
        progress: totalBytes ? Math.min(100, Math.round(copiedBytes / totalBytes * 100)) : 0,
        phase: `Importing ${copiedFiles}/${totalFiles} images`, taskId: null, taskCommitted: false,
        engineEndpoint: null, attempt: 0, error: null, createdAt, updatedAt: new Date().toISOString(),
        importProgress: { totalFiles, copiedFiles, totalBytes, copiedBytes },
      };
      this.emit('change', structuredClone(entry.row));
    } })).then(job => {
      this.imports.delete(token); this.emit('change', job); return job;
    }, error => { this.imports.delete(token); throw error; });
    return entry.promise;
  }
  async getOutputPath(id, key) { return this.store.getOutputPath(id, key); }
  async _update(id, patch, signal) {
    check(signal);
    const job = await this.store.update(id, patch); this.emit('change', job); return job;
  }

  // Starts work in the background. whenIdle is useful to hosts that must wait before exit/tests.
  async start(id) {
    if (this.closing) throw new Error('The local processor is closing.');
    const job = await this.get(id);
    if (this.closing) throw new Error('The local processor is closing.');
    if (job.status === 'importing') throw new Error('Wait until the image import finishes before starting processing.');
    if (this.active.has(id)) return job;
    if (job.status === 'completed') return job;
    if (job.status === 'unavailable' || job.status === 'canceling') throw new Error('This job cannot start until its stored state is resolved.');
    if (this.runner && this.active.size) throw new Error('Another local job is processing. Wait for it to finish or cancel it before starting this job.');
    const controller = new AbortController();
    const entry = { controller, promise: null };
    this.active.set(id, entry);
    entry.promise = this._run(id, controller.signal).catch(async error => {
      const current = await this.get(id);
      if (current.status === 'canceled' || current.status === 'canceling') return;
      await this._update(id, {
        status: controller.signal.aborted ? 'interrupted' : 'failed',
        phase: controller.signal.aborted ? 'Interrupted; ready to resume' : 'Failed',
        error: controller.signal.aborted ? null : String(error.message || 'Processing failed.').slice(0, 1000),
      });
    }).catch(error => {
      // Do not turn storage failures into unhandled background rejections.
      this.emit('serviceError', { id, message: String(error.message || error) });
    }).finally(() => { if (this.active.get(id) === entry) this.active.delete(id); });
    return this.get(id);
  }
  async whenIdle(id) {
    if (id) {
      await Promise.allSettled([...this.imports.values()].filter(entry => entry.row?.id === id).map(entry => entry.promise));
      await this.active.get(id)?.promise;
    } else {
      while (this.imports.size || this.active.size) {
        await Promise.allSettled([...this.imports.values(), ...this.active.values()].map(entry => entry.promise));
      }
    }
  }
  async shutdown() {
    this.closing = true;
    for (const entry of this.active.values()) entry.controller.abort();
    await this.whenIdle();
  }
  async recover() {
    const jobs = await this.list();
    for (const job of jobs) {
      if (job.status === 'canceling') { try { await this.cancel(job.id); } catch { /* retry remains explicit */ } }
      else if (ACTIVE.has(job.status)) await this.start(job.id);
    }
    return this.list();
  }
  async cancel(id) {
    const job = await this.get(id);
    if (job.status === 'importing') throw new Error('Wait until the image import finishes before canceling this job.');
    if (job.status === 'completed' || job.status === 'canceled') return job;
    if (job.engineEndpoint && job.engineEndpoint !== this.endpoint) throw new Error('Reconnect the original local engine before canceling this job.');
    await this._update(id, { status: 'canceling', phase: 'Canceling', error: null });
    this.active.get(id)?.controller.abort();
    await this.whenIdle(id);
    if (this.runner) return this._update(id, { status: 'canceled', phase: 'Canceled', error: null });
    try {
      const current = await this.get(id);
      if (current.taskId) {
        // Even an unconfirmed commit can already be running in NodeODM. Inspect it
        // before declaring cancellation, including after a lost commit response.
        let info;
        try { info = await this._json(`/task/${current.taskId}/info`); }
        catch (error) { if (!error.taskMissing) throw error; }
        if (info) {
          const code = info.status?.code;
          if (![10, 20, 30, 40, 50].includes(code)) throw new Error('The local engine returned an unrecognized task state.');
          if ([10, 20].includes(code)) {
            await this._json('/task/cancel', { method: 'POST', json: { uuid: current.taskId } });
            const stopped = await this._json(`/task/${current.taskId}/info`);
            if (![30, 40, 50].includes(stopped.status?.code)) return this._update(id, { status: 'canceling', phase: 'Cancellation pending in local engine', error: null });
          }
        }
      }
      return await this._update(id, { status: 'canceled', phase: 'Canceled', error: null });
    } catch (error) {
      await this._update(id, { status: 'canceling', phase: 'Cancellation needs retry', error: String(error.message) });
      throw error;
    }
  }

  async _response(route, { method = 'GET', headers = {}, body, signal, timeoutMs = this.requestTimeoutMs } = {}) {
    check(signal);
    const u = new URL(route, this.endpoint);
    if (u.origin !== this.endpoint || !route.startsWith('/')) throw new Error('Invalid local engine request.');
    if (this.token) u.searchParams.set('token', this.token);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
    return new Promise((resolve, reject) => {
      const req = http.request(u, { method, headers, signal: combined }, res => {
        res.once('end', () => clearTimeout(timer));
        res.once('close', () => clearTimeout(timer));
        res.once('error', () => clearTimeout(timer));
        resolve(res);
      });
      req.once('error', error => { clearTimeout(timer); reject(error); });
      if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
        pipeline(Readable.from(body), req).catch(error => req.destroy(error));
      } else req.end(body);
    });
  }
  async _json(route, args = {}) {
    const options = { ...args };
    if (args.json !== undefined) {
      options.body = JSON.stringify(args.json);
      options.headers = { ...args.headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(options.body) };
    }
    const res = await this._response(route, options), chunks = []; let size = 0;
    for await (const chunk of res) {
      size += chunk.length;
      if (size > 1024 * 1024) { res.destroy(); throw new Error('The local engine returned an oversized response.'); }
      chunks.push(chunk);
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const e = new Error(`The local engine returned HTTP ${res.statusCode}.`); e.status = res.statusCode; e.taskMissing = res.statusCode === 404; throw e;
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('The local engine returned invalid JSON.'); }
    if (!data || typeof data !== 'object' || data.error || data.success === false) {
      const error = new Error('The local engine rejected this operation.');
      // NodeODM also represents missing tasks as a JSON error with HTTP 200.
      // Only a task/info response can authorize replacing an unfinished upload.
      error.taskMissing = /^\/task\/[^/]+\/info$/.test(route) && typeof data?.error === 'string' && /^(?:No task found|Task (?:not found|does not exist)|Invalid (?:task )?UUID)[.!]?$/i.test(data.error.trim());
      throw error;
    }
    return data;
  }
  async _multipart(route, fields, file, signal, headers = {}) {
    const boundary = 'axis-' + randomUUID();
    const chunks = [];
    for (const [name, value] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    let before, after;
    if (file) {
      // Stored names come from JobStore; user-controlled names never enter a multipart header.
      if (!/^[a-zA-Z0-9_.-]+$/.test(file.name)) throw new Error('Invalid stored image name.');
      before = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
      after = Buffer.from('\r\n');
    }
    const end = Buffer.from(`--${boundary}--\r\n`);
    const length = chunks.reduce((n, c) => n + c.length, 0) + (file ? before.length + file.size + after.length : 0) + end.length;
    async function* body() {
      for (const chunk of chunks) yield chunk;
      if (file) {
        yield before;
        const stream = fs.createReadStream(file.path, { signal });
        for await (const chunk of stream) yield chunk;
        yield after;
      }
      yield end;
    }
    return this._json(route, { method: 'POST', headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': length }, body: body(), signal, timeoutMs: this.transferTimeoutMs });
  }

  async _run(id, signal) {
    if (this.runner) return this._runNative(id, signal);
    let job = await this.get(id), info;
    if (job.engineEndpoint && job.engineEndpoint !== this.endpoint) throw new Error('This job belongs to a different local engine. Reconnect that engine before resuming.');
    await this._update(id, { status: 'starting', phase: 'Connecting to local engine', error: null, attempt: job.attempt + 1 }, signal);
    // Reuse durable tasks after processing/download interruptions. A partial upload is retried
    // under a fresh UUID; no processing task is removed automatically.
    if (job.taskId && job.taskCommitted) {
      info = await this._json(`/task/${job.taskId}/info`, { signal });
      if ([30, 50].includes(info.status?.code)) {
        await this._json('/task/restart', { method: 'POST', json: { uuid: job.taskId, options: JSON.stringify(optionsFor(job.preset)) }, signal });
        info = null;
      }
    } else {
      if (job.taskId) {
        // A crash may have happened after commit but before its manifest write. Consult the
        // engine first; on a transient error, fail safely instead of creating duplicate work.
        try { info = await this._json(`/task/${job.taskId}/info`, { signal }); }
        catch (e) { if (!e.taskMissing) throw new Error('The previous upload could not be verified. Retry when the local engine is available.'); }
        if (info?.status?.code) job = await this._update(id, { taskCommitted: true }, signal);
      }
      if (!job.taskCommitted) {
        const plannedId = randomUUID();
        job = await this._update(id, { taskId: plannedId, taskCommitted: false, engineEndpoint: this.endpoint, progress: 0, outputs: {} }, signal);
        const initialized = await this._multipart('/task/new/init', { name: job.name, options: JSON.stringify(optionsFor(job.preset)) }, null, signal, { 'set-uuid': plannedId });
        if (!UUID.test(initialized.uuid || '') || initialized.uuid !== plannedId) throw new Error('The local engine did not preserve the task identifier required for recovery.');
        await this._update(id, { status: 'uploading', phase: 'Uploading selected images to local engine' }, signal);
        let sent = 0;
        for (const input of job.inputs) {
          check(signal);
          const filePath = this.store.pathFor(id, input.relativePath), stat = await fsp.lstat(filePath);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== input.size) throw new Error('A stored input image changed. Create a new job from the original images.');
          await this._multipart(`/task/new/upload/${job.taskId}`, {}, { path: filePath, name: input.storedName, size: input.size }, signal);
          await this._update(id, { progress: Math.round(++sent / job.inputs.length * 25) }, signal);
        }
        const committed = await this._json(`/task/new/commit/${job.taskId}`, { method: 'POST', signal });
        if (committed.uuid !== job.taskId) throw new Error('The local engine did not confirm the submitted task.');
        job = await this._update(id, { taskCommitted: true }, signal);
      }
    }
    await this._update(id, { status: 'processing', phase: 'Processing images locally', progress: Math.max(25, job.progress) }, signal);
    let failures = 0;
    while (true) {
      check(signal);
      if (!info) {
        try { info = await this._json(`/task/${job.taskId}/info`, { signal }); failures = 0; }
        catch (error) {
          check(signal);
          if (++failures >= this.maxPollFailures) throw new Error(`Lost contact with the local engine after ${failures} attempts. The saved task can be resumed.`);
          await delay(this.pollIntervalMs, undefined, { signal }); continue;
        }
      }
      const code = info.status?.code;
      if (![10, 20, 30, 40, 50].includes(code)) throw new Error('The local engine returned an unrecognized task state.');
      if (code === 30) throw new Error('NodeODM could not process these images. Review the image set and retry.');
      if (code === 50) { await this._update(id, { status: 'canceled', phase: 'Canceled by local engine', error: null }, signal); return; }
      if (code === 40) break;
      const pct = Number(info.progress);
      await this._update(id, { progress: 25 + Math.round(Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0)) * 0.65), phase: code === 10 ? 'Queued in local engine' : 'Processing images locally' }, signal);
      info = null;
      await delay(this.pollIntervalMs, undefined, { signal });
    }
    await this._update(id, { status: 'downloading', phase: 'Saving and verifying outputs', progress: 92 }, signal);
    const archivePath = this.store.pathFor(id, 'output/all.zip');
    await fsp.mkdir(path.dirname(archivePath), { recursive: true });
    const archiveSize = await this._download(`/task/${job.taskId}/download/all.zip`, archivePath, signal);
    const outputs = await this._extractArchive(id, archivePath, signal);
    if (!outputs.orthophoto) throw new Error('The completed engine task did not contain an orthophoto. The task and inputs have been preserved.');
    outputs.archive = { relativePath: 'output/all.zip', size: archiveSize };
    await syncDirectory(path.dirname(archivePath));
    await this._update(id, { outputs, status: 'completed', phase: 'Completed — outputs saved locally', progress: 100, error: null }, signal);
  }

  async _runNative(id, signal) {
    let job = await this.get(id);
    await this._update(id, { status: 'starting', phase: 'Preparing native processing engine', error: null, attempt: job.attempt + 1, progress: 1 }, signal);
    job = await this.get(id);
    const outputs = await this.runner.run({ job, store: this.store, signal, onProgress: async (progress, phase) => {
      await this._update(id, { status: 'processing', progress: Math.max(2, Math.min(95, Math.round(progress))), phase: String(phase || 'Processing images locally').slice(0, 200) }, signal);
    }});
    if (!outputs?.orthophoto) throw new Error('The native processing engine did not produce an orthophoto. Inputs and logs were preserved.');
    await this._update(id, { outputs, status: 'completed', phase: 'Completed — outputs saved locally', progress: 100, error: null, taskCommitted: true }, signal);
  }

  async _download(route, destination, signal) {
    const res = await this._response(route, { signal, timeoutMs: this.transferTimeoutMs });
    if (res.statusCode < 200 || res.statusCode >= 300) { res.destroy(); throw new Error(`Output download returned HTTP ${res.statusCode}.`); }
    const declared = Number(res.headers['content-length']);
    if (Number.isFinite(declared) && declared > this.maxArchiveBytes) { res.destroy(); throw new Error('The output archive exceeds the local size limit.'); }
    const temporary = destination + '.' + randomUUID() + '.part'; let size = 0;
    const limit = this.maxArchiveBytes;
    try {
      await pipeline(res, new Transform({ transform(chunk, encoding, callback) {
        size += chunk.length; callback(size > limit ? new Error('The output archive exceeds the local size limit.') : null, chunk);
      } }), fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }), { signal });
      if (!size || (Number.isFinite(declared) && declared > 0 && size !== declared)) throw new Error('The output archive download was incomplete.');
      await syncFile(temporary); check(signal); await fsp.rename(temporary, destination); return size;
    } finally { await fsp.rm(temporary, { force: true }).catch(() => {}); }
  }

  async _extractArchive(id, archive, signal) {
    const yauzl = require('yauzl');
    const zip = await new Promise((resolve, reject) => yauzl.open(archive, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (e, z) => e ? reject(e) : resolve(z)));
    const outputs = {}, seen = new Set(); let entries = 0, expanded = 0;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return; settled = true; signal?.removeEventListener('abort', onAbort); zip.close();
        error ? reject(error) : resolve(outputs);
      };
      const onAbort = () => finish(aborted());
      signal?.addEventListener('abort', onAbort, { once: true });
      zip.on('error', finish);
      zip.on('end', () => finish());
      zip.on('entry', entry => { void (async () => {
        check(signal);
        const unixType = (entry.externalFileAttributes >>> 16) & 0xf000;
        expanded += entry.uncompressedSize;
        if (++entries > this.maxArchiveEntries || expanded > this.maxExtractedBytes) throw new Error('The output archive exceeds the extraction limit.');
        if (!safeArchiveName(entry.fileName) || unixType === 0xa000 || (entry.generalPurposeBitFlag & 1)) throw new Error('The output archive contains an unsafe file entry.');
        if (seen.has(entry.fileName)) throw new Error('The output archive contains duplicate paths.');
        seen.add(entry.fileName);
        const target = OUTPUTS[entry.fileName];
        if (target) {
          if (!entry.uncompressedSize) throw new Error('A required output file is empty.');
          const [key, fileName] = target, destination = this.store.pathFor(id, 'output/' + fileName), temporary = destination + '.' + randomUUID() + '.part';
          const stream = await new Promise((resolveStream, rejectStream) => zip.openReadStream(entry, (e, s) => e ? rejectStream(e) : resolveStream(s)));
          let size = 0, crc = 0xffffffff;
          try {
            await pipeline(stream, new Transform({ transform(chunk, encoding, callback) {
              size += chunk.length;
              for (const byte of chunk) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
              callback(size > entry.uncompressedSize ? new Error('An output file exceeded its declared size.') : null, chunk);
            } }), fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }), { signal });
            if (size !== entry.uncompressedSize || ((crc ^ 0xffffffff) >>> 0) !== entry.crc32) throw new Error('An output file failed its integrity check.');
            if (key === 'orthophoto' || key === 'dsm') {
              const h = await fsp.open(temporary, 'r'), header = Buffer.alloc(4);
              try { await h.read(header, 0, 4, 0); } finally { await h.close(); }
              if (!['49492a00', '4d4d002a', '49492b00', '4d4d002b'].includes(header.toString('hex'))) throw new Error('The engine output is not a TIFF image.');
            }
            await syncFile(temporary); check(signal); await fsp.rename(temporary, destination);
            outputs[key] = { relativePath: 'output/' + fileName, size };
          } finally { await fsp.rm(temporary, { force: true }).catch(() => {}); }
        }
        if (!settled) zip.readEntry();
      })().catch(finish); });
      if (signal?.aborted) onAbort(); else zip.readEntry();
    });
  }
}

module.exports = { OrthoService, loopbackEndpoint, optionsFor };
