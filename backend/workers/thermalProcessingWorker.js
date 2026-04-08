/**
 * thermalProcessingWorker.js
 * Phase 9 – Async Thermal Batch Processing Worker
 *
 * Processes large thermal image batches asynchronously via Redis queue.
 * Non-destructive — reads from queue, writes only to thermal_faults.
 *
 * Queue key: thermal-processing-queue
 * Job format: { imageId, deploymentId, measurements, droneMetadata }
 */
import { query } from '../config/database.js';
import { runThermalPipeline } from '../services/thermalPipeline.js';

const QUEUE_KEY = 'thermal-processing-queue';
const PROCESSING_KEY = 'thermal-processing-active';
const POLL_INTERVAL = 5000;   // ms between polls
const MAX_RETRIES = 3;

let workerRunning = false;
let client = null;

/**
 * Get the Redis client from config.
 */
async function getRedisClient() {
    if (client) return client;
    try {
        const { getRedis } = await import('../config/redis.js');
        client = await getRedis();
        return client;
    } catch {
        return null;
    }
}

/**
 * Enqueue a thermal image job for async processing.
 * @param {Object} job - { imageId, deploymentId, measurements, droneMetadata }
 */
export async function enqueueThermalJob(job) {
    const redis = await getRedisClient();
    if (!redis) {
        console.warn('[thermalWorker] Redis unavailable — processing inline');
        return processJobInline(job);
    }
    await redis.lPush(QUEUE_KEY, JSON.stringify(job));
    console.log(`[thermalWorker] Queued job for image ${job.imageId}`);
}

/**
 * Process a single job inline (fallback when Redis unavailable).
 */
async function processJobInline(job) {
    const imageRes = await query(
        `SELECT * FROM thermal_images WHERE id = $1`,
        [job.imageId]
    );
    if (!imageRes.rows.length) return;

    await runThermalPipeline(imageRes.rows[0], {
        measurements: job.measurements || [],
        droneMetadata: job.droneMetadata || {},
    });
}

/**
 * Process one job from the queue.
 */
async function processNextJob(redis) {
    const raw = await redis.rPop(QUEUE_KEY);
    if (!raw) return false;

    let job;
    try { job = JSON.parse(raw); }
    catch { console.warn('[thermalWorker] Invalid job payload'); return true; }

    console.log(`[thermalWorker] Processing image ${job.imageId}`);

    const imageRes = await query(
        `SELECT * FROM thermal_images WHERE id = $1`,
        [job.imageId]
    );
    if (!imageRes.rows.length) {
        console.warn(`[thermalWorker] Image ${job.imageId} not found`);
        return true;
    }

    let retries = job.retries || 0;
    try {
        const result = await runThermalPipeline(imageRes.rows[0], {
            measurements: job.measurements || [],
            panelBoxes: job.panelBoxes || null,
            droneMetadata: job.droneMetadata || {},
        });

        console.log(`[thermalWorker] ✅ ${result.processed} faults detected for image ${job.imageId}`);

        // Emit socket event
        try {
            const { io } = await import('../app.js');
            io?.emit('thermal_fault_detected', {
                deploymentId: job.deploymentId,
                count: result.processed,
                faults: result.faults,
            });
        } catch { /* optional */ }

    } catch (err) {
        console.error(`[thermalWorker] ❌ Error processing ${job.imageId}:`, err.message);
        if (retries < MAX_RETRIES) {
            const redis2 = await getRedisClient();
            redis2?.lPush(QUEUE_KEY, JSON.stringify({ ...job, retries: retries + 1 }));
        }
    }

    return true;
}

/**
 * Start the polling worker loop.
 * Call once during server startup — idempotent.
 */
export function startThermalWorker() {
    if (workerRunning) return;
    workerRunning = true;

    const poll = async () => {
        if (!workerRunning) return;
        try {
            const redis = await getRedisClient();
            if (redis) {
                const hadJob = await processNextJob(redis);
                // If we processed a job, poll immediately for next
                setTimeout(poll, hadJob ? 100 : POLL_INTERVAL);
                return;
            }
        } catch (err) {
            console.warn('[thermalWorker] Poll error:', err.message);
        }
        setTimeout(poll, POLL_INTERVAL);
    };

    setTimeout(poll, 2000); // Delay initial poll to allow server startup
    console.log('✅ Thermal Processing Worker started (polling every 5s)');
}

/**
 * Stop the worker.
 */
export function stopThermalWorker() {
    workerRunning = false;
}
