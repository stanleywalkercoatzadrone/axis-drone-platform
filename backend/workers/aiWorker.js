/**
 * AI Worker — Axis Enterprise Platform
 *
 * Background worker that processes AI jobs from the ai_jobs queue.
 * Polling interval: 5 seconds. Max 3 attempts per job with exponential backoff.
 *
 * ONLY starts when ENABLE_ASYNC_AI=true.
 * When flag is OFF: startAIWorker() is a no-op — zero performance impact.
 *
 * Emits events:
 *   - ai.analysis.completed → auditListener, notificationListener, analyticsListener
 *   - ai.analysis.failed    → auditListener, notificationListener
 */

import { getFlag } from '../config/featureFlags.js';
import * as aiQueue from '../queues/aiQueue.js';
import { aiService } from '../services/aiService.js';
import { eventBus, EVENT_TYPES } from '../events/eventBus.js';
import { logger } from '../services/logger.js';

const POLL_INTERVAL_MS       = 5_000;  // 5 seconds between polls
const RETRY_BASE_DELAY_MS    = 2_000;  // 2s base for exponential backoff
const MAX_RETRY_DELAY_MS     = 30_000; // Cap at 30s

let workerTimer = null;
let isRunning   = false;

/**
 * Compute exponential backoff delay for a given attempt number.
 */
function backoffDelay(attempt) {
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Sleep utility.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Process a single AI job:
 * 1. Mark as processing
 * 2. Call Gemini via aiService (existing, unchanged)
 * 3. Store result / emit event
 * 4. Handle failures with retry logic
 */
async function processJob(job) {
    const { id: jobId, mission_id: missionId, media_id: mediaId,
            analysis_type: analysisType, user_id: userId,
            tenant_id: tenantId, attempts, max_attempts } = job;

    logger.info('[AIWorker] Processing job', { jobId, missionId, attempts });

    await aiQueue.markProcessing(jobId);

    try {
        // Call existing AI service — no changes to Gemini logic
        let result;
        if (analysisType === 'daily_summary') {
            result = await aiService.generateDailyOperationalSummary(
                { missionId },
                userId
            );
        } else {
            // Default: inspection analysis
            result = await aiService.analyzeInspection(
                { missionId, mediaIds: mediaId ? [mediaId] : [] },
                userId
            );
        }

        await aiQueue.markCompleted(jobId, result);

        // Emit success event → triggers audit, notification, analytics listeners
        eventBus.emit(EVENT_TYPES.AI_ANALYSIS_COMPLETED, {
            jobId,
            missionId,
            mediaId,
            userId,
            tenantId,
            result: result?.data,
            requestId: result?.requestId,
        });

        logger.info('[AIWorker] Job completed successfully', { jobId });

    } catch (err) {
        const delay = backoffDelay(attempts);

        logger.error('[AIWorker] Job processing error', {
            jobId,
            attempt: attempts,
            maxAttempts: max_attempts,
            error: err.message,
            retryInMs: attempts < max_attempts ? delay : null,
        });

        // Apply backoff delay before marking for retry
        if (attempts < max_attempts) {
            await sleep(delay);
        }

        await aiQueue.markFailed(jobId, err.message, attempts, max_attempts);

        // Only emit failure event when fully exhausted
        if (attempts >= max_attempts) {
            eventBus.emit(EVENT_TYPES.AI_ANALYSIS_FAILED, {
                jobId,
                missionId,
                mediaId,
                userId,
                tenantId,
                error: err.message,
            });
        }
    }
}

/**
 * Worker polling loop — runs continuously when active.
 */
async function poll() {
    if (!isRunning) return;

    try {
        const job = await aiQueue.getNextPending();
        if (job) {
            await processJob(job);
            // Immediately poll again if a job was found (drain the queue)
            setImmediate(poll);
            return;
        }
    } catch (err) {
        logger.error('[AIWorker] Poll error', { error: err.message });
    }

    // No job found — wait before next poll
    if (isRunning) {
        workerTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }
}

/**
 * Start the AI background worker.
 * Safe to call multiple times — idempotent.
 * No-op if ENABLE_ASYNC_AI=false.
 */
export function startAIWorker() {
    if (!getFlag('ENABLE_ASYNC_AI')) {
        logger.info('[AIWorker] Not started — ENABLE_ASYNC_AI is OFF');
        return;
    }

    if (isRunning) {
        logger.warn('[AIWorker] Already running');
        return;
    }

    isRunning = true;
    logger.info('[AIWorker] Started — polling every 5s');
    poll();
}

/**
 * Stop the AI worker gracefully.
 */
export function stopAIWorker() {
    isRunning = false;
    if (workerTimer) {
        clearTimeout(workerTimer);
        workerTimer = null;
    }
    logger.info('[AIWorker] Stopped');
}

/**
 * Diagnostic: current worker state.
 */
export function workerStatus() {
    return {
        running:       isRunning,
        flagEnabled:   getFlag('ENABLE_ASYNC_AI'),
        pollIntervalMs: POLL_INTERVAL_MS,
    };
}
