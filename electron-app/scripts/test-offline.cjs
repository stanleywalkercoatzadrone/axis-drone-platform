'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, '.offline-build', 'app');
async function main() {
  await fs.access(path.join(stage, 'node_modules', 'yauzl', 'index.js'));
  const tests = [];
  for (const directory of ['desktop', 'offline']) {
    await fs.mkdir(path.join(stage, directory), {recursive: true});
    for (const entry of await fs.readdir(path.join(root, directory), {withFileTypes: true})) {
      if (!entry.isFile() || !entry.name.endsWith('.cjs')) continue;
      const destination = path.join(stage, directory, entry.name);
      await fs.copyFile(path.join(root, directory, entry.name), destination);
      if (entry.name.endsWith('.test.cjs')) tests.push(destination);
    }
  }
  if (!tests.length) throw Error('Offline tests are missing.');
  const child = spawn(process.execPath, ['--test', ...tests], {stdio: 'inherit', shell: false});
  process.exitCode = await new Promise(resolve => {child.on('error', () => resolve(1)); child.on('exit', code => resolve(code || 0));});
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
