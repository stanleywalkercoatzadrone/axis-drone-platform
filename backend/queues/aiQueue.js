/**
 * AI Job Queue — Axis Enterprise Platform
 *
 * Database-backed job queue for async AI processing.
 * Uses the `ai_jobs` table as persistent storage — no Redis required.
 * Designed for polling-based consumption by aiWorker.js.
 *
 * When ENABLE_ASYNC_AI=false (default): this module exists but is never called.
 * When ENABLE_ASYNC_AI=true: AI routes enqueue here instead of calling Gemini inline.
 */

import { query } from '../config/database.js';
import { logger } from '../services/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Job status enum.
 */
export const JOB_STATUS = {
    PENDING:    'pending',
    PROCESSING: 'processing',
    COMPLETED:  'completed',
    FAILED:     'failed',
};

/**
 * Enqueue a new AI analysis job.
 *
 * @param {string} missionId - UUID of the associated mission/deployment
 * @param {string} mediaId   - UUID of the uploaded media file
 * @param {object} options   - { userId, tenantId, analysisType, metadata }
 * @returns {Promise<string>} jobId
 */
export async function enqueue(missionId, mediaId, options = {}) {
    const jobId = uuidv4();

    await query(
        `INSERT INTO ai_jobs
           (id, mission_id, media_id, status, attempts, max_attempts,
            user_id, tenant_id, analysis_type, metadata)
         VALUES ($1, $2, $3, $4, 0, 3, $5, $6, $7, $8)`,
        [
            jobId,
            missionId || null,
            mediaId   || null,
            JOB_STATUS.PENDING,
            options.userId       || null,
            options.tenantId     || null,
            options.analysisType || 'inspection',
            JSON.stringify(options.metadata || {}),
        ]
    );

    logger.info('[AIQueue] Job enqueued', { jobId, missionId, mediaId });
    return jobId;
}

/**
 * Pull the next pending job eligible for processing.
 * Uses SELECT FOR UPDATE SKIP LOCKED for concurrency safety.
 *
 * @returns {Promise<object|null>} Job row or null if queue is empty
 */
export async function getNextPending() {
    const result = await query(
        `SELECT * FROM ai_jobs
         WHERE status = $1
           AND attempts < max_attempts
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [JOB_STATUS.PENDING]
    );
    return result.rows[0] || null;
}

/**
 * Mark a job as processing (increment attempts counter).
 * @param {string} jobId
 */
export async function markProcessing(jobId) {
    await query(
        `UPDATE ai_jobs
         SET status    = $1,
             attempts  = attempts + 1,
             updated_at = NOW()
         WHERE id = $2`,
        [JOB_STATUS.PROCESSING, jobId]
    );
}

/**
 * Mark a job as completed with the result JSON.
 * @param {string} jobId
 * @param {object} result - Structured analysis result from Gemini
 */
export async function markCompleted(jobId, result) {
    await query(
        `UPDATE ai_jobs
         SET status      = $1,
             result_json = $2,
             error       = NULL,
             updated_at  = NOW()
         WHERE id = $3`,
        [JOB_STATUS.COMPLETED, JSON.stringify(result), jobId]
    );
    logger.info('[AIQueue] Job completed', { jobId });
}

/**
 * Mark a job as failed with error message.
 * If max_attempts exceeded, sets status to 'failed'. Otherwise 'pending' for retry.
 *
 * @param {string} jobId
 * @param {string} errorMessage
 * @param {number} currentAttempts - Current attempt count
 * @param {number} maxAttempts     - Max allowed attempts
 */
export async function markFailed(jobId, errorMessage, currentAttempts, maxAttempts) {
    const isExhausted = currentAttempts >= maxAttempts;
    const newStatus   = isExhausted ? JOB_STATUS.FAILED : JOB_STATUS.PENDING;

    await query(
        `UPDATE ai_jobs
         SET status     = $1,
             error      = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [newStatus, errorMessage, jobId]
    );

    if (isExhausted) {
        logger.error('[AIQueue] Job permanently failed', { jobId, errorMessage, currentAttempts });
    } else {
        logger.warn('[AIQueue] Job failed, will retry', { jobId, errorMessage, currentAttempts });
    }
}

/**
 * Get a job by ID (for status polling).
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
export async function getJobById(jobId) {
    const result = await query(
        `SELECT id, mission_id, media_id, status, attempts, max_attempts,
                result_json, error, analysis_type, user_id, tenant_id,
                created_at, updated_at
         FROM ai_jobs WHERE id = $1`,
        [jobId]
    );
    return result.rows[0] || null;
}

/**
 * List jobs for a user (or all if admin).
 * @param {object} options - { userId, tenantId, isAdmin, limit, offset }
 * @returns {Promise<object[]>}
 */
export async function listJobs({ userId, tenantId, isAdmin = false, limit = 20, offset = 0 } = {}) {
    const params = [tenantId, limit, offset];
    let whereClause = 'WHERE tenant_id = $1';

    if (!isAdmin) {
        params.splice(1, 0, userId);
        whereClause += ` AND user_id = $2`;
        params[params.indexOf(limit)] ; // re-index handled by positional
    }

    // Rebuild cleanly
    const filterParams = isAdmin
        ? [tenantId, limit, offset]
        : [tenantId, userId, limit, offset];

    const whereAdmin  = `WHERE tenant_id = $1`;
    const whereUser   = `WHERE tenant_id = $1 AND user_id = $2`;
    const limitIdx    = isAdmin ? 2 : 3;
    const offsetIdx   = isAdmin ? 3 : 4;

    const sql = `
        SELECT id, mission_id, media_id, status, attempts, max_attempts,
               analysis_type, error, created_at, updated_at
        FROM ai_jobs
        ${isAdmin ? whereAdmin : whereUser}
        ORDER BY created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await query(sql, filterParams);
    return result.rows;
}
