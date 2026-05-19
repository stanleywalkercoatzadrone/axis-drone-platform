/**
 * processingPipeline.js — Entry point for the upload → pipeline trigger.
 *
 * Called immediately after a file upload session is marked complete.
 * Validates the dataset, ensures GCS prefix is set, then enqueues.
 */
import { logger } from './logger.js';
import { enqueueProcessingJob } from './queue.js';
import { syncDatasetStatus } from './uploadStatus.js';
import { query } from '../config/database.js';

/**
 * Start the full processing pipeline for a completed upload dataset.
 * @param {string} datasetId — mission_datasets.id
 * @param {object} options   — { priority: 'high'|'normal'|'low' }
 */
export async function startProcessingPipeline(datasetId, options = {}) {
    logger.info(`[Pipeline] Starting pipeline for dataset ${datasetId}`);

    try {
        // 1. Load dataset metadata
        const res = await query(
            `SELECT id, mission_id, tenant_id, total_files, uploaded_files, status, pipeline_status
             FROM mission_datasets WHERE id = $1`,
            [datasetId]
        );
        const dataset = res.rows[0];
        if (!dataset) throw new Error(`Dataset ${datasetId} not found`);

        // 2. Set GCS raw prefix based on mission structure
        const rawPrefix = `missions/${dataset.mission_id}/raw/`;
        const processedPrefix = `missions/${dataset.mission_id}/processed/${datasetId}/`;
        const aiPrefix = `missions/${dataset.mission_id}/ai/${datasetId}/`;

        await query(
            `UPDATE mission_datasets
             SET gcs_raw_prefix = $2, gcs_processed_prefix = $3, ai_analysis_path = $4,
                 pipeline_status = 'queued', started_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [datasetId, rawPrefix, processedPrefix, aiPrefix]
        );

        // 3. Enqueue the processing job
        const jobId = await enqueueProcessingJob({
            datasetId:  dataset.id,
            missionId:  dataset.mission_id,
            tenantId:   dataset.tenant_id,
            type:       'orthomosaic',
            priority:   options.priority || 'normal',
        });

        logger.info(`[Pipeline] Job ${jobId} enqueued for dataset ${datasetId}`);
        return { success: true, jobId, datasetId };

    } catch (err) {
        logger.error(`[Pipeline] startProcessingPipeline failed: ${err.message}`);
        // Mark dataset as failed so UI can show error
        await syncDatasetStatus(datasetId, 'failed', 0, err.message).catch(() => {});
        throw err;
    }
}

/**
 * Get pipeline status for a dataset (for polling/status endpoint).
 */
export async function getPipelineStatus(datasetId) {
    const res = await query(
        `SELECT md.pipeline_status, md.pipeline_progress, md.error_message,
                md.gcs_processed_prefix, md.ai_summary, md.result_url,
                pj.id as job_id, pj.status as job_status, pj.progress as job_progress,
                pj.ai_result, pj.image_count, pj.started_at, pj.completed_at
         FROM mission_datasets md
         LEFT JOIN pipeline_jobs pj ON pj.dataset_id = md.id
         WHERE md.id = $1
         ORDER BY pj.created_at DESC
         LIMIT 1`,
        [datasetId]
    );
    return res.rows[0] || null;
}
