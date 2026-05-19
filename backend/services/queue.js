/**
 * queue.js — In-process job queue for the Axis processing pipeline.
 *
 * Architecture:
 *  - In-memory priority queue (high → normal → low)
 *  - Max concurrent workers: controlled by PIPELINE_CONCURRENCY env var
 *  - On server restart: re-queues any jobs stuck in 'queued' or 'processing'
 *  - Emits Socket.IO events for real-time frontend progress updates
 *
 * Flow: enqueueProcessingJob → worker → ODM → AI → complete
 */
import { logger } from './logger.js';
import { runOrthomosaic } from './orthomosaicEngine.js';
import { triggerAIAnalysis } from './aiPipeline.js';
import { updatePipelineJobStatus } from './uploadStatus.js';
import { loadImagesFromGCS, storeResults } from './storage.js';
import { query } from '../config/database.js';

const MAX_CONCURRENT = parseInt(process.env.PIPELINE_CONCURRENCY || '2');
let activeWorkers = 0;
let io = null; // Socket.IO instance — set via setSocketIO()

// Priority-sorted queues
const queues = { high: [], normal: [], low: [] };

/**
 * Set the Socket.IO server instance for real-time emit.
 * Called once at app startup: setSocketIO(io)
 */
export function setSocketIO(socketServer) { io = socketServer; }

/**
 * Register a new job in the DB and enqueue it for processing.
 */
export async function enqueueProcessingJob({ datasetId, missionId, tenantId, type = 'orthomosaic', priority = 'normal' }) {
    // Create pipeline_job DB record
    const res = await query(
        `INSERT INTO pipeline_jobs (dataset_id, mission_id, tenant_id, job_type, priority, status)
         VALUES ($1, $2, $3, $4, $5, 'queued')
         RETURNING id`,
        [datasetId, missionId, tenantId, type, priority]
    );
    const jobId = res.rows[0].id;

    // Update dataset status to queued
    await updatePipelineJobStatus(jobId, 'queued', 5);

    // Add to in-memory queue
    queues[priority]?.push({ jobId, datasetId, missionId, tenantId, type, priority });
    logger.info(`[Queue] Enqueued job ${jobId} (${type}, ${priority})`);

    // Emit to admin dashboard
    emitPipelineEvent('pipeline:queued', { jobId, datasetId, missionId, status: 'queued', progress: 5 });

    // Try to start processing
    processNextJob();

    return jobId;
}

/**
 * Pull next job from priority queues and process it.
 */
function processNextJob() {
    if (activeWorkers >= MAX_CONCURRENT) return;

    const job = queues.high.shift() || queues.normal.shift() || queues.low.shift();
    if (!job) return;

    activeWorkers++;
    processJobWorker(job).finally(() => {
        activeWorkers--;
        processNextJob(); // immediately try next job after one completes
    });
}

/**
 * Main worker — runs the full pipeline for one job.
 */
export async function processJobWorker(job) {
    const { jobId, datasetId, missionId } = job;
    logger.info(`[Worker] Starting job ${jobId}`);

    const emitProgress = (status, progress) => {
        emitPipelineEvent('pipeline:progress', { jobId, datasetId, missionId, status, progress });
    };

    try {
        // ── Stage 1: Load images from GCS ───────────────────────────────────
        await updatePipelineJobStatus(jobId, 'processing', 15);
        emitProgress('processing', 15);

        const imageSet = await loadImagesFromGCS(datasetId);
        logger.info(`[Worker] Loaded ${imageSet.imageCount} images for job ${jobId}`);

        await query(`UPDATE pipeline_jobs SET image_count = $2 WHERE id = $1`, [jobId, imageSet.imageCount]);

        // ── Stage 2: Run ODM Orthomosaic ─────────────────────────────────────
        await updatePipelineJobStatus(jobId, 'processing', 20);
        emitProgress('processing', 20);

        const odmResult = await runOrthomosaic(imageSet, async (pct) => {
            const mapped = 20 + Math.round(pct * 0.5); // 20→70
            await updatePipelineJobStatus(jobId, 'processing', mapped);
            emitProgress('processing', mapped);
        });

        // ── Stage 3: Store results in DB + GCS ───────────────────────────────
        await storeResults(datasetId, {
            ...odmResult,
            gcsAIPrefix: imageSet.gcsAIPrefix,
        });
        emitProgress('processing', 72);

        // ── Stage 4: AI Analysis ─────────────────────────────────────────────
        await updatePipelineJobStatus(jobId, 'analyzing', 75);
        emitProgress('analyzing', 75);

        const aiResult = await triggerAIAnalysis(jobId, datasetId, {
            ...odmResult,
            gcsAIPrefix: imageSet.gcsAIPrefix,
        });

        // ── Stage 5: Complete ────────────────────────────────────────────────
        await updatePipelineJobStatus(jobId, 'completed', 100);
        emitPipelineEvent('pipeline:complete', {
            jobId, datasetId, missionId,
            status: 'completed', progress: 100,
            aiResult,
            orthomosaicUrl: odmResult.orthomosaicGcsUri,
        });

        logger.info(`[Worker] Job ${jobId} completed ✓`);

    } catch (err) {
        logger.error(`[Worker] Job ${jobId} failed: ${err.message}`);
        await updatePipelineJobStatus(jobId, 'failed', 0, err.message).catch(() => {});
        emitPipelineEvent('pipeline:failed', { jobId, datasetId, missionId, error: err.message });
    }
}

/**
 * On startup — re-queue any jobs that were left stuck from a previous crash.
 */
export async function recoverStalledJobs() {
    try {
        const res = await query(
            `SELECT id, dataset_id, mission_id, tenant_id, job_type, priority
             FROM pipeline_jobs
             WHERE status IN ('queued', 'processing')
             AND created_at > NOW() - INTERVAL '24 hours'
             ORDER BY priority DESC, created_at ASC
             LIMIT 50`
        );
        if (res.rows.length === 0) return;

        logger.info(`[Queue] Recovering ${res.rows.length} stalled jobs…`);
        for (const row of res.rows) {
            queues[row.priority || 'normal']?.push({
                jobId:    row.id,
                datasetId: row.dataset_id,
                missionId: row.mission_id,
                tenantId:  row.tenant_id,
                type:      row.job_type,
                priority:  row.priority,
            });
        }
        processNextJob();
    } catch (err) {
        logger.error(`[Queue] Recovery failed: ${err.message}`);
    }
}

/**
 * Get current queue depth (for monitoring).
 */
export function getQueueStats() {
    return {
        high:    queues.high.length,
        normal:  queues.normal.length,
        low:     queues.low.length,
        workers: activeWorkers,
        maxWorkers: MAX_CONCURRENT,
    };
}

function emitPipelineEvent(event, data) {
    if (io) {
        io.emit(event, data);
        io.to(`mission_${data.missionId}`).emit(event, data);
    }
}
