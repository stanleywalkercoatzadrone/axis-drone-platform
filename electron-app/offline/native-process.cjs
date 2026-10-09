'use strict';
const {spawn} = require('node:child_process');

// ODM launches native descendants. Wait for the process to close after cancellation;
// otherwise a retry can erase its working directory while those descendants run.
function runProcess(file, args, options, {spawnProcess = spawn, signal, onData = () => {}, stopAfterMs = 5000} = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawnProcess(file, args, {...options, detached: process.platform !== 'win32'});
    let failure, timer, settled = false;
    const terminate = force => {
      if (!child.pid || settled) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
        killer.on('error', () => child.kill('SIGKILL'));
      } else {try {process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');} catch (e) {if (e.code !== 'ESRCH') child.kill(force ? 'SIGKILL' : 'SIGTERM');}}
    };
    const abort = () => {terminate(false); timer = setTimeout(() => terminate(true), stopAfterMs); timer.unref?.();};
    child.stdout?.on('data', onData); child.stderr?.on('data', onData);
    child.once('error', error => {failure = error;});
    child.once('close', (code, killedBy) => {
      if (signal?.aborted) terminate(true);
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (signal?.aborted) reject(Error('Native processing interrupted.'));
      else if (failure) reject(failure);
      else if (code !== 0) reject(Error(`Native ODM stopped with ${killedBy || 'exit code ' + code}.`));
      else resolve();
    });
    signal?.addEventListener('abort', abort, {once: true});
    if (signal?.aborted) abort();
  });
}
module.exports = {runProcess};
