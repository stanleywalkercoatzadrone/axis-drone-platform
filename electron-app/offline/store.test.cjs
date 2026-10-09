'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { JobStore } = require('./store.cjs');

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'axis-offline-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dataDir = path.join(root, 'jobs');
  const source = path.join(root, 'image.JPG');
  await fs.writeFile(source, Buffer.from([1, 2, 3, 4]));
  return { root, dataDir, source, store: new JobStore({ dataDir, ...options }) };
}

async function makeJob(f) {
  return f.store.create({ name: 'Survey', files: [f.source], preset: 'standard' });
}

test('constructor validates configuration without creating files', async t => {
  const f = await fixture(t);
  await assert.rejects(fs.stat(f.dataDir), { code: 'ENOENT' });
  assert.throws(() => new JobStore({ dataDir: './jobs' }), /absolute/);
  assert.throws(() => new JobStore({ dataDir: f.dataDir, maxFiles: 0 }), /positive integer/);
  assert.throws(() => new JobStore({ dataDir: f.dataDir, maxFileBytes: Infinity }), /positive integer/);
  assert.throws(() => new JobStore({ dataDir: f.dataDir, maxBatchBytes: -1 }), /positive integer/);
});

test('copies duplicate filenames safely and stores no original absolute paths', async t => {
  const f = await fixture(t);
  const other = path.join(f.root, 'another', 'image.JPG');
  await fs.mkdir(path.dirname(other));
  await fs.writeFile(other, 'other-image');
  const job = await f.store.create({ name: '  Two flights  ', files: [f.source, other], preset: 'fast' });
  assert.match(job.id, /^[a-f0-9-]{36}$/);
  assert.equal(job.name, 'Two flights');
  assert.equal(job.status, 'ready');
  assert.equal(job.taskId, null);
  assert.equal(job.taskCommitted, false);
  assert.equal(job.engineEndpoint, null);
  assert.equal(job.attempt, 0);
  assert.equal(job.inputs.length, 2);
  assert.notEqual(job.inputs[0].storedName, job.inputs[1].storedName);
  assert.equal(job.inputs[0].name, 'image.JPG');
  assert.equal(job.inputs[0].size, 4);
  assert.equal(job.inputs[1].size, 11);
  for (const [index, source] of [f.source, other].entries()) {
    assert.deepEqual(await fs.readFile(f.store.pathFor(job.id, job.inputs[index].relativePath)), await fs.readFile(source));
  }
  const raw = await fs.readFile(f.store.pathFor(job.id, 'manifest.json'), 'utf8');
  assert.equal(raw.includes(f.root), false);
  assert.deepEqual(await f.store.list(), [job]);
  assert.deepEqual(await fs.readdir(f.store.pathFor(job.id)), ['inputs', 'manifest.json', 'output']);
});

test('reopened store recovers persisted engine state and verifies output metadata', async t => {
  const f = await fixture(t);
  const job = await makeJob(f);
  const outputPath = f.store.pathFor(job.id, 'output/orthomosaic.tif');
  await fs.writeFile(outputPath, 'geotiff');
  const taskId = randomUUID();
  const updated = await f.store.update(job.id, {
    status: 'completed', progress: 100, phase: 'complete', taskId, taskCommitted: true,
    engineEndpoint: 'http://127.0.0.1:58000', attempt: 1,
    outputs: { orthomosaic: { relativePath: 'output/orthomosaic.tif', size: 7 } },
  });
  const reopened = new JobStore({ dataDir: f.dataDir });
  assert.deepEqual(await reopened.get(job.id), updated);
  assert.equal(updated.createdAt, job.createdAt);
  assert.equal(await reopened.getOutputPath(job.id, 'orthomosaic'), await fs.realpath(outputPath));
  await assert.rejects(reopened.getOutputPath(job.id, 'not-listed'), { code: 'OUTPUT_NOT_FOUND' });
  await fs.writeFile(outputPath, 'changed-size');
  await assert.rejects(reopened.getOutputPath(job.id, 'orthomosaic'), { code: 'OUTPUT_CHANGED' });
  await fs.unlink(outputPath);
  await assert.rejects(reopened.getOutputPath(job.id, 'orthomosaic'), { code: 'OUTPUT_NOT_FOUND' });
});

