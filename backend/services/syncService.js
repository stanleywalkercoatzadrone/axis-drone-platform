/**
 * syncService.js — Axis Platform sync for local (offline) mode
 *
 * When internet is available, syncs completed local orthomosaic jobs to:
 *   1. GCS (upload output files)
 *   2. Axis Platform API (register job record so it appears in the cloud dashboard)
 *
 * Called by:
 *   - Electron main.js (via POST /api/local/sync) on connectivity restore
 *   - Manual "Sync Now" button in the UI
 */

import fetch   from 'node-fetch';
import fsp     from 'fs/promises';
import path    from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import { logger } from './logger.js';
import {
    getUnsyncedJobs, markSynced, updateJob, logSync,
} from './localDatabase.js';

const AXIS_API_URL    = process.env.AXIS_API_URL    || 'https://axisplatform.app/api';
const AXIS_SYNC_TOKEN = process.env.AXIS_SYNC_TOKEN || ''; // set during Electron setup/login

// GCS (cloud) — only needed for sync, not local processing
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';

let gcs = null;
async function getGCS() {
    if (gcs) return gcs;
    const { Storage } = await import('@google-cloud/storage');
    gcs = new Storage({ projectId: process.env.GCS_PROJECT_ID });
    return gcs;
}

// ── Main sync entry point ─────────────────────────────────────────────────────

export async function syncPendingJobs() {
    const jobs = getUnsyncedJobs();
    if (jobs.length === 0) {
        logger.info('[Sync] No pending jobs to sync.');
        return { synced: 0, failed: 0, skipped: 0 };
    }

    logger.info(`[Sync] Found ${jobs.length} job(s) to sync.`);
    let synced = 0, failed = 0;

    for (const job of jobs) {
        try {
            await syncJob(job);
            synced++;
        } catch (err) {
            logger.error(`[Sync] Failed to sync job ${job.id}: ${err.message}`);
            logSync(job.id, 'complete', false, err.message);
            failed++;
        }
    }

    logger.info(`[Sync] Done. Synced: ${synced}, Failed: ${failed}`);
    return { synced, failed, skipped: 0 };
}

// ── Sync a single job ─────────────────────────────────────────────────────────

async function syncJob(job) {
    logger.info(`[Sync] Syncing job ${job.id} (mission: ${job.mission_title || 'none'})`);
    updateJob(job.id, { status: 'syncing' });

    // ── Step A: Upload output files to GCS ───────────────────────────────────
    const cloudPaths = {};
    const outputFiles = [
        { key: 'orthomosaic', localPath: job.orthomosaic_path, name: 'orthomosaic.tif', contentType: 'image/tiff' },
        { key: 'dsm',         localPath: job.dsm_path,         name: 'dsm.tif',         contentType: 'image/tiff' },
        { key: 'archive',     localPath: job.archive_path,     name: 'all.zip',          contentType: 'application/zip' },
    ];

    const storage = await getGCS().catch(() => null);
    const hasGCS = !!storage && !!process.env.GCS_PROJECT_ID;

    if (hasGCS) {
        for (const { key, localPath, name, contentType } of outputFiles) {
            if (!localPath) continue;
            try {
                const exists = await fsp.access(localPath).then(() => true).catch(() => false);
                if (!exists) { logger.warn(`[Sync] File not found: ${localPath}`); continue; }

                const gcsPath = `processed/${job.id}/${name}`;
                const writeStream = storage.bucket(GCS_BUCKET).file(gcsPath).createWriteStream({
                    metadata: { contentType },
                    resumable: true,
                });
                await pipeline(createReadStream(localPath), writeStream);

                const gcsUri = `gs://${GCS_BUCKET}/${gcsPath}`;
                cloudPaths[key] = gcsUri;
                logger.info(`[Sync] ✓ Uploaded ${name} → ${gcsUri}`);
                logSync(job.id, `upload_${key}`, true, gcsUri);
            } catch (err) {
                logger.error(`[Sync] Failed to upload ${name}: ${err.message}`);
                logSync(job.id, `upload_${key}`, false, err.message);
            }
        }
    } else {
        logger.warn('[Sync] GCS not configured — skipping file upload, will still register job record.');
    }

    // ── Step B: Register job in Axis Platform API ─────────────────────────────
    let cloudJobId = null;
    if (AXIS_SYNC_TOKEN) {
        try {
            const payload = {
                localJobId:        job.id,
                missionId:         job.mission_id   || null,
                missionTitle:      job.mission_title || null,
                imageCount:        job.image_count,
                fastMode:          !!job.fast_mode,
                orthomosaicGcsUri: cloudPaths.orthomosaic || null,
                dsmGcsUri:         cloudPaths.dsm         || null,
                archiveGcsUri:     cloudPaths.archive     || null,
                processedAt:       job.updated_at,
                source:            'local_desktop',
            };

            const res = await fetch(`${AXIS_API_URL}/orthomosaic/sync-local`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${AXIS_SYNC_TOKEN}`,
                },
                body:    JSON.stringify(payload),
                timeout: 30_000,
            });

            if (res.ok) {
                const data = await res.json();
                cloudJobId = data.jobId || data.id || null;
                logger.info(`[Sync] ✓ Registered in Axis Platform (cloud job: ${cloudJobId})`);
                logSync(job.id, 'notify_api', true, cloudJobId);
            } else {
                const txt = await res.text().catch(() => '');
                logger.warn(`[Sync] API registration failed: ${res.status} ${txt}`);
                logSync(job.id, 'notify_api', false, `${res.status}: ${txt}`);
            }
        } catch (err) {
            logger.warn(`[Sync] API notification failed: ${err.message}`);
            logSync(job.id, 'notify_api', false, err.message);
        }
    } else {
        logger.info('[Sync] No AXIS_SYNC_TOKEN — skipping API registration.');
    }

    // ── Step C: Mark as synced ────────────────────────────────────────────────
    markSynced(job.id, {
        cloudJobId,
        cloudOrthoUri:   cloudPaths.orthomosaic || null,
        cloudDsmUri:     cloudPaths.dsm         || null,
        cloudArchiveUri: cloudPaths.archive     || null,
    });
    logSync(job.id, 'complete', true);
    logger.info(`[Sync] ✓ Job ${job.id} synced.`);
}

export default { syncPendingJobs };
