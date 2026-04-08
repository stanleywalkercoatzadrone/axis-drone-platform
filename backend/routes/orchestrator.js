/**
 * orchestrator.js — Mission Orchestration API Routes
 * Phase 4 – Orchestration API
 *
 * POST /api/orchestrator/run                  — Run orchestration for all missions (admin)
 * POST /api/orchestrator/run/:missionId       — Run for single mission (admin)
 * GET  /api/orchestrator/recommendations      — Get all recommendations (admin)
 * POST /api/orchestrator/:missionId/approve   — Admin approves AI recommendation
 * POST /api/orchestrator/:missionId/override  — Admin overrides recommendation
 * GET  /api/orchestrator/:missionId/status    — Get orchestration status for a mission
 *
 * Phase 13 Safety: All mutations require admin role. AI never auto-deploys.
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { orchestrateMission, orchestrateAllActiveMissions } from '../services/missionOrchestrator.js';
import { query } from '../config/database.js';

const router = express.Router();

// All orchestration routes require authentication
router.use(protect);

// ── POST /api/orchestrator/run ────────────────────────────────────────────────
// Run AI orchestration for all active missions (admin only)
router.post('/run', authorize('admin'), async (req, res) => {
    try {
        const { tenantId } = req.user;
        const result = await orchestrateAllActiveMissions(tenantId);
        res.json({ success: true, result });
    } catch (err) {
        console.error('[orchestrator POST /run]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/orchestrator/run/:missionId ─────────────────────────────────────
// Run AI orchestration for a single mission (admin only)
router.post('/run/:missionId', authorize('admin'), async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await orchestrateMission(missionId);
        res.json({ success: true, result });
    } catch (err) {
        console.error('[orchestrator POST /run/:id]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/orchestrator/recommendations ─────────────────────────────────────
// Returns all orchestration recommendations (admin only)
// Phase 10: Client-safe — no internal scores returned to non-admins
router.get('/recommendations', authorize('admin'), async (req, res) => {
    try {
        const { tenantId } = req.user;
        const result = await query(
            `SELECT mo.*,
                    d.title as mission_title, d.site_name, d.status as mission_status,
                    d.industry_key, d.latitude, d.longitude,
                    u.full_name as pilot_name, u.email as pilot_email,
                    approver.full_name as approved_by_name
             FROM mission_orchestration mo
             JOIN deployments d ON d.id = mo.mission_id
             LEFT JOIN users u ON u.id = mo.recommended_pilot
             LEFT JOIN users approver ON approver.id = mo.approved_by
             WHERE (d.tenant_id = $1 OR d.tenant_id IS NULL)
             ORDER BY mo.priority_score DESC NULLS LAST, mo.created_at DESC
             LIMIT 100`,
            [tenantId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/orchestrator/:missionId/status ───────────────────────────────────
// Get current orchestration status for a specific mission
router.get('/:missionId/status', authorize('admin'), async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await query(
            `SELECT mo.*,
                    u.full_name as pilot_name,
                    approver.full_name as approved_by_name
             FROM mission_orchestration mo
             LEFT JOIN users u ON u.id = mo.recommended_pilot
             LEFT JOIN users approver ON approver.id = mo.approved_by
             WHERE mo.mission_id = $1
             ORDER BY mo.created_at DESC
             LIMIT 5`,
            [missionId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/orchestrator/:missionId/approve ─────────────────────────────────
// Admin approves the AI recommendation (Phase 13: explicit approval required)
router.post('/:missionId/approve', authorize('admin'), async (req, res) => {
    try {
        const { missionId } = req.params;
        const adminId = req.user.id;

        // Find the latest suggested orchestration record
        const existing = await query(
            `SELECT id FROM mission_orchestration
             WHERE mission_id = $1 AND status = 'suggested'
             ORDER BY created_at DESC LIMIT 1`,
            [missionId]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No pending orchestration suggestion found' });
        }

        const result = await query(
            `UPDATE mission_orchestration
             SET status = 'approved', approved_by = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [adminId, existing.rows[0].id]
        );

        res.json({ success: true, data: result.rows[0], message: 'Orchestration plan approved' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/orchestrator/:missionId/override ───────────────────────────────
// Admin overrides the AI recommendation (always takes priority per Phase 13)
router.post('/:missionId/override', authorize('admin'), async (req, res) => {
    try {
        const { missionId } = req.params;
        const adminId = req.user.id;
        const { start_date, end_date, pilot_id, reason } = req.body;

        // Load existing recommendation for audit log
        const existing = await query(
            `SELECT * FROM mission_orchestration
             WHERE mission_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [missionId]
        );
        const previousPlan = existing.rows[0] || null;

        // Upsert with override flags
        let result;
        if (previousPlan) {
            result = await query(
                `UPDATE mission_orchestration SET
                    recommended_start_date = COALESCE($1, recommended_start_date),
                    recommended_end_date = COALESCE($2, recommended_end_date),
                    recommended_pilot = COALESCE($3, recommended_pilot),
                    manual_override = TRUE,
                    override_reason = $4,
                    status = 'overridden',
                    approved_by = $5,
                    updated_at = NOW()
                 WHERE id = $6
                 RETURNING *`,
                [start_date || null, end_date || null, pilot_id || null, reason || null, adminId, previousPlan.id]
            );
        } else {
            result = await query(
                `INSERT INTO mission_orchestration
                    (mission_id, recommended_start_date, recommended_end_date,
                     recommended_pilot, manual_override, override_reason, status, approved_by)
                 VALUES ($1, $2, $3, $4, TRUE, $5, 'overridden', $6)
                 RETURNING *`,
                [missionId, start_date || null, end_date || null, pilot_id || null, reason || null, adminId]
            );
        }

        // Phase 6: Write override audit log
        await query(
            `INSERT INTO orchestration_override_logs
                (mission_id, previous_plan, new_plan, reason, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                missionId,
                JSON.stringify(previousPlan || {}),
                JSON.stringify(result.rows[0]),
                reason || null,
                adminId,
            ]
        ).catch(() => { }); // Non-blocking

        res.json({ success: true, data: result.rows[0], message: 'Override applied successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
