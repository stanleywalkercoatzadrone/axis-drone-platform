/**
 * orthomosaicEngine.js — OpenDroneMap Integration (Streaming v2)
 *
 * Fixes critical Cloud Run failures from v1:
 *  - v1 downloaded ALL images to /tmp before uploading → crashed Cloud Run's
 *    512 MB tmpfs for large missions (345+ images = 1-7 GB).
 *  - v1 used POST /task/new with a single huge multipart body → timed out.
 *  - v1 buffered entire output files in RAM → OOM on large GeoTIFFs.
 *
 * v2 fix:
 *  1. POST /task/new/init          — get a task UUID, no images yet.
 *  2. POST /task/new/upload/<id>   — stream each image from GCS → ODM (no local disk).
 *  3. POST /task/new/commit/<id>   — start ODM processing with options.
 *  4. GET  /task/<id>/info         — poll every 8s until done.
 *  5. GET  /task/<id>/download/... — stream outputs ODM → GCS (no RAM buffering).
 *
 *  NOTE: NodeODM v2.x uses /task/new/upload and /task/new/commit paths.
 *  The shorter /task/<id>/upload path was removed in v2 and returns 404.
 */

import FormData from 'form-data';
import fetch from 'node-fetch';
import { Storage } from '@google-cloud/storage';
import { logger } from './logger.js';
import { query } from '../config/database.js';
import { pipeline } from 'stream/promises';

const ODM_URL    = process.env.ODM_URL        || 'http://35.185.234.59:3000';
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';

let gcs;
try {
    gcs = new Storage({ projectId: process.env.GCS_PROJECT_ID });
} catch (e) {
    logger.warn('[Orthomosaic] GCS init failed:', e.message);
}

// ── Upload images in small batches to avoid ODM connection limits ─────────────
const UPLOAD_CONCURRENCY = 5; // stream 5 images simultaneously

async function uploadBatch(taskId, batch) {
    await Promise.all(batch.map(async (file) => {
        const form = new FormData();
        // Stream directly from GCS — no local disk write at all
        const gcsStream = gcs.bucket(GCS_BUCKET).file(file.gcsPath).createReadStream();
        form.append('images', gcsStream, {
            filename: file.name,
            contentType: 'image/jpeg',
        });
        const res = await fetch(`${ODM_URL}/task/new/upload/${taskId}`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
            timeout: 120_000, // 2 min per image upload
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error(`ODM upload failed for ${file.name}: ${res.status} ${txt}`);
        }
        await res.json().catch(() => {}); // drain
    }));
}

/**
 * @param {object} imageSet
 *   { jobId, missionId, files: [{name, gcsPath}], gcsProcessedPrefix, fastMode }
 * @param {function} onProgress  (pct: number) => void
 * @returns {Promise<{orthomosaicGcsUri, dsmGcsUri, archiveGcsUri}>}
 */
