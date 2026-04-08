/**
 * thermalFaults.js — Thermal Fault API
 * Phase 8  – CRUD endpoints for thermal faults
 * Phase 13 – Socket.IO events
 * Phase 14 – Redis cache
 *
 * GET  /api/faults/deployment/:deploymentId  — All faults for mission (admin)
 * GET  /api/faults/block/:blockId            — Faults for a block
 * GET  /api/faults/:faultId                  — Single fault detail
 * PATCH /api/faults/:faultId/status          — Update fault status
 * POST /api/faults                            — Create single fault record
 * GET  /api/faults/deployment/:id/summary    — Aggregated summary (admin + client)
 * GET  /api/faults/deployment/:id/ranked     — Priority-ranked faults (admin)
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';
import { aggregateFaultsForDeployment, getClientSafeFaults } from '../services/blockFaultAggregator.js';
import { getRankedFaults, updateBlockRiskScores } from '../services/faultPriorityEngine.js';

const router = express.Router();
router.use(protect);

const CACHE_TTL = 120;
const summaryKey = (id) => `fault-summary:${id}`;
const bustCache = async (id) => deleteCache(summaryKey(id)).catch(() => { });

// ── GET /api/faults/deployment/:deploymentId ──────────────────────────────────
router.get('/deployment/:deploymentId', authorize('admin'), async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const { severity, fault_type, limit = 200 } = req.query;

        let sql = `SELECT tf.*, sb.block_name, sb.block_number
                   FROM thermal_faults tf
                   LEFT JOIN solar_blocks sb ON sb.id = tf.block_id
                   WHERE tf.deployment_id = $1`;
        const params = [deploymentId];
        let p = 2;
        if (severity) { sql += ` AND tf.severity = $${p++}`; params.push(severity); }
        if (fault_type) { sql += ` AND tf.fault_type = $${p++}`; params.push(fault_type); }
        sql += ` ORDER BY tf.detected_at DESC LIMIT $${p}`;
        params.push(parseInt(limit));

        const result = await query(sql, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/faults/deployment/:deploymentId/summary ─────────────────────────
// Cached; accessible by both admin and client
router.get('/deployment/:deploymentId/summary', async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const role = req.user?.role;
        const key = summaryKey(deploymentId);

        const cached = await getCache(key);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const summary = await aggregateFaultsForDeployment(deploymentId);
        // Phase 9/10: Strip internal fields for non-admin clients
        if (role !== 'admin') {
            delete summary.blockBreakdown;
        }

        await setCache(key, summary, CACHE_TTL);
        res.json({ success: true, data: summary, cached: false });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/faults/deployment/:deploymentId/ranked ───────────────────────────
router.get('/deployment/:deploymentId/ranked', authorize('admin'), async (req, res) => {
    try {
        const faults = await getRankedFaults(req.params.deploymentId);
        res.json({ success: true, data: faults });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/faults/block/:blockId ───────────────────────────────────────────
router.get('/block/:blockId', async (req, res) => {
    try {
        const result = await query(
            `SELECT tf.*, sb.block_name, sb.block_number
             FROM thermal_faults tf
             LEFT JOIN solar_blocks sb ON sb.id = tf.block_id
             WHERE tf.block_id = $1
             ORDER BY detected_at DESC`,
            [req.params.blockId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/faults/:faultId ─────────────────────────────────────────────────
router.get('/:faultId', async (req, res) => {
    try {
        const result = await query(
            `SELECT tf.*, sb.block_name, sb.block_number
             FROM thermal_faults tf
             LEFT JOIN solar_blocks sb ON sb.id = tf.block_id
             WHERE tf.id = $1`,
            [req.params.faultId]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Fault not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/faults/:faultId/status ────────────────────────────────────────
router.patch('/:faultId/status', authorize('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['open', 'verified', 'resolved'];
        if (!valid.includes(status)) {
            return res.status(400).json({ success: false, message: `status must be: ${valid.join(', ')}` });
        }
        const result = await query(
            `UPDATE thermal_faults SET status = $1 WHERE id = $2 RETURNING *`,
            [status, req.params.faultId]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Fault not found' });

        // Phase 13: emit event
        try {
            const { io } = await import('../app.js');
            io?.emit('fault_status_updated', { faultId: req.params.faultId, status });
        } catch { /* optional */ }

        // Bust cache for this deployment
        await bustCache(result.rows[0].deployment_id);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/faults ─────────────────────────────────────────────────────────
// Creates a thermal fault record (called by upload pipeline or direct admin input)
router.post('/', async (req, res) => {
    try {
        const {
            deployment_id, block_id, image_id,
            latitude, longitude, temperature_delta,
            fault_type, severity, confidence_score,
        } = req.body;
        if (!deployment_id) return res.status(400).json({ success: false, message: 'deployment_id required' });

        const result = await query(
            `INSERT INTO thermal_faults
                (deployment_id, block_id, image_id, latitude, longitude,
                 temperature_delta, fault_type, severity, confidence_score, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open')
             RETURNING *`,
            [deployment_id, block_id || null, image_id || null,
                latitude || null, longitude || null,
                temperature_delta || 0, fault_type || 'unknown',
                severity || 'low', confidence_score || 50]
        );

        // Phase 12: Update block risk score
        if (block_id) {
            updateBlockRiskScores(deployment_id).catch(() => { });
        }

        // Phase 13: emit event
        try {
            const { io } = await import('../app.js');
            io?.emit('thermal_fault_detected', { deploymentId: deployment_id, fault: result.rows[0] });
        } catch { /* optional */ }

        await bustCache(deployment_id);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
