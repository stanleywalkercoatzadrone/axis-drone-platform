'use strict';
const {app, BrowserWindow, ipcMain, dialog, shell, safeStorage} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {selectEngine} = require('./desktop/engine-selection.cjs');
const {collectImages} = require('./desktop/image-selection.cjs');
const {OrthoService} = require('./offline/engine.cjs');
const {CloudSync} = require('./offline/cloud-sync.cjs');
app.setName('Axis Ortho Offline');
app.setPath('userData', path.join(app.getPath('appData'), 'Axis Ortho Offline'));
let window, service, engine, cloud, engineMode;
let recovered = false;
let stopping = false, stopped = false;
const selections = new Map();
const imports = new Set();
const page = path.join(__dirname, 'companion.html');
const pageURL = pathToFileURL(page).href;
const outputKeys = new Set(['archive', 'orthophoto', 'dsm', 'report', 'stats', 'quality', 'delivery']);
function showWindow() {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
function jobId(id) { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw Error('Choose a valid local job.'); return id; }
function bind(name, handler) {
  ipcMain.handle('ortho:' + name, async (event, ...args) => {
    try {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== pageURL) throw Error('This request did not come from the Axis Ortho window.');
      return {ok: true, value: await handler(...args)};
    } catch (error) {
      return {ok: false, error: String(error.message || 'The request could not be completed.').replaceAll(engine?.config?.token || '\u0000', '[redacted]').slice(0, 1200)};
    }
  });
}
async function recover() { if (!recovered) { await service.recover(); recovered = true; } }
function createWindow() {
  window = new BrowserWindow({width: 1280, height: 900, minWidth: 820, minHeight: 600, title: 'Axis Ortho Offline', backgroundColor: '#f5f7fb',
    webPreferences: {preload: path.join(__dirname, 'companion-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true}});
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.loadFile(page);
  window.on('close', event => {
    if (imports.size && !stopping) {
      event.preventDefault();
      dialog.showMessageBox(window, {type: 'info', title: 'Images are still copying', message: 'Keep Axis Ortho open until your images finish copying.', detail: 'Your original images are unchanged. You can close this window after copying completes.'}).catch(() => {});
    }
  });
  window.on('closed', () => {window = null;});
}
function registerIPC() {
  bind('status', async () => ({version: app.isPackaged ? app.getVersion() : '0.1.0-preview.3', platform: process.platform, arch: process.arch, dataDir: path.join(app.getPath('userData'), 'jobs'), offline: true, engineMode, importing: imports.size, engine: await engine.probe(), cloud: cloud ? await cloud.status() : {linked: false}}));
  const choose = async folder => {
    if (imports.size || stopping) throw Error('Wait for the current image import to finish.');
    const result = await dialog.showOpenDialog(window, folder
      ? {title: 'Choose a drone image folder', properties: ['openDirectory', 'multiSelections']}
      : {title: 'Choose overlapping drone images', properties: ['openFile', 'multiSelections'], filters: [{name: 'Drone images', extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff']}]});
    if (result.canceled) return null;
    const {files, display, summary} = await collectImages({paths: result.filePaths, recursive: folder});
    if (!files.length) return {selectionId: null, files: [], count: 0, source: folder ? 'folder' : 'images', summary};
    if (selections.size >= 10) selections.delete(selections.keys().next().value);
    const selectionId = crypto.randomUUID(); selections.set(selectionId, {files, at: Date.now()});
    return {selectionId, files: display, count: files.length, source: folder ? 'folder' : 'images', summary};
  };
  bind('choose-images', () => choose(false));
  bind('choose-folder', () => choose(true));
  bind('create-job', async input => {
    if (imports.size || stopping) throw Error('Wait for the current image import to finish.');
    if (!input || typeof input !== 'object' || Object.keys(input).some(key => !['selectionId', 'name', 'preset', 'radiometricCalibration'].includes(key))) throw Error('Check the new job details.');
    const selected = selections.get(input.selectionId);
    if (!selected || selected.busy || Date.now() - selected.at > 30 * 60 * 1000) throw Error('Choose your images again before creating this job.');
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 160 || !['standard', 'fast'].includes(input.preset) || input.radiometricCalibration !== undefined && typeof input.radiometricCalibration !== 'boolean') throw Error('Enter a job name and choose valid processing options.');
    selected.busy = true;
    try {
      const task = service.create({name: input.name.trim(), files: selected.files, preset: input.preset, radiometricCalibration: input.radiometricCalibration === true});
      imports.add(task);
      let result;
      try {result = await task;} finally {imports.delete(task);}
      selections.delete(input.selectionId); return result;
    } catch (error) {selected.busy = false; throw error;}
  });
  bind('list-jobs', () => service.list());
  bind('get-job', id => service.get(jobId(id)));
  bind('start-engine', async () => {const result = await engine.start(); await recover(); return result;});
  bind('start-job', async id => {const state = await engine.probe(); if (!state.healthy) throw Error('Start the local processing engine before starting a job.'); await recover(); return service.start(jobId(id));});
  bind('cancel-job', id => service.cancel(jobId(id)));
  bind('open-output', async id => {
    const job = await service.get(jobId(id));
    let directory;
    if (job.status === 'completed') {
      const available = ['orthophoto', 'archive', 'dsm', 'report', 'stats'].find(key => job.outputs?.[key]);
      if (!available) throw Error('This completed job does not have a saved output folder.');
      directory = path.dirname(await service.getOutputPath(id, available));
    }
    else {
      const base = await fs.realpath(path.join(app.getPath('userData'), 'jobs'));
      directory = await fs.realpath(path.join(base, id));
      if (!directory.startsWith(base + path.sep) || !(await fs.stat(directory)).isDirectory()) throw Error('The local job folder could not be verified.');
    }
    const error = await shell.openPath(directory); if (error) throw Error('The output folder could not be opened.'); return {opened: true};
  });
  bind('export-output', async (id, key) => {
    if (!outputKeys.has(key)) throw Error('Choose a supported job output.');
    const filename = await service.getOutputPath(jobId(id), key);
    const result = await dialog.showSaveDialog(window, {title: 'Save processed output', defaultPath: path.basename(filename)});
    if (result.canceled || !result.filePath) return null;
    if (path.resolve(result.filePath) === path.resolve(filename)) return {saved: true};
    await fs.copyFile(filename, result.filePath); return {saved: true};
  });
  bind('link-cloud', input => {if (!cloud) throw Error('Cloud linking is not available in this build.'); return cloud.link(input);});
  bind('link-owner', () => {if (!cloud) throw Error('Cloud linking is not available in this build.'); return cloud.linkOwner(url => shell.openExternal(url));});
  bind('unlink-cloud', () => {if (!cloud) return {linked: false}; return cloud.unlink();});
  bind('cloud-missions', () => {if (!cloud) throw Error('Link your Axis account first.'); return cloud.missions();});
  bind('cloud-status', () => cloud ? cloud.status() : {linked: false, state: 'unlinked', queue: []});
  bind('job-mission', (id, missionId) => {if (!cloud) throw Error('Link your Axis account first.'); return cloud.setJobMission(jobId(id), missionId);});
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (url.startsWith('axis-ortho://')) showWindow();
  });
  app.on('second-instance', (_event, argv) => {
    if (argv.some(value => value.startsWith('axis-ortho://'))) showWindow();
    else showWindow();
  });
  app.whenReady().then(async () => {
    const selected = await selectEngine({resourcesPath: app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'native-runtime-resources'), runtimeDataPath: path.join(app.getPath('userData'), 'engine')});
    engine = selected.engine; engineMode = selected.mode;
    service = new OrthoService({dataDir: path.join(app.getPath('userData'), 'jobs'), runner: selected.runner, ...engine.connection()});
    service.on('change', job => {if (window && !window.isDestroyed()) window.webContents.send('ortho:jobs-changed', job);});
    cloud = new CloudSync({service, dataDir: path.join(app.getPath('userData'), 'cloud-sync'), safeStorage});
    await cloud.init();
    cloud.on('change', state => {if (window && !window.isDestroyed()) window.webContents.send('ortho:cloud-changed', state);});
    registerIPC(); createWindow();
    cloud.start().catch(() => {});
    const status = await engine.probe(); if (status.healthy) await recover();
  }).catch(error => {dialog.showErrorBox('Axis Ortho could not start', String(error.message).slice(0, 700)); app.quit();});
  app.on('activate', () => {if (!window && service) createWindow();});
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (stopped) return;
    event.preventDefault();
    if (stopping) return;
    stopping = true;
    Promise.allSettled([...imports, cloud?.stop(), service?.shutdown()]).finally(() => {stopped = true; app.quit();});
  });
}
