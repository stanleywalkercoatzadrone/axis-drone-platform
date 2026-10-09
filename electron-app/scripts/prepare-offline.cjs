'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, '.offline-build', 'app');
const version = process.env.AXIS_RELEASE_VERSION || '0.1.0-preview.6';
if(!/^\d+\.\d+\.\d+(?:-preview\.\d+)?$/.test(version))throw Error('Invalid release version.');
async function copyFile(relative) {
  await fs.mkdir(path.dirname(path.join(destination, relative)), {recursive: true});
  await fs.copyFile(path.join(root, relative), path.join(destination, relative));
}
async function copyCode(directory) {
  for (const entry of await fs.readdir(path.join(root, directory), {withFileTypes: true})) {
    if (!entry.isFile() || !entry.name.endsWith('.cjs') || entry.name.endsWith('.test.cjs')) continue;
    await copyFile(path.join(directory, entry.name));
  }
}
async function main() {
  // Never copy the original backend, application dist, environment files, or developer dependencies.
  for (const required of ['companion-main.cjs', 'companion-preload.cjs', 'companion.html', 'companion.js', 'companion.css', 'offline/engine.cjs', 'offline/native-engine.cjs', 'offline/store.cjs', 'offline/cloud-sync.cjs']) await fs.access(path.join(root, required));
  await fs.rm(destination, {recursive: true, force: true});
  await fs.mkdir(destination, {recursive: true});
  for (const file of ['companion-main.cjs', 'companion-preload.cjs', 'companion.html', 'companion.js', 'companion.css']) await copyFile(file);
  await copyCode('desktop'); await copyCode('offline');
  const manifest = {name: 'axis-ortho-offline', version, private: true, description: 'Axis Ortho offline processing companion', author: 'Axis Platform', main: 'companion-main.cjs', type: 'commonjs', dependencies: {yauzl: '3.4.0'}};
  await fs.writeFile(path.join(destination, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  const lock = path.join(root, 'offline-runtime.package-lock.json');
  try { await fs.copyFile(lock, path.join(destination, 'package-lock.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log('Prepared the isolated offline companion. Install its locked runtime dependencies before packaging.');
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
