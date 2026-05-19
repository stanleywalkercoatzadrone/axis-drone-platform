/**
 * orthomosaicEngine.js — OpenDroneMap Integration
 *
 * Full photogrammetry engine utilizing the active NodeODM cluster.
 */
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { Storage } from '@google-cloud/storage';
import { logger } from './logger.js';
import { query } from '../config/database.js';

const ODM_URL = process.env.ODM_URL || 'http://35.185.234.59:3000';
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';
let gcs;
try {
    gcs = new Storage({ projectId: process.env.GCS_PROJECT_ID });
} catch (e) {
    logger.warn('[Orthomosaic] GCS init failed:', e.message);
}

/**
 * @param {object} imageSet  - Result of loadImagesFromGCS()
 * @param {function} onProgress - (pct: number) => void
 * @returns {Promise<object>}
 */
export async function runOrthomosaic(imageSet, onProgress) {
    const { datasetId, missionId, files, localTmpDir, gcsProcessedPrefix } = imageSet;
    if (!files || files.length === 0) {
        throw new Error('No images provided for orthomosaic processing.');
    }

    logger.info(`[Orthomosaic] Starting ODM processing for dataset ${datasetId} with ${files.length} images`);
    
    // ── 1. Download images from GCS to local tmp dir ──
    await fs.mkdir(localTmpDir, { recursive: true });
    logger.info(`[Orthomosaic] Downloading images to ${localTmpDir}...`);
    
    for (const file of files) {
        const destPath = path.join(localTmpDir, file.name);
        await gcs.bucket(GCS_BUCKET).file(file.gcsPath).download({ destination: destPath });
    }

    // ── 2. Create FormData and submit to NodeODM ──
    logger.info(`[Orthomosaic] Submitting task to NodeODM at ${ODM_URL}...`);
    const formData = new FormData();
    const options = {
        "auto-boundary": true,
        "dsm": true,
        "fast-orthophoto": false, // use full quality
        "feature-quality": "high"
    };
    formData.append('options', JSON.stringify(options));

    for (const file of files) {
        const localFilePath = path.join(localTmpDir, file.name);
        formData.append('images', createReadStream(localFilePath), file.name);
    }

    const newTaskRes = await fetch(`${ODM_URL}/task/new`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
    });

    if (!newTaskRes.ok) {
        const errText = await newTaskRes.text();
        throw new Error(`NodeODM rejected task: ${newTaskRes.status} ${errText}`);
    }

    const { uuid: taskId } = await newTaskRes.json();
    logger.info(`[Orthomosaic] NodeODM task started with ID: ${taskId}`);

    // Update DB with the engine job ID for recovery tracking
    await query(`UPDATE orthomosaic_jobs SET engine_job_id = $1 WHERE dataset_id = $2`, [taskId, datasetId]).catch(() => {});

    // ── 3. Poll for progress ──
    let isCompleted = false;
    while (!isCompleted) {
        await new Promise(res => setTimeout(res, 5000)); // Poll every 5s

        const infoRes = await fetch(`${ODM_URL}/task/${taskId}/info`);
        if (!infoRes.ok) continue;

        const info = await infoRes.json();
        const code = info.status?.code;
        
        // 10=Queued, 20=Running, 30=Failed, 40=Completed, 50=Canceled
        if (code === 30 || code === 50) {
            throw new Error(`ODM Task Failed or Canceled (Code: ${code}). Error: ${info.error || 'Unknown'}`);
        }

        if (code === 40) {
            isCompleted = true;
            onProgress(100);
        } else {
            // progress is 0-100
            onProgress(info.progress || 0);
        }
    }

    logger.info(`[Orthomosaic] ODM processing finished. Downloading outputs...`);

    // ── 4. Download and upload outputs to GCS ──
    const outputsToFetch = [
        { asset: 'odm_orthophoto/odm_orthophoto.tif', name: 'orthomosaic.tif' },
        { asset: 'odm_dem/dsm.tif', name: 'dsm.tif' },
        { asset: 'all.zip', name: 'all.zip', isRoot: true }
    ];

    const results = { orthomosaicGcsUri: null, dsmGcsUri: null, archiveGcsUri: null };

    for (const { asset, name, isRoot } of outputsToFetch) {
        try {
            const url = isRoot ? `${ODM_URL}/task/${taskId}/download/all.zip` : `${ODM_URL}/task/${taskId}/download/${asset}`;
            const headRes = await fetch(url, { method: 'HEAD' });
            if (!headRes.ok) {
                logger.warn(`[Orthomosaic] Output ${name} not available (${headRes.status})`);
                continue;
            }

            const r = await fetch(url);
            const buf = Buffer.from(await r.arrayBuffer());
            const gcsPath = `${gcsProcessedPrefix}${name}`;
            
            await gcs.bucket(GCS_BUCKET).file(gcsPath).save(buf, {
                contentType: name.endsWith('.zip') ? 'application/zip' : 'image/tiff'
            });

            const gcsUri = `gs://${GCS_BUCKET}/${gcsPath}`;
            logger.info(`[Orthomosaic] Saved ${name} → ${gcsUri}`);

            if (name === 'orthomosaic.tif') results.orthomosaicGcsUri = gcsUri;
            if (name === 'dsm.tif') results.dsmGcsUri = gcsUri;
            if (name === 'all.zip') results.archiveGcsUri = gcsUri;

        } catch (err) {
            logger.error(`[Orthomosaic] Failed to fetch/upload ${name}: ${err.message}`);
        }
    }

    // ── 5. Cleanup local temp directory ──
    try {
        await fs.rm(localTmpDir, { recursive: true, force: true });
    } catch (e) {
        logger.warn(`[Orthomosaic] Failed to cleanup ${localTmpDir}: ${e.message}`);
    }

    return results;
}

export default { runOrthomosaic };
