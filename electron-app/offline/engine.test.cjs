'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { OrthoService, loopbackEndpoint } = require('./engine.cjs');

const TIFF = Buffer.from('49492a0008000000000000000000', 'hex');
function crc32(bytes) {
  let n = 0xffffffff;
  for (const byte of bytes) { n ^= byte; for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; }
  return (n ^ 0xffffffff) >>> 0;
}
// Tiny stored ZIP fixtures exercise the real streaming extractor, without image processing.
function zip(entries) {
  const files = [], directory = []; let offset = 0;
  for (const [name, value, badCrc = false] of entries) {
    const filename = Buffer.from(name), bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const crc = (crc32(bytes) + (badCrc ? 1 : 0)) >>> 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    files.push(local, filename, bytes);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, filename); offset += local.length + filename.length + bytes.length;
  }
  const end = Buffer.alloc(22), dir = Buffer.concat(directory); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, dir, end]);
}
async function setup(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'axis-ortho-engine-'));
  const source = path.join(directory, 'image.jpg'); await fs.writeFile(source, 'fixture-image-bytes');
  const state = { tasks: new Map(), requests: [], running: false, failures: false, hangInfo: false, initError: false, commitDisconnect: false,
    archive: zip([['odm_orthophoto/odm_orthophoto.tif', TIFF], ['odm_dem/dsm.tif', TIFF], ['odm_report/report.pdf', '%PDF-1.4\nfixture'], ['ignored.txt', 'not extracted']]) };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1'), body = [];
    for await (const chunk of req) body.push(chunk);
    const bytes = Buffer.concat(body); state.requests.push({ method: req.method, path: url.pathname, query: url.searchParams, headers: req.headers, body: bytes });
    const respond = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (url.pathname === '/task/new/init') {
      if (state.initError) return respond({ error: 'Engine refused input' });
      const id = req.headers['set-uuid']; state.tasks.set(id, { code: 0, uploads: 0 }); return respond({ uuid: id });
    }
    const upload = url.pathname.match(/^\/task\/new\/upload\/(.+)$/);
    if (upload) { state.tasks.get(upload[1]).uploads++; return respond({ success: true }); }
    const commit = url.pathname.match(/^\/task\/new\/commit\/(.+)$/);
    if (commit) { state.tasks.get(commit[1]).code = state.running ? 20 : 40; if (state.commitDisconnect) { req.socket.destroy(); return; } return respond({ uuid: commit[1] }); }
    const info = url.pathname.match(/^\/task\/(.+)\/info$/);
    if (info) {
      if (state.hangInfo) return;
      if (state.failures) return respond({ error: 'Temporary failure' }, 500);
      const task = state.tasks.get(info[1]); if (!task || !task.code) return respond({ error: 'Task not found' }, 404);
      return respond({ status: { code: task.code }, progress: task.code === 40 ? 100 : 12 });
    }
    if (url.pathname === '/task/cancel' || url.pathname === '/task/restart') {
      const { uuid } = JSON.parse(bytes); state.tasks.get(uuid).code = url.pathname === '/task/cancel' ? 50 : 40; return respond({ success: true });
    }
    if (/^\/task\/.+\/download\/all.zip$/.test(url.pathname)) { res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': state.archive.length }); res.end(state.archive); return; }
    respond({ error: 'Unexpected route' }, 404);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const settings = { dataDir: path.join(directory, 'jobs'), endpoint: `http://127.0.0.1:${server.address().port}`, token: 'fixture-token', pollIntervalMs: 5, requestTimeoutMs: 200, transferTimeoutMs: 1000, maxPollFailures: 3, ...overrides };
  const service = new OrthoService(settings), services = [service];
  t.after(async () => { await Promise.all(services.map(s => s.shutdown())); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); });
  return { service, state, source, directory, settings, replacement() { const s = new OrthoService(settings); services.push(s); return s; } };
}
async function processing(service, id) {
  for (let i = 0; i < 100; i++) { const job = await service.get(id); if (job.status === 'processing') return job; if (job.status === 'failed') assert.fail(job.error); await delay(5); }
  assert.fail('Expected processing state');
}

