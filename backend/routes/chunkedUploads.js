/**
 * Chunked / Resumable Upload Routes — Axis Enterprise Platform
 *
 * Exposes multi-part upload endpoints for Section 6 upload hardening.
 * Only active when ENABLE_RESUMABLE_UPLOADS=true OR accessed directly.
 * Single-file uploads via /api/pilot/upload-jobs remain untouched.
 *
 * Endpoints:
 *   POST   /api/uploads/init               — initialize a resumable upload session
 *   PUT    /api/uploads/:id/chunk/:n        — upload chunk #n
 *   POST   /api/uploads/:id/complete        — finalize and process
 *   GET    /api/uploads/:id/status          — poll status
 */

import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { protect } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { checksumValidator, computeChecksum } from '../middleware/checksumValidator.js';
import { getFlag } from '../config/featureFlags.js';
import { eventBus, EVENT_TYPES } from '../events/eventBus.js';
import { query } from '../config/database.js';

const router = express.Router();
const memStorage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.use(protect);

// Feature flag gate — returns 503 when flag is OFF
const requireResumableUploads = (req, res, next) => {
    if (!getFlag('ENABLE_RESUMABLE_UPLOADS')) {
        return res.status(503).json({
            success: false,
            message: 'Resumable uploads not enabled (ENABLE_RESUMABLE_UPLOADS=false). Use /api/pilot/upload-jobs for standard uploads.',
            requestId: req.requestId,
        });
    }
    next();
};

/**
 * POST /api/uploads/init
 * Initialize a resumable upload session.
 * Body: { fileName, mimeType, totalSize, chunkCount, missionId, checksum }
 * Returns: { uploadId, chunkSize }
 */
