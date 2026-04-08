/**
 * thermalDetection.js — AI Thermal Detection API
 * Phase 8  – Thermal processing pipeline endpoint
 * Phase 9  – Enqueue async jobs
 * Phase 10 – Fault density endpoint
 * Phase 13 – ai_detected + review_status columns
 * Phase 14 – Redis cache for detection results
 *
 * POST /api/thermal/process       — Run pipeline on uploaded image data
 * POST /api/thermal/queue         — Enqueue image for async processing (admin)
 * GET  /api/thermal/images/:deploymentId   — List thermal images for deployment
 * POST /api/thermal/images        — Register a new thermal image record
 * GET  /api/thermal/density/:deploymentId  — Fault density heatmap data
 * PATCH /api/thermal/faults/:faultId/review  — Update AI review status (admin)
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';
import { runThermalPipeline } from '../services/thermalPipeline.js';
import { enqueueThermalJob } from '../workers/thermalProcessingWorker.js';
import { computeFaultDensity } from '../services/faultDensityAnalyzer.js';

const router = express.Router();
router.use(protect);

const CACHE_TTL = 300;
const densityKey = (id) => `fault-detection:${id}`;

// ── POST /api/thermal/process ─────────────────────────────────────────────────
// Direct pipeline run (synchronous). Good for single images.
router.post('/process', async (req, res) => {
    try {
        const { imageId, measurements = [], panelBoxes, droneMetadata = {} } = req.body;
        if (!imageId) return res.status(400).json({ success: false, message: 'imageId required' });

        const imageRes = await query(`SELECT * FROM thermal_images WHERE id = $1`, [imageId]);
        if (!imageRes.rows.length) return res.status(404).json({ success: false, message: 'Image not found' });

        const result = await runThermalPipeline(imageRes.rows[0], {
            measurements, panelBoxes, droneMetadata
        });

        // Bust density cache
        await deleteCache(densityKey(imageRes.rows[0].deployment_id)).catch(() => { });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/thermal/queue ───────────────────────────────────────────────────
// Async queue for large batch jobs
router.post('/queue', async (req, res) => {
    try {
        const { imageId, deploymentId, measurements = [], droneMetadata = {} } = req.body;
        if (!imageId || !deploymentId) {
            return res.status(400).json({ success: false, message: 'imageId and deploymentId required' });
        }
        await enqueueThermalJob({ imageId, deploymentId, measurements, droneMetadata });
        res.json({ success: true, message: 'Job queued for processing' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/thermal/images ──────────────────────────────────────────────────
// Register a thermal image record
router.post('/images', async (req, res) => {
    try {
        const {
            deployment_id, pilot_id, file_url,
            latitude, longitude, capture_time,
            image_width, image_height, sensor_model,
        } = req.body;
        if (!deployment_id) return res.status(400).json({ success: false, message: 'deployment_id required' });

        const result = await query(
            `INSERT INTO thermal_images
                (deployment_id, pilot_id, file_url, latitude, longitude,
                 capture_time, image_width, image_height, sensor_model)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [deployment_id, pilot_id || req.user.id, file_url || null,
                latitude || null, longitude || null,
                capture_time || null, image_width || null, image_height || null,
                sensor_model || null]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/thermal/images/:deploymentId ─────────────────────────────────────
router.get('/images/:deploymentId', async (req, res) => {
    try {
        const result = await query(
            `SELECT ti.*, COUNT(tf.id) AS detected_faults
             FROM thermal_images ti
             LEFT JOIN thermal_faults tf ON tf.image_id = ti.id
             WHERE ti.deployment_id = $1
             GROUP BY ti.id
             ORDER BY ti.capture_time DESC NULLS LAST, ti.created_at DESC
             LIMIT 100`,
            [req.params.deploymentId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/thermal/density/:deploymentId ────────────────────────────────────
// Phase 10+14: Fault density with Redis cache
router.get('/density/:deploymentId', async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const key = densityKey(deploymentId);

        const cached = await getCache(key);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const density = await computeFaultDensity(deploymentId, parseInt(req.query.grid) || 10);
        await setCache(key, density, CACHE_TTL);
        res.json({ success: true, data: density, cached: false });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/thermal/faults/:faultId/review ─────────────────────────────────
// Phase 13: Admin updates review_status
router.patch('/faults/:faultId/review', authorize('admin'), async (req, res) => {
    try {
        const { review_status, fault_type, severity } = req.body;
        const valid = ['pending', 'verified', 'false_positive'];
        if (!valid.includes(review_status)) {
            return res.status(400).json({ success: false, message: `review_status must be: ${valid.join(', ')}` });
        }

        const result = await query(
            `UPDATE thermal_faults
             SET review_status = $1,
                 fault_type    = COALESCE($2, fault_type),
                 severity      = COALESCE($3, severity)
             WHERE id = $4 RETURNING *`,
            [review_status, fault_type || null, severity || null, req.params.faultId]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Fault not found' });

        // Bust density cache
        await deleteCache(densityKey(result.rows[0].deployment_id)).catch(() => { });

        // Emit review event
        try {
            const { io } = await import('../app.js');
            io?.emit('fault_status_updated', { faultId: req.params.faultId, review_status });
        } catch { /* optional */ }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
