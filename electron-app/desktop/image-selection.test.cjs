'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { collectImages } = require('./image-selection.cjs');

const normalAttributes = async paths => new Map(paths.map(value => [value, 0]));

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'axis-image-selection-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (relative, content = 'image-data') => {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
    return file;
  };
  return { root, write };
}

async function select(paths, options = {}) {
  return collectImages({ paths, recursive: true, readAttributes: normalAttributes, ...options });
}

function assertFiles(result, expected) {
  assert.deepEqual([...result.files].sort(), [...expected].sort());
  assert.equal(result.summary.supported, expected.length);
  assert.equal(result.display.length, expected.length);
  assert.equal(new Set(result.files).size, result.files.length);
  for (const file of result.files) assert.equal(path.isAbsolute(file), true);
  for (const display of result.display) {
    assert.deepEqual(Object.keys(display).sort(), ['name', 'size']);
    assert.equal(path.basename(display.name), display.name);
    assert.equal(Number.isSafeInteger(display.size), true);
    assert.ok(display.size > 0);
  }
}

test('recursive selection accepts supported uppercase extensions and preserves repeated basenames', async t => {
  const f = await fixture(t);
  const expected = await Promise.all([
    f.write('capture/flight.JPG', 'first'),
    f.write('capture/nested/flight.JPG', 'second'),
    f.write('capture/nested/frame.JpEg'),
    f.write('capture/nested/deeper/frame.PNG'),
    f.write('capture/elevation.TIF'),
    f.write('capture/orthophoto.TIFF'),
  ]);
  const result = await select([path.join(f.root, 'capture')]);
  assertFiles(result, expected);
  assert.equal(result.display.filter(row => row.name === 'flight.JPG').length, 2);
  assert.equal(result.display.filter(row => row.name === 'flight.JPG').map(row => row.size).sort().join(','), '5,6');
  assert.equal(result.summary.foldersScanned, 3);
  assert.equal(JSON.stringify(result.display).includes(f.root), false);
});

test('nonrecursive folder selection includes immediate files and prunes nested directories', async t => {
  const f = await fixture(t);
  const immediate = await f.write('capture/top.png');
  await f.write('capture/nested/deep.jpg');
  const result = await select([path.join(f.root, 'capture')], { recursive: false });
  assertFiles(result, [immediate]);
  assert.equal(result.summary.foldersScanned, 1);
  assert.ok(result.summary.skippedReasons.invalid >= 1);
});

test('dotfiles, hidden folders and known system files are pruned', async t => {
  const f = await fixture(t);
  const keep = await f.write('capture/keep.jpg');
  await Promise.all([
    f.write('capture/.hidden.JPG'),
    f.write('capture/.hidden-folder/hidden.jpg'),
    f.write('capture/__MACOSX/entry.jpg'),
    f.write('capture/Thumbs.db'),
    f.write('capture/desktop.ini'),
  ]);
  const result = await select([path.join(f.root, 'capture')]);
  assertFiles(result, [keep]);
  assert.ok(result.summary.skippedReasons.hidden >= 2);
  assert.ok(result.summary.skippedReasons.system >= 3);
  assert.equal(result.summary.foldersScanned, 1);
});

test('file and directory symlinks are never followed', async t => {
  const f = await fixture(t);
  const keep = await f.write('capture/keep.jpg');
  const outside = await f.write('outside/remote.jpg');
  try {
    await fs.symlink(outside, path.join(f.root, 'capture', 'linked.jpg'));
    await fs.symlink(path.dirname(outside), path.join(f.root, 'capture', 'linked-folder'), 'dir');
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Creating symlinks requires Windows privilege.');
    throw error;
  }
  const result = await select([path.join(f.root, 'capture')]);
  assertFiles(result, [keep]);
  assert.equal(result.summary.skippedReasons.symlink, 2);
  assert.equal(result.summary.foldersScanned, 1);
  const explicitlySelected = await select([path.join(f.root, 'capture', 'linked.jpg'), path.join(f.root, 'capture', 'linked-folder')]);
  assertFiles(explicitlySelected, []);
  assert.equal(explicitlySelected.summary.skippedReasons.symlink, 2);
  assert.equal(await fs.readFile(outside, 'utf8'), 'image-data');
});

