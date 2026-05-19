/**
 * jobAdvancer.js
 *
 * Server-side background loop that advances all in-flight processing jobs
 * every 15 seconds, completely independent of browser connections.
 *
 * This means:
 *  - The user can leave the page and come back — processing continues.
 *  - The DB is always up to date, so the UI shows the right state on return.
 *  - MockEngine jobs use time-based progress so they survive process restarts.
 *  - Real engine jobs (AxisEngine, ODMEngine) are polled and their DB rows updated.
 */

import { query } from '../config/database.js';
import { getEngine } from './photogrammetryEngine.js';
import { logger } from './logger.js';

// Total mock pipeline duration (ms) — must match MOCK_STAGES in photogrammetryEngine.js
const MOCK_TOTAL_MS = 35_000;

// Mock stage names in order, for realistic status messages
const MOCK_STAGES = [
    { pct: 8,   label: 'Image Ingestion' },
    { pct: 14,  label: 'Metadata Extraction' },
    { pct: 28,  label: 'Feature Detection' },
    { pct: 42,  label: 'Feature Matching' },
    { pct: 55,  label: 'Sparse Reconstruction' },
    { pct: 68,  label: 'Dense Reconstruction' },
    { pct: 78,  label: 'Surface Generation' },
    { pct: 87,  label: 'Orthorectification' },
    { pct: 94,  label: 'Orthomosaic Generation' },
    { pct: 100, label: 'Tile Generation' },
];

function mockProgressFromTimestamp(processingStartedAt) {
    if (!processingStartedAt) return { pct: 0, stage: 'Initializing', done: false };
    const elapsed = Date.now() - new Date(processingStartedAt).getTime();
    const pct = Math.min(100, Math.round((elapsed / MOCK_TOTAL_MS) * 100));
    const stage = MOCK_STAGES.find(s => pct <= s.pct)?.label || 'Tile Generation';
    return { pct, stage, done: pct >= 100 };
}

async function advanceJobs() {
    try {
        const active = await query(`
            SELECT id, status, engine_job_id, processing_engine, processing_started_at
            FROM orthomosaic_jobs
            WHERE status IN ('queued', 'uploading', 'processing')
            LIMIT 50
        `);

        if (!active.rows.length) return;

        const engine = getEngine();

        for (const job of active.rows) {
            try {
                // ── Determine if this is a true mock job ──
                const isMockJob = job.processing_engine === 'mock'
                    || job.engine_job_id?.startsWith('mock-');

                // Real engine job with engine_job_id not yet set means the S3 upload
                // is still in progress inside engine.createTask(). Do NOT mock-advance it —
                // just wait; engine_job_id will be set when the upload completes.
                if (!isMockJob && !job.engine_job_id) {
                    logger.info(`[JobAdvancer] Job ${job.id} (${job.processing_engine}) still uploading to engine — skipping until engine_job_id is set`);
                    continue;
                }

                // ── Mock engine: time-based progress, no external call needed ──
                if (isMockJob) {
                    if (job.status !== 'processing') continue;
                    const { pct, stage, done } = mockProgressFromTimestamp(job.processing_started_at);
                    if (done) {
                        await query(`
                            UPDATE orthomosaic_jobs
                            SET status = 'completed', progress_pct = 100,
                                current_stage = 'Complete', processing_completed_at = NOW(), updated_at = NOW()
                            WHERE id = $1 AND status != 'completed'
                        `, [job.id]);
                        logger.info(`[JobAdvancer] Mock job ${job.id} → completed`);
                    } else {
                        await query(`
                            UPDATE orthomosaic_jobs
                            SET progress_pct = $1, current_stage = $2, updated_at = NOW()
                            WHERE id = $3
                        `, [pct, stage, job.id]);
                    }
                    continue;
                }

                // ── Real engine (axis / odm): poll and sync to DB ──
                const engineStatus = await engine.getTaskStatus(job.engine_job_id);
                if (!engineStatus || engineStatus.status === 'unknown') continue;

                const newStatus = engineStatus.status === 'running' ? 'processing' : engineStatus.status;
                const pct = engineStatus.progressPct || 0;

                if (newStatus === 'completed') {
                    // Use RETURNING to detect if we are the first to flip this job complete
                    const upd = await query(`
                        UPDATE orthomosaic_jobs
                        SET status = 'completed', progress_pct = 100,
                            processing_completed_at = NOW(), updated_at = NOW()
                        WHERE id = $1 AND status != 'completed'
                        RETURNING id, tenant_id
                    `, [job.id]);

                    if (upd.rowCount > 0) {
                        logger.info(`[JobAdvancer] Job ${job.id} → completed (engine: ${job.engine_job_id})`);
                        // Persist outputs so they survive Pix4D project expiry
                        try {
                            const outputs = await engine.getTaskOutputs(job.engine_job_id);
                            const tenantId = upd.rows[0]?.tenant_id;
                            for (const out of outputs) {
                                await query(
                                    `INSERT INTO orthomosaic_outputs
                                         (job_id, tenant_id, output_type, file_name, gcs_path, file_size_bytes, metadata)
                                     SELECT $1, tenant_id, $2, $3, $4, $5, $6
                                     FROM orthomosaic_jobs WHERE id = $1
                                     ON CONFLICT DO NOTHING`,
                                    [job.id, out.type, out.filename || `${out.type}.tif`,
                                     out.gcsPath || null, out.sizeBytes || 0, '{}']
                                );
                            }
                            logger.info(`[JobAdvancer] Saved ${outputs.length} output(s) for job ${job.id}`);
                        } catch (outErr) {
                            logger.warn(`[JobAdvancer] Output save failed for ${job.id}: ${outErr.message}`);
                        }
                    }
                } else if (newStatus === 'failed') {
                    await query(`
                        UPDATE orthomosaic_jobs
                        SET status = 'failed', updated_at = NOW()
                        WHERE id = $1
                    `, [job.id]);
                    logger.warn(`[JobAdvancer] Job ${job.id} → failed`);
                } else {
                    // GREATEST() prevents progress from going backward when Pix4D returns null%
                    const stage = engineStatus.stage || 'Processing on Pix4D Engine';
                    await query(`
                        UPDATE orthomosaic_jobs
                        SET status = $1,
                            progress_pct   = GREATEST(progress_pct, $2),
                            pipeline_stage = COALESCE($3, pipeline_stage),
                            updated_at     = NOW()
                        WHERE id = $4
                    `, [newStatus, pct, stage, job.id]);
                }
            } catch (jobErr) {
                logger.warn(`[JobAdvancer] Error advancing job ${job.id}: ${jobErr.message}`);
            }
        }
    } catch (err) {
        logger.warn('[JobAdvancer] Advance cycle error:', err.message);
    }
}

/**
 * Start the background job advancement loop.
 * Call once from app.js after startup.
 */
export function startJobAdvancer(intervalMs = 15_000) {
    // Run once immediately on startup to pick up any jobs left over from a previous instance
    setTimeout(advanceJobs, 2000);
    // Then run every intervalMs
    const handle = setInterval(advanceJobs, intervalMs);
    // Don't block process exit
    if (handle.unref) handle.unref();
    logger.info(`[JobAdvancer] Started — advancing jobs every ${intervalMs / 1000}s`);
}
