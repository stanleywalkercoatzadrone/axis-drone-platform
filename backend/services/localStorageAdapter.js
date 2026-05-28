/**
 * localStorageAdapter.js — Filesystem storage adapter for local (offline) mode
 *
 * Replaces GCS (@google-cloud/storage) when AXIS_LOCAL_MODE=true.
 * Stores all files under LOCAL_DATA_DIR (set by Electron to ~/Library/Application Support/axis-ortho/jobs/)
 *
 * API surface mirrors cloudStorage.js so the rest of the backend is unaware of the swap.
 */

import fs    from 'fs';
import fsp   from 'fs/promises';
import path  from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

// Root data directory — set by Electron main process via env var
const DATA_DIR = process.env.LOCAL_DATA_DIR
    || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', 'AxisOrtho', 'jobs');

/**
 * Ensure a directory exists (recursive mkdir)
 */
async function ensureDir(dirPath) {
    await fsp.mkdir(dirPath, { recursive: true });
}

/**
 * Resolve a storage path to an absolute local path
 * e.g. "jobs/abc123/output/orthomosaic.tif" → DATA_DIR/jobs/abc123/output/orthomosaic.tif
 */
function resolveLocalPath(storagePath) {
    // Strip leading slashes / gs:// prefixes
    const clean = storagePath.replace(/^gs:\/\/[^/]+\//, '').replace(/^\/+/, '');
    return path.join(DATA_DIR, clean);
}

/**
 * Save a file from a readable stream to local storage
 * @param {ReadableStream} readStream - Source stream
 * @param {string}         storagePath - Destination path (relative)
 * @param {object}         [opts]      - { contentType } (ignored locally, stored in sidecar)
 * @returns {Promise<string>}          - Local absolute path
 */
export async function saveStream(readStream, storagePath, opts = {}) {
    const localPath = resolveLocalPath(storagePath);
    await ensureDir(path.dirname(localPath));
    const writeStream = createWriteStream(localPath);
    await pipeline(readStream, writeStream);
    return localPath;
}

/**
 * Save a file from a local source path to local storage
 */
export async function saveFile(sourcePath, storagePath) {
    const localPath = resolveLocalPath(storagePath);
    await ensureDir(path.dirname(localPath));
    await fsp.copyFile(sourcePath, localPath);
    return localPath;
}

/**
 * Save a Buffer or string to local storage
 */
export async function saveBuffer(buffer, storagePath) {
    const localPath = resolveLocalPath(storagePath);
    await ensureDir(path.dirname(localPath));
    await fsp.writeFile(localPath, buffer);
    return localPath;
}

/**
 * Read a file as a stream (mirrors GCS createReadStream)
 */
export function readStream(storagePath) {
    return createReadStream(resolveLocalPath(storagePath));
}

/**
 * Read a file as a Buffer
 */
export async function readFile(storagePath) {
    return fsp.readFile(resolveLocalPath(storagePath));
}

/**
 * Check if a file exists in local storage
 */
export async function fileExists(storagePath) {
    try {
        await fsp.access(resolveLocalPath(storagePath));
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete a file from local storage
 */
export async function deleteFile(storagePath) {
    try {
        await fsp.unlink(resolveLocalPath(storagePath));
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

/**
 * List files under a prefix (mirrors GCS getFiles)
 * Returns array of { name, localPath, size, modified }
 */
export async function listFiles(prefix) {
    const dir = resolveLocalPath(prefix);
    try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        const results = [];
        for (const entry of entries) {
            if (entry.isFile()) {
                const localPath = path.join(dir, entry.name);
                const stat = await fsp.stat(localPath);
                results.push({
                    name:      path.join(prefix, entry.name),
                    localPath,
                    size:      stat.size,
                    modified:  stat.mtime,
                });
            }
        }
        return results;
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

/**
 * Get a public URL for a stored file.
 * In local mode, returns a backend file-serve URL so the frontend can display it.
 */
export function getLocalUrl(storagePath, port = process.env.PORT || 58080) {
    const clean = storagePath.replace(/^gs:\/\/[^/]+\//, '').replace(/^\/+/, '');
    return `http://localhost:${port}/api/local/files/${encodeURIComponent(clean)}`;
}

/**
 * Return the root data directory (used by Electron to display to user)
 */
export function getDataDir() { return DATA_DIR; }

export default {
    saveStream, saveFile, saveBuffer,
    readStream, readFile,
    fileExists, deleteFile, listFiles,
    getLocalUrl, getDataDir,
    resolveLocalPath,
};
