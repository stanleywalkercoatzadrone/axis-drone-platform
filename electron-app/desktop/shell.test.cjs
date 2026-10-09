'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {EventEmitter} = require('node:events');
const {pathToFileURL} = require('node:url');
async function setup(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'axis-shell-'));
  t.after(() => fs.rm(temporary, {recursive: true, force: true}));
  const image = path.join(temporary, 'image.jpg'); await fs.writeFile(image, 'image fixture');
  const handlers = new Map(), state = {window: null, selected: [image], created: null};
  const root = path.resolve(__dirname, '..');
  const app = new EventEmitter();
  Object.assign(app, {setName() {}, setPath() {}, getPath: () => temporary, getVersion: () => 'preview', requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), quit() {state.quit = true;}});
  class Window extends EventEmitter {
    constructor(options) {super(); state.window = this; state.options = options; this.webContents = new EventEmitter(); Object.assign(this.webContents, {mainFrame: {url: pathToFileURL(path.join(root, 'companion.html')).href}, setWindowOpenHandler(handler) {state.openHandler = handler;}, session: {setPermissionRequestHandler() {}}, send() {}});}
    loadFile() {} isDestroyed() {return false;}
  }
  class Engine {
    constructor() {this.config = {token: 'private-engine-token'};}
    async init() {return this;} connection() {return {endpoint: 'http://127.0.0.1:58000', token: this.config.token};}
    async probe() {return {available: true, healthy: true};} async start() {return this.probe();}
  }
  class Service extends EventEmitter {
    async recover() {} async list() {return [];} async shutdown() {}
    async create(input) {state.created = input; if (state.importGate) await state.importGate; return {id: '12345678-1234-4123-8123-123456789012'};}
  }
  class Cloud extends EventEmitter {async init() {} async start() {} async stop() {} async status() {return {linked: false, queue: []};}}
  const electron = {app, BrowserWindow: Window, ipcMain: {handle: (name, fn) => handlers.set(name, fn)}, dialog: {showOpenDialog: async (_window, options) => {state.dialogOptions = options; return {canceled: !!state.canceled, filePaths: state.selected};}, showMessageBox: async () => {state.copyMessageShown = true;}, showErrorBox(_title, error) {throw Error(error);}}, shell: {}, safeStorage: {}};
  const fakeRequire = name => name === 'electron' ? electron : name === './desktop/engine-selection.cjs' ? {selectEngine: async () => {const engine=new Engine(); return {engine,runner:engine,mode:'native'};}} : name === './desktop/image-selection.cjs' ? require('./image-selection.cjs') : name === './offline/engine.cjs' ? {OrthoService: Service} : name === './offline/cloud-sync.cjs' ? {CloudSync: Cloud} : require(name);
  vm.runInNewContext(await fs.readFile(path.join(root, 'companion-main.cjs'), 'utf8'), {require: fakeRequire, __dirname: root, process: {platform: 'darwin', arch: 'arm64'}, console});
  for (let i = 0; i < 10 && !state.window; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(state.window, 'Shell initialized');
  const event = () => ({sender: state.window.webContents, senderFrame: state.window.webContents.mainFrame});
  return {state, handlers, event, image, temporary, app};
}
test('IPC rejects different windows and subframes before returning private data', async t => {
  const f = await setup(t), handler = f.handlers.get('ortho:list-jobs');
  assert.equal((await handler({sender: {}, senderFrame: f.event().senderFrame})).ok, false);
  assert.equal((await handler({sender: f.event().sender, senderFrame: {url: f.event().senderFrame.url}})).ok, false);
  assert.equal((await handler(f.event())).ok, true);
  assert.equal(f.state.options.webPreferences.sandbox, true);
  assert.equal(f.state.options.webPreferences.nodeIntegration, false);
  assert.equal(f.state.openHandler().action, 'deny');
});
test('folder picker recursively grants private image access and cancellation preserves a selection', async t => {
  const f = await setup(t), choose = f.handlers.get('ortho:choose-folder'), create = f.handlers.get('ortho:create-job');
  await fs.mkdir(path.join(f.temporary, 'nested'));
  await fs.writeFile(path.join(f.temporary, 'nested', 'image.jpg'), 'nested fixture');
  await fs.writeFile(path.join(f.temporary, 'notes.txt'), 'skip this');
  f.state.selected = [f.temporary];
  const selected = await choose(f.event());
  assert.equal(selected.ok, true);
  assert.ok(f.state.dialogOptions.properties.includes('openDirectory'));
  assert.equal(selected.value.count, 2); assert.equal(selected.value.summary.skipped, 1);
  assert.equal(JSON.stringify(selected).includes(f.temporary), false);
  f.state.canceled = true;
  assert.equal((await choose(f.event())).value, null);
  assert.equal((await create(f.event(), {selectionId: selected.value.selectionId, name: 'Nested folder', preset: 'standard'})).ok, true);
  assert.equal(f.state.created.files.length, 2);
  assert.equal((await choose({sender: {}, senderFrame: f.event().senderFrame})).ok, false);
});
test('only native selections grant one-use image access and disk paths never reach renderer', async t => {
  const f = await setup(t), choose = f.handlers.get('ortho:choose-images'), create = f.handlers.get('ortho:create-job');
  const selected = await choose(f.event());
  assert.equal(selected.ok, true); assert.equal(selected.value.files[0].name, 'image.jpg');
  assert.equal(JSON.stringify(selected).includes(f.image), false);
  const input = {selectionId: selected.value.selectionId, name: 'Survey', preset: 'standard'};
  assert.equal((await create(f.event(), {...input, files: ['/etc/passwd']})).ok, false);
  assert.equal((await create(f.event(), input)).ok, true);
  assert.deepEqual([...f.state.created.files], [await fs.realpath(f.image)]);
  assert.equal((await create(f.event(), input)).ok, false);
});
test('window close and app quit cannot interrupt an active import', async t => {
  const f = await setup(t);
  const selected = await f.handlers.get('ortho:choose-images')(f.event());
  let finish;
  f.state.importGate = new Promise(resolve => {finish = resolve;});
  const importing = f.handlers.get('ortho:create-job')(f.event(), {selectionId: selected.value.selectionId, name: 'Copy in progress', preset: 'standard'});
  const status = await f.handlers.get('ortho:status')(f.event());
  assert.equal(status.value.importing, 1);
  assert.equal((await f.handlers.get('ortho:choose-folder')(f.event())).ok, false);
  let preventedClose = false;
  f.state.window.emit('close', {preventDefault() {preventedClose = true;}});
  assert.equal(preventedClose, true); assert.equal(f.state.copyMessageShown, true);
  f.app.emit('before-quit', {preventDefault() {}});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.state.quit, undefined);
  finish();
  assert.equal((await importing).ok, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.state.quit, true);
});
