/**
 * energyLoss.js — Energy Loss API
 * Phase 7  – Energy loss endpoints
 * Phase 11 – Client-safe data filtering
 * Phase 13 – Redis cache (300s TTL)
 * Phase 14 – Admin manual override
 *
 * GET  /api/energy-loss/deployment/:deploymentId   — Site-level loss (admin: full, client: summary)
 * GET  /api/energy-loss/deployment/:deploymentId/blocks — Per-block loss
 * GET  /api/energy-loss/deployment/:deploymentId/trend  — Trend analysis
 * GET  /api/energy-loss/block/:blockId             — Block-level loss
 * GET  /api/energy-loss/fault/:faultId             — Fault-level loss
 * PATCH /api/energy-loss/:id/override              — Admin manual override
 * POST /api/energy-loss/recalculate/:deploymentId  — Admin: recalculate all (config override)
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';
import { getSiteEnergyLoss, getClientSiteLoss } from '../services/siteEnergyAggregator.js';
import { getBlockEnergyLoss, getAllBlocksEnergyLoss } from '../services/blockEnergyAggregator.js';
import { analyzeEnergyTrend } from '../services/energyTrendAnalyzer.js';
import { recalculateDeploymentLoss } from '../services/energyLossEstimator.js';

const router = express.Router();
router.use(protect);

const CACHE_TTL = 300;
const siteKey = (id) => `energy-loss-summary:${id}`;
const bustCache = (id) => deleteCache(siteKey(id)).catch(() => { });

// ── GET /api/energy-loss/deployment/:deploymentId ─────────────────────────────
router.get('/deployment/:deploymentId', async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const isAdmin = req.user?.role === 'admin';
        const key = siteKey(deploymentId);

        // Phase 13: Cache check
        const cached = await getCache(key);
        if (cached) {
            const data = isAdmin ? cached : stripAdminFields(cached);
            return res.json({ success: true, data, cached: true });
        }

        const data = isAdmin
            ? await getSiteEnergyLoss(deploymentId)
            : await getClientSiteLoss(deploymentId);

        await setCache(key, data, CACHE_TTL);
        res.json({ success: true, data, cached: false });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/energy-loss/deployment/:deploymentId/blocks ──────────────────────
router.get('/deployment/:deploymentId/blocks', async (req, res) => {
    try {
        const blocks = await getAllBlocksEnergyLoss(req.params.deploymentId);
        // Phase 11: Non-admin clients get simplified view
        const isAdmin = req.user?.role === 'admin';
        const data = isAdmin ? blocks : blocks.map(b => ({
            blockName: b.blockName,
            dailyRevenueLoss: b.dailyRevenueLoss,
            annualRevenueLoss: b.annualRevenueLoss,
        }));
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/energy-loss/deployment/:deploymentId/trend ───────────────────────
router.get('/deployment/:deploymentId/trend', async (req, res) => {
    try {
        const weeks = parseInt(req.query.weeks) || 12;
        const trend = await analyzeEnergyTrend(req.params.deploymentId, weeks);
        res.json({ success: true, data: trend });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/energy-loss/block/:blockId ──────────────────────────────────────
router.get('/block/:blockId', async (req, res) => {
    try {
        const data = await getBlockEnergyLoss(req.params.blockId);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/energy-loss/fault/:faultId ──────────────────────────────────────
router.get('/fault/:faultId', async (req, res) => {
    try {
        const result = await query(
            `SELECT el.*, tf.fault_type, tf.severity, tf.temperature_delta
             FROM fault_energy_loss el
             JOIN thermal_faults tf ON tf.id = el.fault_id
             WHERE el.fault_id = $1`,
            [req.params.faultId]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'No energy loss record for this fault' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PATCH /api/energy-loss/:id/override ──────────────────────────────────────
// Phase 14: Admin manual override
router.patch('/:id/override', authorize('admin'), async (req, res) => {
    try {
        const {
            estimated_kw_loss,
            estimated_kwh_loss_daily,
            estimated_kwh_loss_annual,
            estimated_revenue_loss_daily,
            estimated_revenue_loss_annual,
        } = req.body;

        const result = await query(
            `UPDATE fault_energy_loss SET
                estimated_kw_loss             = COALESCE($1, estimated_kw_loss),
                estimated_kwh_loss_daily      = COALESCE($2, estimated_kwh_loss_daily),
                estimated_kwh_loss_annual     = COALESCE($3, estimated_kwh_loss_annual),
                estimated_revenue_loss_daily  = COALESCE($4, estimated_revenue_loss_daily),
                estimated_revenue_loss_annual = COALESCE($5, estimated_revenue_loss_annual),
                manual_override               = TRUE
             WHERE id = $6 RETURNING *`,
            [
                estimated_kw_loss || null,
                estimated_kwh_loss_daily || null,
                estimated_kwh_loss_annual || null,
                estimated_revenue_loss_daily || null,
                estimated_revenue_loss_annual || null,
                req.params.id,
            ]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Record not found' });
        await bustCache(result.rows[0].deployment_id);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/energy-loss/recalculate/:deploymentId ──────────────────────────
// Admin can recalculate with custom config (e.g. updated electricity rate)
router.post('/recalculate/:deploymentId', authorize('admin'), async (req, res) => {
    try {
        const config = req.body || {};
        const result = await recalculateDeploymentLoss(req.params.deploymentId, config);
        await bustCache(req.params.deploymentId);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Phase 11: Helper to strip admin-only fields
function stripAdminFields(data) {
    if (!data) return data;
    const { byFaultType, bySeverity, ...clientSafe } = data;
    return clientSafe;
}

export default router;
