'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {createReadStream} = require('node:fs');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const execute = promisify(execFile);
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.AXIS_OUTPUT_DIR || path.join(root, 'offline-release'));
async function hash(filename) {const digest = crypto.createHash('sha256'); for await (const part of createReadStream(filename)) digest.update(part); return digest.digest('hex');}
async function appSignature(architecture) {
  if (process.platform !== 'darwin') return 'not-checked';
  const app = path.join(output, architecture === 'arm64' ? 'mac-arm64' : 'mac', 'Axis Ortho Offline.app');
  try {
    await execute('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], {timeout: 60000});
    const metadata = await execute('/usr/bin/codesign', ['--display', '--verbose=2', app], {timeout: 10000});
    if (/Authority=Developer ID Application:/.test(metadata.stderr)) return 'developer-id-verified';
    if (/Authority=Apple Development:/.test(metadata.stderr)) return 'apple-development-verified';
    return 'signature-valid-identity-unverified';
  } catch {return 'not-verified';}
}
async function main() {
  await fs.mkdir(output, {recursive: true});
  const version = JSON.parse(await fs.readFile(path.join(root, '.offline-build', 'app', 'package.json'), 'utf8')).version;
  const artifacts = [];
  for (const name of (await fs.readdir(output)).sort()) {
    const match = /^AxisOrtho-(.+)-(mac|win)-(arm64|x64)\.(dmg|zip|exe)$/.exec(name);
    if (!match || match[1] !== version) continue;
    const filename = path.join(output, name), stat = await fs.stat(filename);
    if (!stat.isFile()) continue;
    const packagedAppSignature = match[2] === 'mac' ? await appSignature(match[3]) : 'not-checked';
    artifacts.push({filename: name, version: match[1], platform: match[2], architecture: match[3], format: match[4], bytes: stat.size, sha256: await hash(filename), status: 'preview-unverified', processingVerified: false, packagedAppSignature, installerSignatureVerified: false, notarizationVerified: false});
  }
  const manifest = {schema: 1, product: 'Axis Ortho Offline', version, generatedAt: new Date().toISOString(), artifacts, expectedTargets: ['mac-arm64', 'mac-x64', 'win-x64'], releaseStatus: 'Not approved for production distribution. Real processing and platform signature checks remain required.'};
  await fs.writeFile(path.join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(output, 'SHA256SUMS.txt'), artifacts.map(a => a.sha256 + '  ' + a.filename).join('\n') + '\n');
  console.log(JSON.stringify({manifest: path.join(output, 'release-manifest.json'), artifacts: artifacts.map(a => ({filename: a.filename, bytes: a.bytes, sha256: a.sha256, status: a.status}))}, null, 2));
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