test('rejects invalid selections and batch limits before creating jobs', async t => {
  const f = await fixture(t, { maxFiles: 1, maxFileBytes: 4, maxBatchBytes: 4 });
  const bad = path.join(f.root, 'image.exe');
  await fs.writeFile(bad, 'data');
  const empty = path.join(f.root, 'empty.png');
  await fs.writeFile(empty, '');
  const large = path.join(f.root, 'large.tif');
  await fs.writeFile(large, '12345');
  const directory = path.join(f.root, 'directory.png');
  await fs.mkdir(directory);
  for (const files of [[], [f.source, f.source], ['relative.jpg'], [bad], [empty], [large], [directory]]) {
    await assert.rejects(f.store.create({ name: 'Invalid', files }));
  }
  await assert.rejects(f.store.create({ name: '  ', files: [f.source] }), /name/);
  await assert.rejects(f.store.create({ name: 'Invalid', files: [f.source], preset: 'high' }), /preset/);
  const batchStore = new JobStore({ dataDir: f.dataDir, maxFiles: 2, maxFileBytes: 4, maxBatchBytes: 7 });
  await assert.rejects(batchStore.create({ name: 'Too much', files: [f.source, f.source] }), { code: 'INPUT_LIMIT' });
  assert.deepEqual(await f.store.list(), []);
});

