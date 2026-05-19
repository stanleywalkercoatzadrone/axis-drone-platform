/**
 * uploadStatus.js — Pipeline status updater
 * Centralized DB writer for pipeline_jobs + mission_datasets status sync.
 */
import { query } from '../config/database.js';
import { logger } from './logger.js';

// STATUS LIFECYCLE: uploading → queued → processing → analyzing → completed → failed

/**
 * Update a pipeline_job row status + progress.
 * Also syncs the parent mission_datasets row.
 */
export async function updatePipelineJobStatus(jobId, status, progress = null, errorMessage = null) {
    try {
        const fields = ['status = $2', 'updated_at = NOW()'];
        const values = [jobId, status];
        let idx = 3;

        if (progress !== null) { fields.push(`progress = $${idx++}`); values.push(progress); }
        if (errorMessage)      { fields.push(`error_message = $${idx++}`); values.push(errorMessage); }
        if (status === 'processing') { fields.push(`started_at = NOW()`); }
        if (['completed', 'failed'].includes(status)) { fields.push(`completed_at = NOW()`); }

        const jobRes = await query(
            `UPDATE pipeline_jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING dataset_id`,
            values
        );

        // Sync up to parent dataset
        if (jobRes.rows[0]?.dataset_id) {
            await syncDatasetStatus(jobRes.rows[0].dataset_id, status, progress, errorMessage);
        }

        logger.info(`[Pipeline] Job ${jobId} → ${status} (${progress ?? '?'}%)`);
    } catch (err) {
        logger.error(`[Pipeline] updatePipelineJobStatus error: ${err.message}`);
    }
}

/**
 * Update the mission_datasets pipeline status from a job.
 */
export async function syncDatasetStatus(datasetId, status, progress, errorMessage) {
    try {
        const fields = ['pipeline_status = $2', 'updated_at = NOW()'];
        const values = [datasetId, status];
        let idx = 3;

        if (progress !== null) { fields.push(`pipeline_progress = $${idx++}`); values.push(progress); }
        if (errorMessage)      { fields.push(`error_message = $${idx++}`); values.push(errorMessage); }
        if (status === 'completed') { fields.push(`completed_at = NOW()`); }
        if (status === 'processing') { fields.push(`started_at = NOW()`); }

        await query(`UPDATE mission_datasets SET ${fields.join(', ')} WHERE id = $1`, values);
    } catch (err) {
        logger.error(`[Pipeline] syncDatasetStatus error: ${err.message}`);
    }
}

/**
 * Save AI analysis result back to pipeline_job + dataset.
 */
export async function saveAIResults(jobId, datasetId, aiResult) {
    try {
        await query(
            `UPDATE pipeline_jobs SET ai_result = $2, updated_at = NOW() WHERE id = $1`,
            [jobId, JSON.stringify(aiResult)]
        );
        await query(
            `UPDATE mission_datasets SET ai_summary = $2, updated_at = NOW() WHERE id = $1`,
            [datasetId, JSON.stringify(aiResult)]
        );
        logger.info(`[Pipeline] AI results saved for job ${jobId}`);
    } catch (err) {
        logger.error(`[Pipeline] saveAIResults error: ${err.message}`);
    }
}

/**
 * Get a pipeline_job with its parent dataset info.
 */
export async function getPipelineJob(jobId) {
    const res = await query(
        `SELECT pj.*, md.mission_id, md.tenant_id, md.gcs_raw_prefix
         FROM pipeline_jobs pj
         JOIN mission_datasets md ON md.id = pj.dataset_id
         WHERE pj.id = $1`,
        [jobId]
    );
    return res.rows[0] || null;
}
