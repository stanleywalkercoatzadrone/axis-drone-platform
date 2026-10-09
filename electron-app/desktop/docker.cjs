'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const execute = promisify(execFile);
const IMAGE = 'opendronemap/nodeodm:latest';
const LABEL = 'app.axis.ortho.installation';
const PORT = '58000';

function ownedContainer(row, config) {
  const bindings = row?.HostConfig?.PortBindings;
  const ports = bindings?.['3000/tcp'];
  const mounts = row?.Mounts || [];
  return row?.Config?.Labels?.[LABEL] === config.installationId
    && row.Config.Image === IMAGE
    && JSON.stringify(row.Config.Cmd) === JSON.stringify(['--token', config.token, '--port', '3000'])
    && row.HostConfig.Privileged === false
    && ['default', 'bridge'].includes(row.HostConfig.NetworkMode)
    && bindings && Object.keys(bindings).length === 1
    && ports?.length === 1 && ports[0].HostIp === '127.0.0.1' && ports[0].HostPort === PORT
    && mounts.length === 1 && mounts[0].Type === 'volume'
    && mounts[0].Name === config.volume && mounts[0].Destination === '/var/www/data'
    && mounts[0].RW === true;
}

class DockerEngine {
  constructor(userData, options = {}) {
    this.userData = userData;
    this.execute = options.execute || execute;
    this.fetch = options.fetch || globalThis.fetch;
    this.state = {available: false, healthy: false, message: 'Start Docker Desktop, then select Start processing engine.'};
    this.pending = null;
  }
  async init() {
    await fs.mkdir(this.userData, {recursive: true, mode: 0o700});
    const filename = path.join(this.userData, 'engine-installation.json');
    try {
      this.config = JSON.parse(await fs.readFile(filename, 'utf8'));
      if (!/^[a-f0-9]{32}$/.test(this.config.installationId || '') || !/^[a-f0-9]{64}$/.test(this.config.token || '')) throw Error('invalid');
      const suffix = this.config.installationId;
      if (this.config.container !== 'axis-ortho-' + suffix || this.config.volume !== 'axis-ortho-data-' + suffix) throw Error('invalid');
    } catch (error) {
      if (error.code !== 'ENOENT') throw Error('The processing engine configuration cannot be read safely. Keep your files and contact support.');
      const installationId = crypto.randomBytes(16).toString('hex');
      this.config = {schema: 1, installationId, token: crypto.randomBytes(32).toString('hex'), container: 'axis-ortho-' + installationId, volume: 'axis-ortho-data-' + installationId};
      await fs.writeFile(filename, JSON.stringify(this.config), {flag: 'wx', mode: 0o600});
    }
    return this;
  }
  connection() { return {endpoint: 'http://127.0.0.1:' + PORT, token: this.config.token}; }
  async binary() {
    const candidates = process.platform === 'darwin'
      ? ['/Applications/Docker.app/Contents/Resources/bin/docker', '/usr/local/bin/docker', '/opt/homebrew/bin/docker']
      : process.platform === 'win32'
        ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe')]
        : ['/usr/bin/docker', '/usr/local/bin/docker'];
    for (const candidate of candidates) { try { await fs.access(candidate); return candidate; } catch {} }
    throw Error('Docker Desktop was not found. Install and start Docker Desktop before processing images.');
  }
  async command(args, timeout = 20000) {
    const binary = await this.binary();
    try {
      const result = await this.execute(binary, args, {timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8'});
      return result.stdout.trim();
    } catch (error) {
      const detail = String(error.stderr || '').replaceAll(this.config.token, '[redacted]').slice(0, 500);
      throw Error(detail || 'Docker did not complete the request. Check that Docker Desktop is running.');
    }
  }
  async findContainer() {
    const ids = await this.command(['container', 'ls', '-a', '--filter', 'name=^/' + this.config.container + '$', '--format', '{{.ID}}']);
    if (!ids) return null;
    if (ids.split(/\s+/).length !== 1) throw Error('More than one processing container matched this installation. No container was changed.');
    const rows = JSON.parse(await this.command(['container', 'inspect', this.config.container]));
    if (rows.length !== 1 || !ownedContainer(rows[0], this.config)) throw Error('The existing processing container has unexpected ownership or network settings. No container was changed.');
    return rows[0];
  }
  async localContext() {
    if (process.env.DOCKER_HOST && !/^(unix:|npipe:)/.test(process.env.DOCKER_HOST)) throw Error('Axis Ortho requires a local Docker Desktop connection. Remote Docker hosts are not supported.');
    const contexts = JSON.parse(await this.command(['context', 'inspect']));
    if (contexts.length !== 1 || !/^(unix:|npipe:)/.test(contexts[0]?.Endpoints?.docker?.Host || '')) throw Error('Select a local Docker Desktop context before processing images.');
  }
  async probe() {
    try {
      await this.localContext();
      await this.command(['info', '--format', '{{.ServerVersion}}']);
      const row = await this.findContainer();
      if (!row?.State?.Running) return this.state = {available: true, healthy: false, message: 'Docker is ready. Select Start processing engine.'};
      const url = new URL('/info', this.connection().endpoint); url.searchParams.set('token', this.config.token);
      const response = await this.fetch(url, {signal: AbortSignal.timeout(5000), redirect: 'error'});
      if (!response.ok) throw Error('The owned processing engine is not ready.');
      const info = await response.json();
      if (!info || typeof info.version !== 'string') throw Error('The processing engine returned an unexpected response.');
      return this.state = {available: true, healthy: true, message: 'Local processing engine is ready.', version: info.version};
    } catch (error) {
      return this.state = {available: false, healthy: false, message: error.message};
    }
  }
  async start() {
    if (this.pending) return this.pending;
    this.pending = this.startOwned().finally(() => {this.pending = null;});
    return this.pending;
  }
  async startOwned() {
    await this.localContext();
    await this.command(['info', '--format', '{{.ServerVersion}}']);
    let row = await this.findContainer();
    if (!row) {
      const volumes = await this.command(['volume', 'ls', '--filter', 'name=^' + this.config.volume + '$', '--format', '{{.Name}}']);
      if (volumes) {
        const found = JSON.parse(await this.command(['volume', 'inspect', this.config.volume]));
        if (found.length !== 1 || found[0].Labels?.[LABEL] !== this.config.installationId) throw Error('The engine data volume belongs to another installation. No volume was changed.');
      } else await this.command(['volume', 'create', '--label', LABEL + '=' + this.config.installationId, this.config.volume]);
      this.state = {available: true, healthy: false, message: 'Preparing the processing engine. Its first download can take several minutes.'};
      await this.command(['run', '-d', '--name', this.config.container, '--label', LABEL + '=' + this.config.installationId,
        '--publish', '127.0.0.1:' + PORT + ':3000', '--mount', 'type=volume,source=' + this.config.volume + ',target=/var/www/data',
        '--restart', 'no', IMAGE, '--token', this.config.token, '--port', '3000'], 20 * 60 * 1000);
      row = await this.findContainer();
    }
    if (!row) throw Error('The processing engine could not be verified.');
    if (!row.State.Running) await this.command(['start', this.config.container], 120000);
    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await this.probe();
      if (state.healthy) return state;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw Error('The processing engine has not become ready. Your local jobs are preserved; try again after checking Docker Desktop.');
  }
}
module.exports = {DockerEngine, ownedContainer, IMAGE, LABEL};