test('overlapping roots and repeated explicit files produce one copy of each path', async t => {
  const f = await fixture(t);
  const top = await f.write('capture/top.jpg');
  const nested = await f.write('capture/nested/frame.png');
  const result = await select([
    path.join(f.root, 'capture'), path.join(f.root, 'capture', 'nested'), nested,
    path.join(f.root, 'capture'), top, path.join(f.root, 'capture', '.', 'top.jpg'),
  ]);
  assertFiles(result, [top, nested]);
  assert.ok(result.summary.skippedReasons.duplicate >= 1);
});

test('file count cap rejects the whole selection instead of silently truncating', async t => {
  const f = await fixture(t);
  const files = await Promise.all([f.write('capture/a.jpg'), f.write('capture/b.jpg'), f.write('capture/c.jpg')]);
  await assert.rejects(select([path.join(f.root, 'capture')], { maxFiles: 2 }), /limit|maximum|many|files|more than/i);
  for (const file of files) assert.equal(await fs.readFile(file, 'utf8'), 'image-data');
});

test('oversized files are counted as invalid and batch caps reject the whole selection', async t => {
  const f = await fixture(t);
  const a = await f.write('a.jpg', '1234');
  const b = await f.write('b.png', '5678');
  const oversized = await select([a, b], { maxFileBytes: 3 });
  assertFiles(oversized, []);
  assert.equal(oversized.summary.skippedReasons.invalid, 2);
  await assert.rejects(select([a, b], { maxFileBytes: 4, maxBatchBytes: 7 }), /limit|maximum|large|size|bytes|GiB|GB/i);
  assert.equal(await fs.readFile(a, 'utf8'), '1234');
  assert.equal(await fs.readFile(b, 'utf8'), '5678');
});

test('entry scan cap also bounds directories containing unsupported files', async t => {
  const f = await fixture(t);
  await Promise.all([f.write('capture/a.txt'), f.write('capture/b.txt'), f.write('capture/c.txt'), f.write('capture/d.txt')]);
  await assert.rejects(select([path.join(f.root, 'capture')], { maxEntries: 2 }), /limit|maximum|many|entries|scan/i);
});

test('unsupported files are counted and empty folders return an explicit empty selection', async t => {
  const f = await fixture(t);
  await f.write('capture/readme.txt');
  await f.write('capture/image.gif');
  await fs.mkdir(path.join(f.root, 'capture', 'empty'));
  const result = await select([path.join(f.root, 'capture')]);
  assertFiles(result, []);
  assert.equal(result.summary.skippedReasons.unsupported, 2);
  assert.equal(result.summary.skipped, 2);
  assert.equal(result.summary.foldersScanned, 2);
  const empty = await select([path.join(f.root, 'capture', 'empty')]);
  assertFiles(empty, []);
  assert.equal(empty.summary.skipped, 0);
});

test('injected OS attributes prune hidden, system and unreadable paths before descent', async t => {
  const f = await fixture(t);
  const keep = await f.write('capture/keep.jpg');
  const hidden = await f.write('capture/normal-name.jpg');
  const system = await f.write('capture/normal-name.png');
  await f.write('capture/hidden-directory/deep.jpg');
  await f.write('capture/system-directory/deep.jpg');
  await f.write('capture/unreadable-directory/deep.jpg');
  const attributes = new Map([
    [hidden, 1], [system, 2],
    [path.join(f.root, 'capture', 'hidden-directory'), 1],
    [path.join(f.root, 'capture', 'system-directory'), 2],
    [path.join(f.root, 'capture', 'unreadable-directory'), 4],
  ]);
  const inspected = [];
  const readAttributes = async paths => {
    inspected.push(...paths);
    return new Map(paths.map(value => [value, attributes.get(value) || 0]));
  };
  const result = await select([path.join(f.root, 'capture')], { readAttributes });
  assertFiles(result, [keep]);
  assert.equal(result.summary.skippedReasons.hidden, 2);
  assert.equal(result.summary.skippedReasons.system, 2);
  assert.equal(result.summary.skippedReasons.unreadable, 1);
  assert.equal(result.summary.foldersScanned, 1);
  assert.equal(inspected.some(value => value.endsWith(`${path.sep}deep.jpg`)), false);
});
