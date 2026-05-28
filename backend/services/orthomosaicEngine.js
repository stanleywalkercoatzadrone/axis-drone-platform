/**
 * orthomosaicEngine.js — OpenDroneMap Integration (Streaming v2)
 *
 * Supports two processing backends (auto-selected via env vars):
 *
 *  ── WebODM Lightning (cloud, recommended) ───────────────────────────────────
 *    Set LIGHTNING_ODM_TOKEN in .env.local to activate.
 *    Lightning is NodeODM-compatible so the same API is used end-to-end.
 *    Endpoint: https://spark1.webodm.net (or override via LIGHTNING_ODM_URL)
 *    Auth:     Authorization: Token <LIGHTNING_ODM_TOKEN>
 *    Pricing:  ~$0.02/image at webodm.net
 *
 *  ── Local Mode (Electron desktop app) ──────────────────────────────────────
 *    Set AXIS_LOCAL_MODE=true to activate.
 *    Reads images from LOCAL_DATA_DIR filesystem, writes outputs to local disk.
 *    ODM runs on localhost via Docker (port set by ODM_URL env var).
 *    No GCS or PostgreSQL required.
 *
 *  Pipeline (same for all backends):
 *  1. POST /task/new/init          — get a task UUID, no images yet.
 *  2. POST /task/new/upload/<id>   — stream each image to ODM.
 *  3. POST /task/new/commit/<id>   — start ODM processing with quality options.
 *  4. GET  /task/<id>/info         — poll every 8s until done.
 *  5. GET  /task/<id>/download/... — stream outputs to storage (GCS or local disk).
 *
 *  NOTE: NodeODM v2.x uses /task/new/upload and /task/new/commit paths.
 *  The shorter /task/<id>/upload path was removed in v2 and returns 404.
 */

import FormData from 'form-data';
import fetch from 'node-fetch';
import { pipeline } from 'stream/promises';
import { logger } from './logger.js';

// ── Engine & mode selection ───────────────────────────────────────────────────

const LOCAL_MODE      = process.env.AXIS_LOCAL_MODE === 'true';
const LIGHTNING_TOKEN = process.env.LIGHTNING_ODM_TOKEN;
const LIGHTNING_URL   = process.env.LIGHTNING_ODM_URL || 'https://spark1.webodm.net';
const SELFHOST_URL    = process.env.ODM_URL            || 'http://35.185.234.59:3000';

const ODM_URL = LOCAL_MODE
    ? (process.env.ODM_URL || 'http://localhost:58000') // Docker NodeODM on Electron port
    : (LIGHTNING_TOKEN ? LIGHTNING_URL : SELFHOST_URL);

const USING_LIGHTNING = !LOCAL_MODE && !!LIGHTNING_TOKEN;

// Upload concurrency: Lightning handles more parallel connections
const UPLOAD_CONCURRENCY = USING_LIGHTNING ? 10 : 5;

logger.info(
    LOCAL_MODE
        ? `[Orthomosaic] Engine: LOCAL (Docker NodeODM at ${ODM_URL})`
        : USING_LIGHTNING
            ? `[Orthomosaic] Engine: WebODM Lightning (${LIGHTNING_URL})`
            : `[Orthomosaic] Engine: Self-hosted NodeODM (${SELFHOST_URL})`
);

// ── Storage setup ─────────────────────────────────────────────────────────────
// In local mode: use filesystem adapter. In cloud mode: use GCS.

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';
let gcs = null;
let localStore = null;

if (LOCAL_MODE) {
    const { default: ls } = await import('./localStorageAdapter.js').catch(() => ({ default: null }));
    localStore = ls;
    logger.info('[Orthomosaic] Using local filesystem storage.');
} else {
    try {
        const { Storage } = await import('@google-cloud/storage');
        gcs = new (Storage)({ projectId: process.env.GCS_PROJECT_ID });
    } catch (e) {
        logger.warn('[Orthomosaic] GCS init failed:', e.message);
    }
}

// DB helper — no-ops in local mode (localDatabase handles persistence separately)
async function dbQuery(sql, params) {
    if (LOCAL_MODE) return; // caller uses localDatabase directly
    const { query } = await import('../config/database.js');
    return query(sql, params);
}

// ── Auth helper ───────────────────────────────────────────────────────────────
// Returns an Authorization header when using Lightning, empty otherwise.

function odmAuthHeaders(extra = {}) {
    return {
        ...extra,
        ...(LIGHTNING_TOKEN ? { Authorization: `Token ${LIGHTNING_TOKEN}` } : {}),
    };
}

// ── Upload images in batches ──────────────────────────────────────────────