test('only literal loopback endpoints are accepted', () => {
  assert.equal(loopbackEndpoint('http://127.0.0.1:58000/'), 'http://127.0.0.1:58000');
  for (const endpoint of ['https://example.com', 'http://localhost:58000', 'http://127.0.0.1:58000/path', 'http://secret@127.0.0.1', 'http://127.0.0.1?token=secret']) assert.throws(() => loopbackEndpoint(endpoint), /loopback/);
});
test('streams images with init options and completes only with locally verified outputs', async t => {
  const { service, state, source, directory } = await setup(t);
  const second = path.join(directory, 'other', 'image.jpg'); await fs.mkdir(path.dirname(second)); await fs.writeFile(second, 'second-image-bytes');
  const job = await service.create({ name: 'Local test', files: [source, second], preset: 'fast' });
  const changes = []; service.on('change', j => changes.push(j));
  await service.start(job.id); await service.whenIdle(job.id);
  const saved = await service.get(job.id); assert.equal(saved.status, 'completed', saved.error); assert.equal(saved.progress, 100);
  assert.deepEqual(await fs.readFile(await service.getOutputPath(job.id, 'orthophoto')), TIFF);
  assert.deepEqual(Object.keys(saved.outputs).sort(), ['archive', 'dsm', 'orthophoto', 'report']);
  const init = state.requests.find(r => r.path === '/task/new/init'); assert.match(init.body.toString(), /name="options"/); assert.match(init.body.toString(), /"fast-orthophoto","value":true/);
  assert.ok(state.requests.every(r => r.query.get('token') === 'fixture-token'));
  const uploads = state.requests.filter(r => r.path.includes('/upload/')); assert.equal(uploads.length, 2); assert.notEqual(saved.inputs[0].storedName, saved.inputs[1].storedName);
  assert.ok(uploads.every(r => Number(r.headers['content-length']) === r.body.length));
  assert.ok(changes.filter(j => j.status !== 'completed').every(j => j.progress < 100));
  assert.ok(!state.requests.some(r => r.path.includes('remove')));
});
test('missing orthophoto never becomes completed and preserves task for output retry', async t => {
  const { service, state, source } = await setup(t); state.archive = zip([['odm_report/report.pdf', 'report']]);
  const job = await service.create({ name: 'Missing output', files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
  let saved = await service.get(job.id); assert.equal(saved.status, 'failed'); assert.match(saved.error, /orthophoto/); assert.equal(saved.taskCommitted, true); assert.deepEqual(saved.outputs, {});
  state.archive = zip([['odm_orthophoto/odm_orthophoto.tif', TIFF]]); await service.start(job.id); await service.whenIdle(job.id);
  saved = await service.get(job.id); assert.equal(saved.status, 'completed', saved.error); assert.equal(state.requests.filter(r => r.path === '/task/new/init').length, 1);
});
test('HTTP poll failures are bounded and explicit retry resumes saved UUID', async t => {
  const { service, state, source } = await setup(t); state.failures = true;
  const job = await service.create({ name: 'Failure recovery', files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
  const failed = await service.get(job.id); assert.equal(failed.status, 'failed'); assert.match(failed.error, /3 attempts/);
  assert.equal(state.requests.filter(r => r.path.endsWith('/info')).length, 3);
  state.failures = false; await service.start(job.id); await service.whenIdle(job.id);
  assert.equal((await service.get(job.id)).status, 'completed'); assert.equal((await service.get(job.id)).taskId, failed.taskId);
});
test('shutdown and recover resume committed task without a second upload', async t => {
  const setupData = await setup(t); const { service, state, source } = setupData; state.running = true;
  const job = await service.create({ name: 'Restart', files: [source], preset: 'standard' }); await service.start(job.id); const running = await processing(service, job.id);
  await service.shutdown(); assert.equal((await service.get(job.id)).status, 'interrupted'); state.tasks.get(running.taskId).code = 40;
  const next = setupData.replacement(); await next.recover(); await next.whenIdle();
  assert.equal((await next.get(job.id)).status, 'completed'); assert.equal(state.requests.filter(r => r.path.includes('/upload/')).length, 1);
});
test('cancellation reaches NodeODM and retry restarts the same task', async t => {
  const { service, state, source } = await setup(t); state.running = true;
  const job = await service.create({ name: 'Cancel', files: [source], preset: 'standard' }); await service.start(job.id); const running = await processing(service, job.id);
  assert.equal((await service.cancel(job.id)).status, 'canceled');
  const canceled = state.requests.find(r => r.path === '/task/cancel'); assert.equal(JSON.parse(canceled.body).uuid, running.taskId);
  await service.start(job.id); await service.whenIdle(job.id); assert.equal((await service.get(job.id)).status, 'completed'); assert.equal(state.requests.filter(r => r.path === '/task/restart').length, 1);
});
test('a lost commit response recovers the existing task instead of creating duplicate work', async t => {
  const { service, state, source } = await setup(t); state.commitDisconnect = true;
  const job = await service.create({ name: 'Lost commit', files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
  assert.equal((await service.get(job.id)).status, 'failed'); assert.equal((await service.get(job.id)).taskCommitted, false);
  state.commitDisconnect = false; await service.start(job.id); await service.whenIdle(job.id);
  assert.equal((await service.get(job.id)).status, 'completed'); assert.equal(state.requests.filter(r => r.path === '/task/new/init').length, 1);
});
test('HTTP 200 errors do not upload or report completion', async t => {
  const { service, state, source } = await setup(t); state.initError = true;
  const job = await service.create({ name: 'Rejected', files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
  assert.equal((await service.get(job.id)).status, 'failed'); assert.equal(state.requests.length, 1);
});
test('a lost commit response still cancels the task that may already be running', async t => {
  const { service, state, source } = await setup(t); state.commitDisconnect = true; state.running = true;
  const job = await service.create({ name: 'Unconfirmed commit', files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
  const failed = await service.get(job.id); assert.equal(failed.taskCommitted, false); assert.equal(state.tasks.get(failed.taskId).code, 20);
  assert.equal((await service.cancel(job.id)).status, 'canceled'); assert.equal(state.tasks.get(failed.taskId).code, 50);
});
test('stalled HTTP requests time out and count toward the bounded retry limit', async t => {
  const { service, state, source } = await setup(t, { requestTimeoutMs: 20, maxPollFailures: 2 }); state.hangInfo = true;
  const job = await service.create({ name: 'Timeout', files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
  const saved = await service.get(job.id); assert.equal(saved.status, 'failed'); assert.match(saved.error, /2 attempts/); assert.equal(state.requests.filter(r => r.path.endsWith('/info')).length, 2);
});
test('archive download and extraction limits prevent false completion', async t => {
  const { service, state, source, settings } = await setup(t, { maxArchiveBytes: 20 });
  const job = await service.create({ name: 'Large archive', files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
  assert.equal((await service.get(job.id)).status, 'failed'); assert.match((await service.get(job.id)).error, /size limit/);
  service.maxArchiveBytes = settings.maxArchiveBytes = 100000; service.maxExtractedBytes = 10;
  await service.start(job.id); await service.whenIdle(job.id); assert.equal((await service.get(job.id)).status, 'failed'); assert.match((await service.get(job.id)).error, /extraction limit/);
  assert.equal(state.requests.filter(r => r.path === '/task/new/init').length, 1);
});
test('unsafe archive paths, invalid TIFFs, and corrupt file CRCs are rejected', async t => {
  const { service, state, source, directory } = await setup(t);
  for (const [name, archive] of [
    ['Traversal', zip([['../escape.tif', TIFF], ['odm_orthophoto/odm_orthophoto.tif', TIFF]])],
    ['Invalid TIFF', zip([['odm_orthophoto/odm_orthophoto.tif', 'not a TIFF']])],
    ['Bad CRC', zip([['odm_orthophoto/odm_orthophoto.tif', TIFF, true]])],
  ]) {
    state.archive = archive; const job = await service.create({ name, files: [source], preset: 'standard' }); await service.start(job.id); await service.whenIdle(job.id);
    assert.equal((await service.get(job.id)).status, 'failed', name); await assert.rejects(service.getOutputPath(job.id, 'orthophoto'));
  }
  await assert.rejects(fs.access(path.join(directory, 'escape.tif')));
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('shutdown and whenIdle wait for an import even before its job ID is allocated', async () => {
  const entered = deferred(), finish = deferred();
  const job = { id: '11111111-1111-4111-8111-111111111111', status: 'ready' };
  const service = new OrthoService({ store: { create: async () => { entered.resolve(); await finish.promise; return job; } } });
  const creating = service.create({ name: 'Pending import' });
  let idle = false, stopped = false;
  const idlePromise = service.whenIdle().then(() => { idle = true; });
  await entered.promise;
  const stopping = service.shutdown().then(() => { stopped = true; });
  await delay(5);
  assert.equal(idle, false); assert.equal(stopped, false);
  await assert.rejects(service.create({ name: 'Too late' }), /closing/);
  finish.resolve();
  assert.equal(await creating, job);
  await Promise.all([idlePromise, stopping]);
  assert.equal(idle, true); assert.equal(stopped, true); assert.equal(service.imports.size, 0);
});

test('active imports show progress instead of unavailable while an existing orphan stays unchanged', async () => {
  const entered = deferred(), finish = deferred();
  const id = '22222222-2222-4222-8222-222222222222';
  const orphan = { id: '33333333-3333-4333-8333-333333333333', status: 'unavailable', error: 'Existing incomplete import', createdAt: '2026-01-01T00:00:00.000Z' };
  const progress = { id, name: 'Import test', preset: 'standard', createdAt: '2026-02-01T00:00:00.000Z', totalFiles: 2, copiedFiles: 0, totalBytes: 20, copiedBytes: 0 };
  let saved = null;
  const service = new OrthoService({ store: {
    create: async (_details, { onProgress }) => {
      onProgress(progress); onProgress({ ...progress, copiedFiles: 1, copiedBytes: 10 }); entered.resolve();
      await finish.promise;
      saved = { id, status: 'ready', inputs: [{}, {}], createdAt: progress.createdAt }; return saved;
    },
    list: async () => [orphan, saved || { id, status: 'unavailable', error: 'No manifest yet' }],
    get: async () => { if (!saved) throw new Error('No manifest yet'); return saved; },
  } });
  const events = []; service.on('change', job => events.push(job));
  const creating = service.create({ name: 'Import test' }); await entered.promise;
  try {
    const rows = await service.list(), importing = rows.find(row => row.id === id);
    assert.deepEqual(rows.find(row => row.id === orphan.id), orphan);
    assert.equal(importing.status, 'importing'); assert.equal(importing.progress, 50);
    assert.equal(importing.phase, 'Importing 1/2 images'); assert.equal(importing.importProgress.totalFiles, 2);
    assert.equal((await service.get(id)).status, 'importing');
    importing.importProgress.totalFiles = 999;
    assert.equal((await service.get(id)).importProgress.totalFiles, 2);
    await assert.rejects(service.start(id), /import finishes/);
    await assert.rejects(service.cancel(id), /import finishes/);
    let settled = false;
    const waiting = service.whenIdle(id).then(() => { settled = true; });
    await delay(5); assert.equal(settled, false);
    finish.resolve(); await creating; await waiting;
    assert.equal((await service.get(id)).status, 'ready');
    assert.equal((await service.list()).find(row => row.id === id).status, 'ready');
    assert.deepEqual(events.map(row => row.status), ['importing', 'importing', 'ready']);
  } finally { finish.resolve(); await creating; await service.shutdown(); }
});

test('one failed import does not let shutdown bypass another pending import', async () => {
  const first = deferred(), second = deferred(), entered = deferred();
  let count = 0;
  const service = new OrthoService({ store: { create: async details => {
    if (++count === 2) entered.resolve();
    await (details.name === 'first' ? first : second).promise;
    return { id: details.name, status: 'ready' };
  } } });
  const failed = assert.rejects(service.create({ name: 'first' }), /Copy failed/);
  const creating = service.create({ name: 'second' }); await entered.promise;
  let stopped = false;
  const stopping = service.shutdown().then(() => { stopped = true; });
  first.reject(new Error('Copy failed')); await failed; await delay(5);
  assert.equal(stopped, false);
  second.resolve(); await creating; await stopping;
  assert.equal(stopped, true); assert.equal(service.imports.size, 0);
});

test('real input copies emit bounded import progress without source paths or a format change', async t => {
  const { service, source, directory } = await setup(t);
  const second = path.join(directory, 'second.png'); await fs.writeFile(second, 'second-source');
  const events = []; service.on('change', job => events.push(job));
  const job = await service.create({ name: 'Two inputs', files: [source, second], preset: 'standard' });
  const importing = events.filter(row => row.status === 'importing');
  assert.deepEqual(importing.map(row => row.importProgress.copiedFiles), [0, 1, 2]);
  assert.ok(importing.every(row => row.progress >= 0 && row.progress <= 100));
  assert.equal(importing.at(-1).progress, 100);
  assert.equal(JSON.stringify(importing).includes(directory), false);
  assert.equal(job.status, 'ready'); assert.equal(job.inputs.length, 2);
  assert.equal(Object.hasOwn(job, 'importProgress'), false);
  assert.equal((await service.get(job.id)).status, 'ready');
});
