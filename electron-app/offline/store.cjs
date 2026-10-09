'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff']);
const STATUSES = new Set(['ready', 'starting', 'uploading', 'processing', 'downloading', 'completed', 'failed', 'canceling', 'canceled', 'interrupted', 'unavailable']);
const MUTABLE = new Set(['status', 'progress', 'phase', 'taskId', 'error', 'outputs', 'taskCommitted', 'engineEndpoint', 'attempt']);
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
// One process may construct more than one store for the same directory.
const updateQueues = new Map();

function fail(message, code = 'INVALID_JOB') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw fail(`${label} must be a positive integer.`);
  return value;
}

function idCheck(id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw fail('A valid job UUID is required.');
}

function relativeCheck(relative, prefix) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || relative.includes('\0')
    || path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative)
    || relative.split('/').some(part => !part || part === '.' || part === '..')
    || (prefix && !relative.startsWith(`${prefix}/`))) {
    throw fail('Job paths must stay inside their designated directory.', 'UNSAFE_PATH');
  }
  return relative;
}

function endpointCheck(value) {
  if (value === null) return;
  if (typeof value !== 'string') throw fail('engineEndpoint must be a loopback HTTP URL or null.');
  let url;
  try { url = new URL(value); } catch { throw fail('engineEndpoint must be a loopback HTTP URL or null.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw fail('engineEndpoint must be a loopback HTTP URL without credentials or a path.');
  }
}

function manifestCheck(job, expectedId) {
  if (!plainObject(job) || job.schemaVersion !== 1 || job.id !== expectedId) throw fail('Unsupported or mismatched job manifest.');
  idCheck(job.id);
  if (typeof job.name !== 'string' || !job.name.trim() || job.name.length > 200) throw fail('Job name must contain 1–200 characters.');
  if (!['standard', 'fast'].includes(job.preset)) throw fail('Unknown processing preset.');
  if (job.radiometricCalibration !== undefined && typeof job.radiometricCalibration !== 'boolean') throw fail('Radiometric calibration setting is invalid.');
  if (!Array.isArray(job.inputs) || !job.inputs.length) throw fail('Job manifest has no inputs.');
  const names = new Set();
  for (const input of job.inputs) {
    if (!plainObject(input) || typeof input.name !== 'string' || !input.name
      || typeof input.storedName !== 'string' || path.posix.basename(input.storedName) !== input.storedName
      || input.storedName.includes('\\') || !EXTENSIONS.has(path.extname(input.storedName).toLowerCase())
      || !Number.isSafeInteger(input.size) || input.size <= 0 || names.has(input.storedName)) {
      throw fail('Job manifest contains invalid or duplicate input metadata.');
    }
    relativeCheck(input.relativePath, 'inputs');
    if (input.relativePath !== `inputs/${input.storedName}`) throw fail('Input path does not match its stored name.');
    names.add(input.storedName);
  }
  if (!plainObject(job.outputs)) throw fail('Job outputs must be a map.');
  for (const [key, output] of Object.entries(job.outputs)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(key) || !plainObject(output)
      || !Number.isSafeInteger(output.size) || output.size < 0) throw fail('Invalid job output metadata.');
    relativeCheck(output.relativePath, 'output');
  }
  if (!STATUSES.has(job.status)) throw fail('Unknown job status.');
  if (!Number.isFinite(job.progress) || job.progress < 0 || job.progress > 100) throw fail('Job progress must be between 0 and 100.');
  if (typeof job.phase !== 'string' || !job.phase || job.phase.length > 200) throw fail('Job phase must contain 1–200 characters.');
  if (job.taskId !== null && (typeof job.taskId !== 'string' || !UUID.test(job.taskId))) throw fail('taskId must be a UUID or null.');
  if (job.error !== null && (typeof job.error !== 'string' || job.error.length > 10000)) throw fail('Job error must be a string of at most 10,000 characters or null.');
  if (typeof job.taskCommitted !== 'boolean') throw fail('taskCommitted must be boolean.');
  if (!Number.isSafeInteger(job.attempt) || job.attempt < 0) throw fail('attempt must be a nonnegative integer.');
  endpointCheck(job.engineEndpoint);
  for (const key of ['createdAt', 'updatedAt']) {
    if (typeof job[key] !== 'string' || !Number.isFinite(Date.parse(job[key]))) throw fail(`Invalid ${key} timestamp.`);
  }
  return job;
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await fsp.open(directory, 'r');
    await handle.sync();
  } catch (error) {
    // Windows does not expose portable directory fsync through Node.
    if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EISDIR', 'EINVAL', 'ENOTSUP'].includes(error.code)) throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function atomicManifest(directory, manifest) {
  const target = path.join(directory, 'manifest.json');
  const temporary = path.join(directory, `.manifest-${randomUUID()}.tmp`);
  const encoded = JSON.stringify(manifest, null, 2) + '\n';
  if (Buffer.byteLength(encoded) > MAX_MANIFEST_BYTES) throw fail('Job manifest is too large.');
  let handle;
  try {
    handle = await fsp.open(temporary, 'wx', 0o600);
    await handle.writeFile(encoded, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fsp.rename(temporary, target);
    await syncDirectory(directory);
  } finally {
    if (handle) await handle.close();
    await fsp.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

class JobStore {
  constructor({ dataDir, maxFiles = 2000, maxFileBytes = 2 * 1024 ** 3, maxBatchBytes = 20 * 1024 ** 3 } = {}) {
    if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir) || dataDir.includes('\0')) throw fail('dataDir must be an absolute directory path.');
    this.dataDir = path.resolve(dataDir);
    this.maxFiles = positiveInteger(maxFiles, 'maxFiles');
    this.maxFileBytes = positiveInteger(maxFileBytes, 'maxFileBytes');
    this.maxBatchBytes = positiveInteger(maxBatchBytes, 'maxBatchBytes');
  }

  async _ensureRoot() {
    await fsp.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    const stat = await fsp.stat(this.dataDir);
    if (!stat.isDirectory()) throw fail('Job storage is not a directory.', 'STORE_UNAVAILABLE');
  }

  // The configured root is trusted; descendants must never redirect through symlinks.
  pathFor(id, relative = '') {
    idCheck(id);
    if (relative !== '') relativeCheck(relative);
    let current = this.dataDir;
    const parts = [id, ...(relative ? relative.split('/') : [])];
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      try {
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) throw fail('Job path contains an unsafe filesystem entry.', 'UNSAFE_PATH');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return current;
  }

  async get(id) {
    await this._ensureRoot();
    const directory = this.pathFor(id);
    let handle;
    try {
      const directoryStat = await fsp.lstat(directory);
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw fail('Job directory is unavailable.', 'UNSAFE_PATH');
      const manifestPath = this.pathFor(id, 'manifest.json');
      handle = await fsp.open(manifestPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_MANIFEST_BYTES) throw fail('Job manifest is not a valid bounded file.');
      const text = await handle.readFile('utf8');
      let job;
      try { job = JSON.parse(text); } catch { throw fail('Job manifest contains invalid JSON.', 'CORRUPT_MANIFEST'); }
      return manifestCheck(job, id);
    } catch (error) {
      if (error.code === 'ENOENT') throw fail(`Job ${id} has no readable manifest.`, 'JOB_NOT_FOUND');
      throw error;
    } finally {
      if (handle) await handle.close();
    }
  }

  async list() {
    await this._ensureRoot();
    const entries = await fsp.readdir(this.dataDir, { withFileTypes: true });
    const jobs = [];
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink() && !UUID.test(entry.name)) continue;
      try {
        jobs.push(await this.get(entry.name));
      } catch (error) {
        const stat = await fsp.lstat(path.join(this.dataDir, entry.name)).catch(() => null);
        jobs.push({
          schemaVersion: 1, id: entry.name, name: `Unavailable job (${entry.name})`, preset: 'standard',
          inputs: [], outputs: {}, status: 'unavailable', progress: 0, phase: 'unavailable', taskId: null,
          taskCommitted: false, engineEndpoint: null, attempt: 0,
          error: `Could not read saved job: ${error.message}`,
          createdAt: stat ? stat.birthtime.toISOString() : null,
          updatedAt: stat ? stat.mtime.toISOString() : null,
        });
      }
    }
    return jobs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id));
  }

  async create({ name, files, preset = 'standard', radiometricCalibration = false } = {}, { onProgress } = {}) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) throw fail('Job name must contain 1–200 characters.');
    if (!['standard', 'fast'].includes(preset)) throw fail('Unknown processing preset.');
    if (typeof radiometricCalibration !== 'boolean') throw fail('Radiometric calibration setting is invalid.');
    if (!Array.isArray(files) || !files.length || files.length > this.maxFiles) throw fail(`Select between 1 and ${this.maxFiles} image files.`);
    let declaredBytes = 0;
    // Validate the entire selection before creating or copying anything.
    for (const source of files) {
      if (typeof source !== 'string' || !path.isAbsolute(source) || source.includes('\0')) throw fail('Selected inputs must be absolute file paths.');
      if (!EXTENSIONS.has(path.extname(source).toLowerCase())) throw fail('Only JPG, JPEG, PNG, TIF and TIFF inputs are supported.');
      const stat = await fsp.lstat(source);
      if (!stat.isFile() || stat.isSymbolicLink()) throw fail('Every input must be a regular file, not a symlink.');
      if (!Number.isSafeInteger(stat.size) || stat.size <= 0 || stat.size > this.maxFileBytes) throw fail('An input is empty or exceeds the per-file size limit.', 'INPUT_LIMIT');
      declaredBytes += stat.size;
      if (!Number.isSafeInteger(declaredBytes) || declaredBytes > this.maxBatchBytes) throw fail('The image batch exceeds the total size limit.', 'INPUT_LIMIT');
    }
    await this._ensureRoot();
    let id, directory;
    for (;;) {
      id = randomUUID();
      directory = this.pathFor(id);
      try { await fsp.mkdir(directory, { mode: 0o700 }); break; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    let completed = false;
    const createdAt = new Date().toISOString();
    const progress = (copiedFiles, copiedBytes) => {
      // Progress is observational; a closed UI must not interrupt durable copying.
      try { onProgress?.({ id, name: name.trim(), preset, totalFiles: files.length, copiedFiles, totalBytes: declaredBytes, copiedBytes, createdAt }); }
      catch { /* A progress listener cannot invalidate a local import. */ }
    };
    progress(0, 0);
    try {
      await fsp.mkdir(path.join(directory, 'inputs'), { mode: 0o700 });
      await fsp.mkdir(path.join(directory, 'output'), { mode: 0o700 });
      const inputs = [];
      let copiedBytes = 0;
      for (const source of files) {
        const storedName = `${randomUUID()}${path.extname(source).toLowerCase()}`;
        const relativePath = `inputs/${storedName}`;
        let input, output;
        try {
          input = await fsp.open(source, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
          const before = await input.stat();
          if (!before.isFile() || before.size <= 0 || before.size > this.maxFileBytes) throw fail('Selected input changed or exceeds its size limit.', 'INPUT_CHANGED');
          output = await fsp.open(path.join(directory, relativePath), 'wx', 0o600);
          const buffer = Buffer.allocUnsafe(1024 * 1024);
          let size = 0;
          for (;;) {
            const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
            if (!bytesRead) break;
            size += bytesRead;
            copiedBytes += bytesRead;
            if (size > this.maxFileBytes || copiedBytes > this.maxBatchBytes) throw fail('Inputs grew beyond the configured size limit.', 'INPUT_LIMIT');
            let offset = 0;
            while (offset < bytesRead) {
              const { bytesWritten } = await output.write(buffer, offset, bytesRead - offset, null);
              if (!bytesWritten) throw fail('Could not finish copying an input.', 'COPY_FAILED');
              offset += bytesWritten;
            }
          }
          const after = await input.stat();
          if (size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw fail('An input changed while it was being copied.', 'INPUT_CHANGED');
          await output.sync();
          inputs.push({ name: path.basename(source), storedName, size, relativePath });
          progress(inputs.length, copiedBytes);
        } finally {
          if (output) await output.close();
          if (input) await input.close();
        }
      }
      const now = new Date().toISOString();
      const job = manifestCheck({
        schemaVersion: 1, id, name: name.trim(), preset, radiometricCalibration, inputs, outputs: {}, status: 'ready', progress: 0,
        phase: 'ready', taskId: null, error: null, taskCommitted: false, engineEndpoint: null, attempt: 0,
        createdAt, updatedAt: now,
      }, id);
      await syncDirectory(path.join(directory, 'inputs'));
      await atomicManifest(directory, job);
      await syncDirectory(this.dataDir);
      completed = true;
      return job;
    } finally {
      // This directory was exclusively created above; existing jobs are never removed.
      if (!completed) await fsp.rm(directory, { recursive: true, force: true });
    }
  }

  async update(id, patch) {
    idCheck(id);
    if (!plainObject(patch)) throw fail('A job update must be an object.');
    for (const key of Object.keys(patch)) if (!MUTABLE.has(key)) throw fail(`Job field ${key} cannot be updated.`);
    // Capture caller-owned values before waiting for another update.
    const changes = structuredClone(patch);
    const queueKey = path.join(this.dataDir, id);
    const previous = updateQueues.get(queueKey) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const current = await this.get(id);
      const next = manifestCheck({ ...current, ...changes, updatedAt: new Date().toISOString() }, id);
      await atomicManifest(this.pathFor(id), next);
      return next;
    });
    updateQueues.set(queueKey, operation);
    try { return await operation; }
    finally { if (updateQueues.get(queueKey) === operation) updateQueues.delete(queueKey); }
  }

  async getOutputPath(id, key) {
    const job = await this.get(id);
    if (typeof key !== 'string' || !Object.hasOwn(job.outputs, key)) throw fail('That output is not listed in this job.', 'OUTPUT_NOT_FOUND');
    const output = job.outputs[key];
    const target = this.pathFor(id, output.relativePath);
    const outputRoot = this.pathFor(id, 'output');
    let stat, realTarget, realOutputRoot, realStoreRoot;
    try {
      [stat, realTarget, realOutputRoot, realStoreRoot] = await Promise.all([
        fsp.lstat(target), fsp.realpath(target), fsp.realpath(outputRoot), fsp.realpath(this.dataDir),
      ]);
    } catch (error) {
      if (error.code === 'ENOENT') throw fail('The saved output file is missing.', 'OUTPUT_NOT_FOUND');
      throw error;
    }
    const relative = path.relative(realOutputRoot, realTarget);
    if (realOutputRoot !== path.join(realStoreRoot, id, 'output') || !stat.isFile() || stat.isSymbolicLink()
      || !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw fail('Output is not a regular file inside this job.', 'UNSAFE_PATH');
    }
    if (stat.size !== output.size) throw fail('The output size no longer matches its manifest.', 'OUTPUT_CHANGED');
    return realTarget;
  }
}

module.exports = { JobStore };