test('rejects input symlinks without modifying their targets', async t => {
  const f = await fixture(t);
  const link = path.join(f.root, 'linked.jpg');
  try { await fs.symlink(f.source, link); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Symlinks need Windows privilege.'); throw error; }
  await assert.rejects(f.store.create({ name: 'Link', files: [link] }), /regular file/);
  assert.deepEqual(await fs.readFile(f.source), Buffer.from([1, 2, 3, 4]));
  assert.deepEqual(await f.store.list(), []);
});

test('serializes concurrent updates without losing unrelated fields', async t => {
  const f = await fixture(t);
  const job = await makeJob(f);
  const other = new JobStore({ dataDir: f.dataDir });
  await Promise.all([
    f.store.update(job.id, { status: 'processing' }),
    other.update(job.id, { progress: 42 }),
    f.store.update(job.id, { phase: 'dense point cloud' }),
    other.update(job.id, { attempt: 3 }),
  ]);
  const saved = await f.store.get(job.id);
  assert.equal(saved.status, 'processing');
  assert.equal(saved.progress, 42);
  assert.equal(saved.phase, 'dense point cloud');
  assert.equal(saved.attempt, 3);
  assert.deepEqual((await fs.readdir(f.store.pathFor(job.id))).filter(name => name.endsWith('.tmp')), []);
});

test('invalid update cannot corrupt existing manifest or poison its update queue', async t => {
  const f = await fixture(t);
  const job = await makeJob(f);
  const invalid = [
    { id: randomUUID() }, { inputs: [] }, { createdAt: 'today' }, { status: 'unknown' },
    { progress: -1 }, { progress: NaN }, { error: {} }, { taskId: '../task' },
    { taskCommitted: 'yes' }, { attempt: -1 }, { engineEndpoint: 'https://example.com' },
    { engineEndpoint: 'http://127.0.0.1:58000/task' }, { engineEndpoint: 'http://user:pass@localhost:58000' },
    { outputs: { ortho: { relativePath: 'output/../../escape.tif', size: 1 } } },
    { outputs: { ortho: { relativePath: 'inputs/image.jpg', size: 1 } } },
  ];
  for (const patch of invalid) {
    await assert.rejects(f.store.update(job.id, patch));
    assert.deepEqual(await f.store.get(job.id), job);
  }
  await assert.rejects(f.store.update(job.id, { progress: 101 }));
  assert.equal((await f.store.update(job.id, { progress: 1 })).progress, 1);
});

test('captures mutable update values before waiting for an earlier write', async t => {
  const f = await fixture(t);
  const job = await makeJob(f);
  const patch = { outputs: { ortho: { relativePath: 'output/a.tif', size: 1 } } };
  const pending = f.store.update(job.id, patch);
  patch.outputs.ortho.relativePath = '../outside';
  await pending;
  assert.equal((await f.store.get(job.id)).outputs.ortho.relativePath, 'output/a.tif');
});

test('pathFor rejects traversal, absolute paths, separators and symlink descendants', async t => {
  const f = await fixture(t);
  const job = await makeJob(f);
  assert.throws(() => f.store.pathFor('../outside', 'file'), /UUID/);
  for (const relative of ['../escape', '/tmp/escape', 'C:\\escape', 'output/file:stream', 'output/../escape', 'output//file', 'output\\file', 'output/./file', 'output/file\0']) {
    assert.throws(() => f.store.pathFor(job.id, relative), { code: 'UNSAFE_PATH' });
  }
  const outside = path.join(f.root, 'outside');
  await fs.mkdir(outside);
  try { await fs.symlink(outside, f.store.pathFor(job.id, 'output/link'), 'dir'); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Symlinks need Windows privilege.'); throw error; }
  assert.throws(() => f.store.pathFor(job.id, 'output/link/file.tif'), { code: 'UNSAFE_PATH' });
});

test('output retrieval refuses directories, output symlinks and symlinked jobs', async t => {
  const f = await fixture(t);
  const job = await makeJob(f);
  const outputDir = f.store.pathFor(job.id, 'output/directory.tif');
  await fs.mkdir(outputDir);
  await f.store.update(job.id, { outputs: { ortho: { relativePath: 'output/directory.tif', size: 0 } } });
  await assert.rejects(f.store.getOutputPath(job.id, 'ortho'), { code: 'UNSAFE_PATH' });
  const outputLink = f.store.pathFor(job.id, 'output/link.tif');
  try { await fs.symlink(f.source, outputLink); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Symlinks need Windows privilege.'); throw error; }
  await f.store.update(job.id, { outputs: { ortho: { relativePath: 'output/link.tif', size: 4 } } });
  await assert.rejects(f.store.getOutputPath(job.id, 'ortho'), { code: 'UNSAFE_PATH' });
  const alias = randomUUID();
  await fs.symlink(f.store.pathFor(job.id), path.join(f.dataDir, alias), 'dir');
  await assert.rejects(f.store.get(alias), { code: 'UNSAFE_PATH' });
  const unavailable = (await f.store.list()).find(row => row.id === alias);
  assert.equal(unavailable.status, 'unavailable');
});

test('lists corrupt, incomplete and unsupported manifests explicitly and preserves their files', async t => {
  const f = await fixture(t);
  const good = await makeJob(f);
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  for (const id of ids) await fs.mkdir(path.join(f.dataDir, id));
  await fs.writeFile(path.join(f.dataDir, ids[0], 'manifest.json'), '{broken');
  await fs.writeFile(path.join(f.dataDir, ids[2], 'manifest.json'), JSON.stringify({ ...good, id: ids[2], schemaVersion: 9 }));
  const existing = path.join(f.dataDir, 'existing-folder');
  await fs.mkdir(existing);
  await fs.writeFile(path.join(existing, 'keep.txt'), 'do not delete');
  const rows = await f.store.list();
  assert.equal(rows.length, 5);
  for (const id of [...ids, 'existing-folder']) {
    const row = rows.find(value => value.id === id);
    assert.equal(row.status, 'unavailable');
    assert.match(row.error, /Could not read saved job/);
  }
  await assert.rejects(f.store.get(ids[0]), { code: 'CORRUPT_MANIFEST' });
  await assert.rejects(f.store.get(ids[1]), { code: 'JOB_NOT_FOUND' });
  await assert.rejects(f.store.update(ids[0], { status: 'failed' }));
  assert.equal(await fs.readFile(path.join(existing, 'keep.txt'), 'utf8'), 'do not delete');
  assert.deepEqual(await f.store.get(good.id), good);
});

test('ignores an interrupted temporary manifest while retaining the committed job', async t => {
  const f = await fixture(t);
  const job = await makeJob(f);
  const leftover = f.store.pathFor(job.id, '.manifest-interrupted.tmp');
  await fs.writeFile(leftover, '{truncated');
  const reopened = new JobStore({ dataDir: f.dataDir });
  assert.deepEqual(await reopened.get(job.id), job);
  await reopened.update(job.id, { status: 'interrupted', error: 'Application stopped.' });
  assert.equal(await fs.readFile(leftover, 'utf8'), '{truncated');
  assert.equal((await reopened.list())[0].status, 'interrupted');
});
