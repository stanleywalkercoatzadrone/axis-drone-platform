/**
 * storage.js — GCS Storage helper for the processing pipeline.
 * Provides image loading, result upload, and signed URL generation.
 */
import { Storage } from '@google-cloud/storage';
import { logger } from './logger.js';
import { query } from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-storage';

let gcs;
try {
    gcs = new Storage({ projectId: process.env.GCS_PROJECT_ID });
} catch (e) {
    logger.warn('[Storage] GCS init failed:', e.message);
}

/**
 * List all raw images for a dataset from GCS and return metadata.
 * Returns: { path: localTmpDir, gcsPrefix, files: [{ name, gcsUri }] }
 */
export async function loadImagesFromGCS(datasetId) {
    // Get dataset's raw prefix from DB
    const res = await query(
        `SELECT gcs_raw_prefix, mission_id, tenant_id FROM mission_datasets WHERE id = $1`,
        [datasetId]
    );
    const dataset = res.rows[0];
    if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

    const prefix = dataset.gcs_raw_prefix || `missions/${dataset.mission_id}/raw/`;
    const tmpDir = path.join(os.tmpdir(), `axis_pipeline_${datasetId}`);

    // Return GCS file references without downloading (ODM runs directly on GCS mount or local)
    const files = [];
    if (gcs) {
        try {
            const [gcsFiles] = await gcs.bucket(GCS_BUCKET).getFiles({ prefix });
            for (const f of gcsFiles) {
                files.push({
                    name: path.basename(f.name),
                    gcsUri: `gs://${GCS_BUCKET}/${f.name}`,
                    gcsPath: f.name,
                });
            }
        } catch (e) {
            logger.warn(`[Storage] GCS file list failed: ${e.message}`);
        }
    }

    logger.info(`[Storage] Dataset ${datasetId}: ${files.length} files in gs://${GCS_BUCKET}/${prefix}`);

    return {
        datasetId,
        missionId: dataset.mission_id,
        gcsPrefix: prefix,
        gcsProcessedPrefix: `missions/${dataset.mission_id}/processed/${datasetId}/`,
        gcsAIPrefix: `missions/${dataset.mission_id}/ai/${datasetId}/`,
        localTmpDir: tmpDir,
        files,
        imageCount: files.length,
    };
}

/**
 * Upload a processing result file to GCS.
 */
export async function uploadResultToGCS(localPath, gcsDestPath) {
    if (!gcs) {
        logger.warn('[Storage] GCS not available — skipping upload');
        return null;
    }
    try {
        await gcs.bucket(GCS_BUCKET).upload(localPath, { destination: gcsDestPath });
        logger.info(`[Storage] Uploaded ${localPath} → gs://${GCS_BUCKET}/${gcsDestPath}`);
        return `gs://${GCS_BUCKET}/${gcsDestPath}`;
    } catch (e) {
        logger.error(`[Storage] Upload failed: ${e.message}`);
        throw e;
    }
}

/**
 * Write a JSON result to GCS directly from memory.
 */
export async function uploadJSONToGCS(data, gcsDestPath) {
    if (!gcs) return null;
    try {
        const file = gcs.bucket(GCS_BUCKET).file(gcsDestPath);
        await file.save(JSON.stringify(data, null, 2), { contentType: 'application/json' });
        return `gs://${GCS_BUCKET}/${gcsDestPath}`;
    } catch (e) {
        logger.error(`[Storage] JSON upload failed: ${e.message}`);
        return null;
    }
}

/**
 * Generate a signed download URL for a GCS object.
 */
export async function getSignedDownloadUrl(gcsPath, expiresInMinutes = 60) {
    if (!gcs || !gcsPath) return null;
    // Strip gs:// prefix if present
    const cleanPath = gcsPath.replace(`gs://${GCS_BUCKET}/`, '');
    try {
        const [url] = await gcs.bucket(GCS_BUCKET).file(cleanPath).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + expiresInMinutes * 60 * 1000,
        });
        return url;
    } catch (e) {
        logger.error(`[Storage] Signed URL error: ${e.message}`);
        return null;
    }
}

/**
 * Store processing results metadata and update dataset.
 * Returns a public/signed URL for the primary output.
 */
export async function storeResults(datasetId, result) {
    try {
        // Update dataset with processed GCS prefix
        await query(
            `UPDATE mission_datasets SET gcs_processed_prefix = $2, result_url = $3, updated_at = NOW() WHERE id = $1`,
            [datasetId, result.gcsProcessedPrefix || null, result.orthomosaicGcsUri || null]
        );
    } catch (e) {
        logger.error(`[Storage] storeResults DB update failed: ${e.message}`);
    }
    return result;
}