router.post('/init', requireResumableUploads, async (req, res) => {
    try {
        const {
            fileName, mimeType, totalSize,
            chunkCount = 1, missionId, checksum,
        } = req.body;

        if (!fileName || !mimeType) {
            return res.status(400).json({ success: false, message: 'fileName and mimeType are required' });
        }

        // Insert upload_jobs record with chunk metadata
        const result = await query(
            `INSERT INTO upload_jobs
               (id, site_name, mission_id, status, file_name, file_size, mime_type,
                upload_mode, chunk_count, received_chunks, checksum, tenant_id,
                created_by, initialized_at)
             VALUES ($1, $2, $3, 'pending', $4, $5, $6, 'chunked', $7, 0, $8, $9, $10, NOW())
             RETURNING id`,
            [
                uuidv4(), req.body.siteName || 'Unknown', missionId || null,
                fileName, totalSize || null, mimeType,
                parseInt(chunkCount, 10) || 1, checksum || null,
                req.user.tenantId, req.user.id,
            ]
        );

        const uploadId = result.rows[0].id;

        // Pre-create chunk records
        const chunkInserts = Array.from({ length: chunkCount }, (_, i) =>
            query(
                `INSERT INTO upload_chunks (job_id, chunk_idx) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [uploadId, i]
            )
        );
        await Promise.all(chunkInserts);

        res.status(201).json({
            success: true,
            uploadId,
            chunkCount: parseInt(chunkCount, 10),
            message: `Upload session created. Send chunks to PUT /api/uploads/${uploadId}/chunk/:n`,
            requestId: req.requestId,
        });
    } catch (err) {
        console.error('[uploads/init]', err.message);
        res.status(500).json({ success: false, message: err.message, requestId: req.requestId });
    }
});

/**
 * PUT /api/uploads/:uploadId/chunk/:chunkIdx
 * Upload a single chunk. Multipart form field: "chunk"
 */
router.put('/:uploadId/chunk/:chunkIdx', requireResumableUploads, uploadLimiter,
    memStorage.single('chunk'), checksumValidator, async (req, res) => {
    try {
        const { uploadId, chunkIdx } = req.params;
        const idx = parseInt(chunkIdx, 10);

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No chunk data received' });
        }

        const checksum = computeChecksum(req.file.buffer);
        const sizeBytes = req.file.buffer.length;

        await query(
            `UPDATE upload_chunks
             SET received = TRUE, checksum = $1, size_bytes = $2
             WHERE job_id = $3 AND chunk_idx = $4`,
            [checksum, sizeBytes, uploadId, idx]
        );

        // Increment received_chunks counter
        const updated = await query(
            `UPDATE upload_jobs
             SET received_chunks = received_chunks + 1, updated_at = NOW()
             WHERE id = $1
             RETURNING received_chunks, chunk_count`,
            [uploadId]
        );

        const { received_chunks, chunk_count } = updated.rows[0] || {};
        const isComplete = received_chunks >= chunk_count;

        res.json({
            success: true,
            chunkIdx: idx,
            received: received_chunks,
            total: chunk_count,
            complete: isComplete,
            requestId: req.requestId,
        });
    } catch (err) {
        console.error('[uploads/chunk]', err.message);
        res.status(500).json({ success: false, message: err.message, requestId: req.requestId });
    }
});

/**
 * POST /api/uploads/:uploadId/complete
 * Finalize the upload. Triggers background processing (emits event).
 */
router.post('/:uploadId/complete', requireResumableUploads, async (req, res) => {
    try {
        const { uploadId } = req.params;

        // Verify all chunks received
        const jobRes = await query(
            `SELECT j.*, 
               (SELECT COUNT(*) FROM upload_chunks WHERE job_id = j.id AND received = TRUE) AS received_count
             FROM upload_jobs j WHERE j.id = $1`,
            [uploadId]
        );

        if (!jobRes.rows.length) {
            return res.status(404).json({ success: false, message: 'Upload session not found' });
        }

        const job = jobRes.rows[0];
        const allReceived = parseInt(job.received_count) >= job.chunk_count;

        if (!allReceived) {
            return res.status(409).json({
                success: false,
                message: `Upload incomplete: ${job.received_count}/${job.chunk_count} chunks received`,
                requestId: req.requestId,
            });
        }

        // Mark as processing
        await query(
            `UPDATE upload_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
            [uploadId]
        );

        // Emit media.uploaded event → triggers AI processing if ENABLE_ASYNC_AI=true
        eventBus.emit(EVENT_TYPES.UPLOAD_COMPLETED, {
            uploadId,
            missionId:  job.mission_id,
            fileName:   job.file_name,
            mimeType:   job.mime_type,
            userId:     req.user.id,
            tenantId:   req.user.tenantId,
            requestId:  req.requestId,
            entityType: 'upload_job',
            entityId:   uploadId,
        });

        res.json({
            success: true,
            uploadId,
            status: 'processing',
            message: 'Upload finalized. Processing in background.',
            requestId: req.requestId,
        });
    } catch (err) {
        console.error('[uploads/complete]', err.message);
        res.status(500).json({ success: false, message: err.message, requestId: req.requestId });
    }
});

/**
 * GET /api/uploads/:uploadId/status
 * Poll the status of an upload or resumable upload session.
 */
router.get('/:uploadId/status', async (req, res) => {
    try {
        const { uploadId } = req.params;
        const result = await query(
            `SELECT j.id, j.status, j.file_name, j.file_size, j.chunk_count,
               j.received_chunks, j.upload_mode, j.mission_id,
               j.created_at, j.updated_at,
               ROUND((j.received_chunks::numeric / NULLIF(j.chunk_count,0)) * 100, 1) AS progress_pct
             FROM upload_jobs j
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [uploadId, req.user.tenantId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Upload not found' });
        }

        const job = result.rows[0];
        res.json({
            success: true,
            data: {
                id:             job.id,
                status:         job.status,
                fileName:       job.file_name,
                fileSize:       job.file_size,
                chunkCount:     job.chunk_count,
                receivedChunks: job.received_chunks,
                progressPct:    parseFloat(job.progress_pct || 0),
                uploadMode:     job.upload_mode,
                missionId:      job.mission_id,
                createdAt:      job.created_at,
                updatedAt:      job.updated_at,
            },
            requestId: req.requestId,
        });
    } catch (err) {
        console.error('[uploads/status]', err.message);
        res.status(500).json({ success: false, message: err.message, requestId: req.requestId });
    }
});

export default router;
