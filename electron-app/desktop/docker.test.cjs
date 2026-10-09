'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {DockerEngine, ownedContainer, IMAGE, LABEL} = require('./docker.cjs');
const config = {installationId: 'a'.repeat(32), token: 'b'.repeat(64), container: 'axis-ortho-' + 'a'.repeat(32), volume: 'axis-ortho-data-' + 'a'.repeat(32)};
function container() {return {Config: {Image: IMAGE, Labels: {[LABEL]: config.installationId}, Cmd: ['--token', config.token, '--port', '3000']}, HostConfig: {Privileged: false, NetworkMode: 'default', PortBindings: {'3000/tcp': [{HostIp: '127.0.0.1', HostPort: '58000'}]}}, Mounts: [{Type: 'volume', Name: config.volume, Destination: '/var/www/data', RW: true}], State: {Running: true}};}
test('reuse requires installation ownership, exact token, persistent volume and loopback binding', () => {
  assert.equal(ownedContainer(container(), config), true);
  for (const mutate of [r => r.Config.Labels[LABEL] = 'other', r => r.Config.Cmd[1] = 'other', r => r.Config.Image = 'untrusted/image', r => r.HostConfig.PortBindings['3000/tcp'][0].HostIp = '0.0.0.0', r => r.HostConfig.PortBindings['22/tcp'] = [], r => r.HostConfig.NetworkMode = 'host', r => r.HostConfig.Privileged = true, r => r.Mounts[0].Name = 'other', r => r.Mounts.push({Type: 'bind', Destination: '/host'})]) {
    const row = container(); mutate(row); assert.equal(ownedContainer(row, config), false);
  }
});
test('installation token persists privately without including credentials in status', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'axis-engine-'));
  try {
    const first = await new DockerEngine(dir).init(), second = await new DockerEngine(dir).init();
    assert.equal(first.config.token, second.config.token);
    assert.match(first.config.token, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(first.state).includes(first.config.token), false);
    if (process.platform !== 'win32') assert.equal((await fs.stat(path.join(dir, 'engine-installation.json'))).mode & 0o777, 0o600);
  } finally {await fs.rm(dir, {recursive: true, force: true});}
});
test('unowned existing container is rejected without a start/run/removal', async () => {
  const calls = [], manager = new DockerEngine('/unused', {execute: async (_binary, args) => {calls.push(args); if (args[0] === 'context') return {stdout: JSON.stringify([{Endpoints: {docker: {Host: 'unix:///fixture.sock'}}}])}; if (args[0] === 'info') return {stdout: 'fixture'}; if (args[1] === 'ls') return {stdout: 'container-id'}; const row = container(); row.Config.Labels[LABEL] = 'other'; return {stdout: JSON.stringify([row])};}});
  manager.config = config; manager.binary = async () => '/fixture/docker';
  await assert.rejects(manager.start(), /unexpected ownership/);
  assert.equal(calls.some(args => ['run', 'start', 'rm'].includes(args[0])), false);
});
test('Docker failures redact per-install engine token', async () => {
  const manager = new DockerEngine('/unused', {execute: async () => {throw {stderr: 'Failed for ' + config.token};}});
  manager.config = config; manager.binary = async () => '/fixture/docker';
  await assert.rejects(manager.command(['info']), error => !error.message.includes(config.token) && error.message.includes('[redacted]'));
});