export async function runOrthomosaic(imageSet, onProgress) {
    const { jobId, missionId, files, gcsProcessedPrefix, fastMode = false } = imageSet;

    if (!files || files.length === 0) {
        throw new Error('No images provided for orthomosaic processing.');
    }
    if (!gcs) {
        throw new Error('GCS storage not initialised — check GCS_PROJECT_ID env var.');
    }

    logger.info(`[Orthomosaic] Starting streaming pipeline for job ${jobId} — ${files.length} images (fastMode=${fastMode})`);

    // ── Step 1: Initialise ODM task (get UUID) ────────────────────────────────
    logger.info(`[Orthomosaic] Initialising NodeODM task at ${ODM_URL}...`);
    const initRes = await fetch(`${ODM_URL}/task/new/init`, {
        method: 'POST',
        timeout: 30_000,
    });
    if (!initRes.ok) {
        const txt = await initRes.text().catch(() => '');
        throw new Error(`NodeODM /task/new/init failed: ${initRes.status} ${txt}`);
    }
    const { uuid: taskId } = await initRes.json();
    logger.info(`[Orthomosaic] ODM task UUID: ${taskId}`);

    // Persist taskId immediately so the job can be recovered if the container restarts
    await query(
        `UPDATE orthomosaic_jobs SET engine_job_id = $1, pipeline_stage = 'Uploading Images', updated_at = NOW() WHERE id = $2`,
        [taskId, jobId]
    ).catch(() => {});

    // ── Step 2: Stream images GCS → ODM (batched, no local disk) ─────────────
    logger.info(`[Orthomosaic] Streaming ${files.length} images to ODM (${UPLOAD_CONCURRENCY} concurrent)...`);
    let uploaded = 0;
    for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
        const batch = files.slice(i, i + UPLOAD_CONCURRENCY);
        await uploadBatch(taskId, batch);
        uploaded += batch.length;
        const pct = Math.round((uploaded / files.length) * 30); // 0-30% = upload phase
        onProgress(pct);
        logger.info(`[Orthomosaic] Uploaded ${uploaded}/${files.length} images`);
    }

    // ── Step 3: Commit task with processing options ───────────────────────────
    logger.info(`[Orthomosaic] Committing ODM task ${taskId}...`);
    const options = [
        { name: 'auto-boundary',    value: true },
        { name: 'dsm',             value: true },
        { name: 'fast-orthophoto', value: fastMode },
        { name: 'feature-quality', value: fastMode ? 'low' : 'high' },
        { name: 'min-num-features', value: fastMode ? 4000 : 8000 },
    ];

    const commitRes = await fetch(`${ODM_URL}/task/new/commit/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options }),
        timeout: 30_000,
    });
    if (!commitRes.ok) {
        const txt = await commitRes.text().catch(() => '');
        throw new Error(`NodeODM commit failed: ${commitRes.status} ${txt}`);
    }

    await query(
        `UPDATE orthomosaic_jobs SET pipeline_stage = 'ODM Running', updated_at = NOW() WHERE id = $1`,
        [jobId]
    ).catch(() => {});
    logger.info(`[Orthomosaic] ODM task committed. Processing started.`);

    // ── Step 4: Poll until complete ───────────────────────────────────────────
    let isCompleted = false;
    let consecutiveErrors = 0;
    while (!isCompleted) {
        await new Promise(res => setTimeout(res, 8_000)); // poll every 8s

        let info;
        try {
            const infoRes = await fetch(`${ODM_URL}/task/${taskId}/info`, { timeout: 15_000 });
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
            // Map ODM 0-100 progress into 30-95% of our overall progress scale
            const rawPct = info.progress || 0;
            onProgress(30 + Math.round(rawPct * 0.65));
        }
    }

    logger.info(`[Orthomosaic] ODM processing complete. Streaming outputs to GCS...`);

    // ── Step 5: Stream outputs ODM → GCS (no in-memory buffering) ────────────
    const outputsToFetch = [
        { url: `${ODM_URL}/task/${taskId}/download/odm_orthophoto/odm_orthophoto.tif`, name: 'orthomosaic.tif', contentType: 'image/tiff' },
        { url: `${ODM_URL}/task/${taskId}/download/odm_dem/dsm.tif`,                   name: 'dsm.tif',         contentType: 'image/tiff' },
        { url: `${ODM_URL}/task/${taskId}/download/all.zip`,                            name: 'all.zip',         contentType: 'application/zip' },
    ];

    const results = { orthomosaicGcsUri: null, dsmGcsUri: null, archiveGcsUri: null };

    for (const { url, name, contentType } of outputsToFetch) {
        try {
            const r = await fetch(url, { timeout: 300_000 }); // 5 min per output
            if (!r.ok) {
                logger.warn(`[Orthomosaic] Output ${name} not available (${r.status})`);
                continue;
            }

            const gcsPath = `${gcsProcessedPrefix}${name}`;
            const writeStream = gcs.bucket(GCS_BUCKET).file(gcsPath).createWriteStream({
                metadata: { contentType },
                resumable: true, // resumable for large files
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
    fetch(`${ODM_URL}/task/${taskId}/remove`, { method: 'POST' })
        .catch(e => logger.warn(`[Orthomosaic] Could not clean up ODM task: ${e.message}`));

    return results;
}

export default { runOrthomosaic };