async function uploadBatch(taskId, batch) {
    await Promise.all(batch.map(async (file) => {
        const form = new FormData();

        // In local mode: read from filesystem. In cloud mode: stream from GCS.
        let fileStream;
        if (LOCAL_MODE) {
            const { createReadStream } = await import('fs');
            fileStream = createReadStream(file.localPath || file.gcsPath);
        } else {
            fileStream = gcs.bucket(GCS_BUCKET).file(file.gcsPath).createReadStream();
        }

        form.append('images', fileStream, {
            filename: file.name,
            contentType: 'image/jpeg',
        });
        const res = await fetch(`${ODM_URL}/task/new/upload/${taskId}`, {
            method:  'POST',
            body:    form,
            headers: odmAuthHeaders(form.getHeaders()),
            timeout: 120_000, // 2 min per image upload
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`ODM upload failed for ${file.name}: ${res.status} ${txt}`);
        }
        await res.json().catch(() => {}); // drain
    }));
}

// ── Health check (called on startup / before job submission) ──────────────────

export async function checkOdmHealth() {
    try {
        const res = await fetch(`${ODM_URL}/info`, {
            headers: odmAuthHeaders(),
            timeout: 10_000,
        });
        if (!res.ok) return { healthy: false, engine: ODM_URL, status: res.status };
        const info = await res.json();
        return {
            healthy:  true,
            engine:   USING_LIGHTNING ? 'lightning' : 'self-hosted',
            url:      ODM_URL,
            version:  info.version || 'unknown',
        };
    } catch (e) {
        return { healthy: false, engine: ODM_URL, error: e.message };
    }
}

/**
 * runOrthomosaic — process images through ODM, save outputs to storage.
 *
 * Cloud mode: { jobId, missionId, files: [{name, gcsPath}], gcsProcessedPrefix, fastMode }
 * Local mode: { jobId, missionId, files: [{name, localPath}], outputDir, fastMode }
 *
 * @param {object}   imageSet
 * @param {function} onProgress  (pct: number) => void
 * @returns {Promise<{orthomosaicPath, dsmPath, archivePath}|{orthomosaicGcsUri, dsmGcsUri, archiveGcsUri}>}
 */
