'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const execute = promisify(execFile);
const SUPPORTED = /\.(jpe?g|png|tiff?)$/i;
const SYSTEM_NAMES = new Set(['__macosx', 'thumbs.db', 'desktop.ini', '$recycle.bin', 'system volume information']);

// The fixed native commands read visibility metadata only. Selected paths are
// passed as arguments or stdin, never interpolated into executable code.
async function nativeAttributes(paths) {
  const result = new Map(paths.map(filename => [filename, 0]));
  if (!paths.length) return result;
  if (process.platform === 'darwin') {
    const {stdout} = await execute('/usr/bin/stat', ['-f', '%f', ...paths], {timeout: 15000, maxBuffer: 1024 * 1024});
    const flags = stdout.trim().split(/\r?\n/);
    if (flags.length !== paths.length || flags.some(value => !/^\d+$/.test(value))) throw Error('visibility metadata');
    paths.forEach((filename, index) => result.set(filename, Number(flags[index]) & 0x8000 ? 1 : 0));
  } else if (process.platform === 'win32') {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = '$ErrorActionPreference="Stop"; [Console]::InputEncoding=[Text.UTF8Encoding]::new(); [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $p=ConvertFrom-Json ([Console]::In.ReadToEnd()); $out=@(foreach($f in $p){try{$a=[int][IO.File]::GetAttributes([string]$f); (($a -band 2)/2) + (($a -band 4)/2)}catch{4}}); ConvertTo-Json -Compress -InputObject $out';
    const stdout = await new Promise((resolve, reject) => {
      const child = execFile(executable, ['-NoProfile', '-NonInteractive', '-Command', script], {timeout: 20000, maxBuffer: 1024 * 1024, windowsHide: true}, (error, output) => error ? reject(error) : resolve(output));
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(paths));
    });
    const flags = JSON.parse(stdout.replace(/^\uFEFF/, ''));
    if (!Array.isArray(flags) || flags.length !== paths.length || flags.some(value => !Number.isInteger(value) || value < 0 || value > 4)) throw Error('visibility metadata');
    paths.forEach((filename, index) => result.set(filename, flags[index]));
  }
  return result;
}

async function collectImages({paths, recursive = false, maxFiles = 2000, maxFileBytes = 1024 ** 3, maxBatchBytes = 20 * 1024 ** 3, maxEntries = 100000, readAttributes = nativeAttributes} = {}) {
  if (!Array.isArray(paths) || !paths.length || paths.some(filename => typeof filename !== 'string' || !path.isAbsolute(filename)) || typeof recursive !== 'boolean') throw Error('Choose images or a folder using the native picker.');
  for (const value of [maxFiles, maxFileBytes, maxBatchBytes, maxEntries]) if (!Number.isSafeInteger(value) || value < 1) throw Error('Invalid image selection limit.');
  const files = [], display = [], summary = {supported: 0, skipped: 0, foldersScanned: 0, skippedReasons: {hidden: 0, system: 0, symlink: 0, unsupported: 0, invalid: 0, unreadable: 0, duplicate: 0}};
  const pending = [], seen = new Set(), inodes = new Set();
  let scheduled = 0, bytes = 0;
  const skip = reason => {summary.skipped++; summary.skippedReasons[reason]++;};
  const enqueue = (filename, depth) => {if (++scheduled > maxEntries) throw Error(`This selection exceeds the ${maxEntries.toLocaleString('en-US')}-entry scan limit. Choose a smaller folder.`); pending.push({filename, depth});};
  paths.forEach(filename => enqueue(path.resolve(filename), 0));
  while (pending.length) {
    const candidates = [];
    for (const entry of pending.splice(Math.max(0, pending.length - 128))) {
      const name = path.basename(entry.filename);
      if (name.startsWith('.')) {skip('hidden'); continue;}
      if (SYSTEM_NAMES.has(name.toLowerCase())) {skip('system'); continue;}
      let stat;
      try {stat = await fs.lstat(entry.filename);} catch {skip('unreadable'); continue;}
      if (stat.isSymbolicLink()) {skip('symlink'); continue;}
      if (!stat.isDirectory() && !stat.isFile()) {skip('invalid'); continue;}
      candidates.push({...entry, stat});
    }
    let attributes;
    try {attributes = await readAttributes(candidates.map(entry => entry.filename));}
    catch {throw Error('Could not check file visibility. Choose a readable local folder and try again.');}
    for (const {filename, depth, stat} of candidates) {
      const flags = attributes.get(filename);
      if (!Number.isInteger(flags) || flags & 4) {skip('unreadable'); continue;}
      if (flags & 1) {skip('hidden'); continue;}
      if (flags & 2) {skip('system'); continue;}
      let absolute;
      try {absolute = await fs.realpath(filename);} catch {skip('unreadable'); continue;}
      const identity = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
      if (seen.has(identity)) {skip('duplicate'); continue;}
      seen.add(identity);
      if (stat.isDirectory()) {
        if (depth && !recursive) {skip('invalid'); continue;}
        try {
          const directory = await fs.opendir(absolute);
          summary.foldersScanned++;
          for await (const entry of directory) enqueue(path.join(absolute, entry.name), depth + 1);
        } catch (error) {
          if (scheduled > maxEntries) throw error;
          skip('unreadable');
        }
        continue;
      }
      if (!SUPPORTED.test(absolute)) {skip('unsupported'); continue;}
      if (!Number.isSafeInteger(stat.size) || stat.size < 1 || stat.size > maxFileBytes) {skip('invalid'); continue;}
      const inode = stat.ino ? `${stat.dev}:${stat.ino}` : null;
      if (inode && inodes.has(inode)) {skip('duplicate'); continue;}
      if (files.length >= maxFiles) throw Error(`This selection contains more than ${maxFiles.toLocaleString('en-US')} supported images. Choose a smaller folder; no partial selection was saved.`);
      if (bytes + stat.size > maxBatchBytes) throw Error('This selection exceeds the total image size limit. Choose a smaller folder; no partial selection was saved.');
      if (inode) inodes.add(inode);
      bytes += stat.size; files.push(absolute); display.push({name: path.basename(absolute), size: stat.size});
    }
  }
  summary.supported = files.length;
  return {files, display, summary};
}
module.exports = {collectImages, nativeAttributes};
