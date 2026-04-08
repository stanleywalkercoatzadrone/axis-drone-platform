/**
 * protocols.js — Operational Protocols API
 * Admin CRUD + pilot acknowledgment routes
 * Base: /api/protocols
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(protect);

const isAdminOrPilot = (req, res, next) => {
    const r = (req.user?.role || '').toUpperCase();
    if (['ADMIN', 'SUPERADMIN', 'FIELD_OPERATOR', 'PILOT_TECHNICIAN', 'INSPECTOR', 'SENIOR_INSPECTOR'].some(role => r.includes(role))) return next();
    return res.status(403).json({ success: false, message: 'Access denied' });
};
const adminOnly = (req, res, next) => {
    const r = (req.user?.role || '').toUpperCase();
    if (r.includes('ADMIN') || r.includes('SUPERADMIN')) return next();
    return res.status(403).json({ success: false, message: 'Admin access required' });
};

router.use(isAdminOrPilot);

// ── GET /protocols — list all active protocols ────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { category, mission_type } = req.query;
        const params = [];
        let where = 'WHERE p.is_active = true';
        if (category) { params.push(category); where += ` AND p.category = $${params.length}`; }
        if (mission_type) { params.push(mission_type); where += ` AND (p.mission_type = $${params.length} OR p.mission_type = 'all')`; }

        const result = await query(
            `SELECT p.id, p.title, p.description, p.category, p.mission_type,
                    p.version, p.is_required, p.is_active, p.created_at,
                    jsonb_array_length(p.steps) as step_count
             FROM protocols p
             ${where}
             ORDER BY
               CASE p.category
                 WHEN 'pre_flight' THEN 1
                 WHEN 'mission' THEN 2
                 WHEN 'post_flight' THEN 3
                 WHEN 'emergency' THEN 4
                 ELSE 5
               END,
               p.mission_type, p.title`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('[GET /protocols]', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /protocols/:id — get full protocol with steps ─────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const result = await query(
            `SELECT p.*, u.email as created_by_email
             FROM protocols p
             LEFT JOIN users u ON u.id = p.created_by
             WHERE p.id = $1`,
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Protocol not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /protocols — create new protocol (admin) ─────────────────────────────
router.post('/', adminOnly, async (req, res) => {
    try {
        const { title, description, category, mission_type, steps, version, is_required } = req.body;
        if (!title || !category) return res.status(400).json({ success: false, message: 'title and category required' });

        const result = await query(
            `INSERT INTO protocols (title, description, category, mission_type, steps, version, is_required, is_active, created_by)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,true,$8) RETURNING *`,
            [title, description || '', category, mission_type || 'all',
             JSON.stringify(steps || []), version || '1.0', is_required || false, req.user.id]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── PUT /protocols/:id — update protocol (admin) ──────────────────────────────
router.put('/:id', adminOnly, async (req, res) => {
    try {
        const { title, description, category, mission_type, steps, version, is_required, is_active } = req.body;
        const result = await query(
            `UPDATE protocols SET
               title=$1, description=$2, category=$3, mission_type=$4,
               steps=$5::jsonb, version=$6, is_required=$7, is_active=$8, updated_at=NOW()
             WHERE id=$9 RETURNING *`,
            [title, description, category, mission_type || 'all',
             JSON.stringify(steps || []), version || '1.0', is_required || false, is_active !== false, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── DELETE /protocols/:id — deactivate (admin) ────────────────────────────────
router.delete('/:id', adminOnly, async (req, res) => {
    try {
        await query(`UPDATE protocols SET is_active=false, updated_at=NOW() WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /protocols/mission/:missionId — all applicable protocols for a mission ──
// Returns: explicitly attached protocols UNION standard protocols that match
// the mission's industry_key automatically (no manual attachment required).
router.get('/mission/:missionId', async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await query(
            `-- Fetch mission's industry type for automatic matching
             WITH mission_info AS (
               SELECT COALESCE(industry_key, 'all') AS industry_key
               FROM deployments WHERE id = $1
             ),
             -- Explicitly attached protocols
             attached AS (
               SELECT p.id, p.title, p.description, p.category, p.mission_type,
                      p.steps, p.version, p.is_required,
                      jsonb_array_length(p.steps) AS step_count,
                      'attached' AS source,
                      pa.acknowledged_at, pa.step_responses, pa.signature
               FROM mission_protocols mp
               JOIN protocols p ON p.id = mp.protocol_id
               LEFT JOIN protocol_acknowledgments pa
                 ON pa.protocol_id = p.id AND pa.mission_id = mp.mission_id AND pa.pilot_id = $2
               WHERE mp.mission_id = $1 AND p.is_active = true
             ),
             -- Standard protocols that auto-apply by mission type (not already attached)
             standard AS (
               SELECT p.id, p.title, p.description, p.category, p.mission_type,
                      p.steps, p.version, p.is_required,
                      jsonb_array_length(p.steps) AS step_count,
                      'standard' AS source,
                      pa.acknowledged_at, pa.step_responses, pa.signature
               FROM protocols p
               CROSS JOIN mission_info mi
               LEFT JOIN protocol_acknowledgments pa
                 ON pa.protocol_id = p.id AND pa.mission_id = $1 AND pa.pilot_id = $2
               WHERE p.is_active = true
                 AND (p.mission_type = 'all' OR p.mission_type = mi.industry_key)
                 AND p.id NOT IN (SELECT id FROM attached)
             )
             SELECT * FROM attached
             UNION ALL
             SELECT * FROM standard
             ORDER BY
               CASE category WHEN 'pre_flight' THEN 1 WHEN 'mission' THEN 2 WHEN 'post_flight' THEN 3 WHEN 'emergency' THEN 4 ELSE 5 END,
               is_required DESC, title`,
            [req.params.missionId, userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('[GET /protocols/mission]', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /protocols/apply-standards/:missionId — bulk-attach all matching ──────
// Finds all standard protocols matching the mission's industry_key and attaches them.
router.post('/apply-standards/:missionId', adminOnly, async (req, res) => {
    try {
        // Get mission's industry type
        const mRes = await query(
            `SELECT COALESCE(industry_key, 'all') AS industry_key FROM deployments WHERE id = $1`,
            [req.params.missionId]
        );
        if (!mRes.rows.length) return res.status(404).json({ success: false, message: 'Mission not found' });
        const industry = mRes.rows[0].industry_key;

        // Find all matching active protocols
        const pRes = await query(
            `SELECT id FROM protocols WHERE is_active = true
             AND (mission_type = 'all' OR mission_type = $1)`,
            [industry]
        );

        let attached = 0;
        for (const { id } of pRes.rows) {
            const r = await query(
                `INSERT INTO mission_protocols (mission_id, protocol_id, assigned_by)
                 VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
                [req.params.missionId, id, req.user.id]
            );
            if (r.rowCount > 0) attached++;
        }
        res.json({ success: true, attached, total: pRes.rows.length, industry });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /protocols/mission-list/:protocolId — which missions have this protocol ─
router.get('/mission-list/:protocolId', adminOnly, async (req, res) => {
    try {
        const result = await query(
            `SELECT mp.mission_id, d.title as mission_title
             FROM mission_protocols mp
             JOIN deployments d ON d.id = mp.mission_id
             WHERE mp.protocol_id = $1`,
            [req.params.protocolId]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /protocols/:id/attach/:missionId — attach to mission (admin) ─────────
router.post('/:id/attach/:missionId', adminOnly, async (req, res) => {
    try {
        await query(
            `INSERT INTO mission_protocols (mission_id, protocol_id, assigned_by)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [req.params.missionId, req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── DELETE /protocols/:id/detach/:missionId — remove from mission (admin) ─────
router.delete('/:id/detach/:missionId', adminOnly, async (req, res) => {
    try {
        await query(
            `DELETE FROM mission_protocols WHERE protocol_id=$1 AND mission_id=$2`,
            [req.params.id, req.params.missionId]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /protocols/:id/acknowledge — pilot sign-off ──────────────────────────
router.post('/:id/acknowledge', async (req, res) => {
    try {
        const { missionId, stepResponses, signature } = req.body;
        await query(
            `INSERT INTO protocol_acknowledgments
               (protocol_id, mission_id, pilot_id, pilot_name, step_responses, signature, acknowledged_at)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,NOW())
             ON CONFLICT (protocol_id, mission_id, pilot_id) DO UPDATE SET
               step_responses = EXCLUDED.step_responses,
               signature = EXCLUDED.signature,
               acknowledged_at = NOW()`,
            [req.params.id, missionId || null, req.user.id,
             req.user.fullName || req.user.full_name || req.user.email,
             JSON.stringify(stepResponses || {}), signature || null]
        );
        res.json({ success: true, message: 'Protocol acknowledged' });
    } catch (e) {
        console.error('[POST /protocols/:id/acknowledge]', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /protocols/:id/acknowledgments — list who signed (admin) ───────────────
router.get('/:id/acknowledgments', adminOnly, async (req, res) => {
    try {
        const result = await query(
            `SELECT pa.pilot_name, pa.acknowledged_at, pa.signature, pa.step_responses,
                    u.email as pilot_email, d.title as mission_title
             FROM protocol_acknowledgments pa
             LEFT JOIN users u ON u.id = pa.pilot_id
             LEFT JOIN deployments d ON d.id = pa.mission_id
             WHERE pa.protocol_id = $1
             ORDER BY pa.acknowledged_at DESC`,
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;