export async function runOrthomosaic(imageSet, onProgress) {
    const { jobId, missionId, files, gcsProcessedPrefix, outputDir, fastMode = false } = imageSet;

    if (!files || files.length === 0) {
        throw new Error('No images provided for orthomosaic processing.');
    }
    if (!LOCAL_MODE && !gcs) {
        throw new Error('GCS storage not initialised — check GCS_PROJECT_ID env var.');
    }

    const engineLabel = LOCAL_MODE ? 'local' : USING_LIGHTNING ? 'Lightning' : 'self-hosted';
    logger.info(
        `[Orthomosaic] Starting pipeline for job ${jobId} — ` +
        `${files.length} images (fastMode=${fastMode}, engine=${engineLabel})`
    );

    // ── Step 1: Initialise ODM task (get UUID) ─────────────────────────────────────
    logger.info(`[Orthomosaic] Initialising task at ${ODM_URL}...`);
    const initRes = await fetch(`${ODM_URL}/task/new/init`, {
        method:  'POST',
        headers: odmAuthHeaders(),
        timeout: 30_000,
    });
    if (!initRes.ok) {
        const txt = await initRes.text().catch(() => '');
        throw new Error(`ODM /task/new/init failed: ${initRes.status} ${txt}`);
    }
    const { uuid: taskId } = await initRes.json();
    logger.info(`[Orthomosaic] Task UUID: ${taskId}`);

    // Persist taskId so the job can be recovered if the container restarts
    await query(
        `UPDATE orthomosaic_jobs SET engine_job_id = $1, pipeline_stage = 'Uploading Images', updated_at = NOW() WHERE id = $2`,
        [taskId, jobId]
    ).catch(() => {});

    // ── Step 2: Stream images GCS → ODM (batched, no local disk) ─────────────
    logger.info(`[Orthomosaic] Streaming ${files.length} images (${UPLOAD_CONCURRENCY} concurrent)...`);
    let uploaded = 0;
    for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
        const batch = files.slice(i, i + UPLOAD_CONCURRENCY);
        await uploadBatch(taskId, batch);
        uploaded += batch.length;
        const pct = Math.round((uploaded / files.length) * 30); // 0–30% = upload phase
        onProgress(pct);
        logger.info(`[Orthomosaic] Uploaded ${uploaded}/${files.length} images`);
    }

    // ── Step 3: Commit task with processing options ───────────────────────────
    logger.info(`[Orthomosaic] Committing task ${taskId}...`);
    const options = [
        { name: 'auto-boundary',     value: true },
        { name: 'dsm',               value: true },
        { name: 'fast-orthophoto',   value: fastMode },
        { name: 'feature-quality',   value: fastMode ? 'low' : 'high' },
        { name: 'min-num-features',  value: fastMode ? 4000 : 8000 },
    ];

    const commitRes = await fetch(`${ODM_URL}/task/new/commit/${taskId}`, {
        method:  'POST',
        headers: odmAuthHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify({ options }),
        timeout: 30_000,
    });
    if (!commitRes.ok) {
        const txt = await commitRes.text().catch(() => '');
        throw new Error(`ODM commit failed: ${commitRes.status} ${txt}`);
    }

    await query(
        `UPDATE orthomosaic_jobs SET pipeline_stage = 'ODM Running', updated_at = NOW() WHERE id = $1`,
        [jobId]
    ).catch(() => {});
    logger.info(`[Orthomosaic] Task committed. Processing started.`);

    // ── Step 4: Poll until complete ───────────────────────────────────────────
    let isCompleted = false;
    let consecutiveErrors = 0;
    while (!isCompleted) {
        await new Promise(res => setTimeout(res, 8_000)); // poll every 8s

        let info;
        try {
            const infoRes = await fetch(`${ODM_URL}/task/${taskId}/info`, {
                headers: odmAuthHeaders(),
                timeout: 15_000,
            });
            if (!infoRes.ok) { consecutiveErrors++; continue; }
            info = await infoRes.json();
            consecutiveErrors = 0;
        } catch (e) {
            consecutiveErrors++;
            logger.warn(`[Orthomosaic] Poll error #${consecutiveErrors}: ${e.message}`);
            if (consecutiveErrors >= 10) throw new Error(`Lost contact with ODM after 10 consecutive failures.`);
            continue;
        }

        const code = info.status?.code;
        // 10=Queued, 20=Running, 30=Failed, 40=Completed, 50=Canceled
        if (code === 30 || code === 50) {
            throw new Error(`ODM task ${taskId} failed/canceled (code ${code}). Error: ${info.error || 'Unknown'}`);
        }
        if (code === 40) {
            isCompleted = true;
            onProgress(100);
        } else {
            // Map ODM 0-100 progress into 30–95% of our overall progress scale
            const rawPct = info.progress || 0;
            onProgress(30 + Math.round(rawPct * 0.65));
        }
    }

    logger.info(`[Orthomosaic] Processing complete. Streaming outputs to GCS...`);

    // ── Step 5: Stream outputs ODM → GCS (no in-memory buffering) ────────────
    const outputsToFetch = [
        { url: `${ODM_URL}/task/${taskId}/download/odm_orthophoto/odm_orthophoto.tif`, name: 'orthomosaic.tif', contentType: 'image/tiff' },
        { url: `${ODM_URL}/task/${taskId}/download/odm_dem/dsm.tif`,                   name: 'dsm.tif',         contentType: 'image/tiff' },
        { url: `${ODM_URL}/task/${taskId}/download/all.zip`,                            name: 'all.zip',         contentType: 'application/zip' },
    ];

    const results = { orthomosaicGcsUri: null, dsmGcsUri: null, archiveGcsUri: null };

    for (const { url, name, contentType } of outputsToFetch) {
        try {
            const r = await fetch(url, {
                headers: odmAuthHeaders(),
                timeout: 300_000, // 5 min per output file
            });
            if (!r.ok) {
                logger.warn(`[Orthomosaic] Output ${name} not available (${r.status})`);
                continue;
            }

            const gcsPath = `${gcsProcessedPrefix}${name}`;
            const writeStream = gcs.bucket(GCS_BUCKET).file(gcsPath).createWriteStream({
                metadata:  { contentType },
                resumable: true, // resumable for large GeoTIFFs
            });

            // Pipe ODM response stream → GCS write stream (zero RAM buffering)
            await pipeline(r.body, writeStream);

            const gcsUri = `gs://${GCS_BUCKET}/${gcsPath}`;
            logger.info(`[Orthomosaic] ✓ Saved ${name} → ${gcsUri}`);

            if (name === 'orthomosaic.tif') results.orthomosaicGcsUri = gcsUri;
            if (name === 'dsm.tif')         results.dsmGcsUri         = gcsUri;
            if (name === 'all.zip')         results.archiveGcsUri     = gcsUri;
        } catch (err) {
            logger.error(`[Orthomosaic] Failed to save ${name}: ${err.message}`);
        }
    }

    // ── Step 6: Cleanup ODM task from server ─────────────────────────────────
    fetch(`${ODM_URL}/task/${taskId}/remove`, {
        method:  'POST',
        headers: odmAuthHeaders(),
    }).catch(e => logger.warn(`[Orthomosaic] Could not clean up ODM task: ${e.message}`));

    return results;
}

export default { runOrthomosaic, checkOdmHealth };
