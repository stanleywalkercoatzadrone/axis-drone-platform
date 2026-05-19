/**
 * training.js — Human-in-the-Loop Annotation API
 *
 * Endpoints for reviewing, correcting, and augmenting the
 * training_data_flywheel table that feeds the proprietary AI dataset.
 *
 * Routes:
 *   GET    /api/v1/training/flywheel         — list samples (paginated, filtered)
 *   GET    /api/v1/training/flywheel/stats   — dataset statistics
 *   GET    /api/v1/training/flywheel/:id     — single sample detail
 *   PUT    /api/v1/training/flywheel/:id/verify — human verify / correct faults
 *   POST   /api/v1/training/flywheel/annotate  — manually add annotation for any image
 *   DELETE /api/v1/training/flywheel/:id     — remove a false-positive record
 *   POST   /api/v1/training/flywheel/:id/fault — add a missed fault to an existing record
 *   DELETE /api/v1/training/flywheel/:id/fault/:faultIdx — remove a specific fault
 */

import express from 'express';
import { query } from '../../config/database.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

// ── Ensure the table + human_label column exist ────────────────────────────────
async function ensureSchema() {
    await query(`
        CREATE TABLE IF NOT EXISTS training_data_flywheel (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mission_id       UUID,
            image_url        TEXT NOT NULL,
            upload_type      TEXT NOT NULL DEFAULT 'images',
            detected_faults  JSONB NOT NULL DEFAULT '[]'::jsonb,
            human_verified   BOOLEAN DEFAULT false,
            human_label      JSONB,
            human_notes      TEXT,
            verified_by      UUID,
            verified_at      TIMESTAMPTZ,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )
    `).catch(() => {});

    // Add new columns if upgrading from older schema
    const cols = ['human_label', 'human_notes', 'verified_by', 'verified_at'];
    for (const col of cols) {
        await query(`ALTER TABLE training_data_flywheel ADD COLUMN IF NOT EXISTS ${col} ${
            col.endsWith('_at') ? 'TIMESTAMPTZ' : col === 'human_verified' ? 'BOOLEAN DEFAULT false' : col === 'verified_by' ? 'UUID' : 'JSONB'
        }`).catch(() => {});
    }
    await query(`ALTER TABLE training_data_flywheel ADD COLUMN IF NOT EXISTS human_notes TEXT`).catch(() => {});
}

// ── GET /stats ─────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        await ensureSchema();
        const result = await query(`
            SELECT
                COUNT(*)                                                         AS total,
                COUNT(*) FILTER (WHERE human_verified = true)                   AS verified,
                COUNT(*) FILTER (WHERE human_verified = false)                  AS unverified,
                COUNT(*) FILTER (WHERE human_label IS NOT NULL)                 AS human_labeled,
                COUNT(*) FILTER (WHERE upload_type = 'thermal')                 AS thermal,
                COUNT(*) FILTER (WHERE upload_type = 'images' OR upload_type = 'solar_panel') AS visual,
                COUNT(*) FILTER (WHERE upload_type = 'lbd' OR upload_type = 'lbd_defect')    AS lbd,
                MAX(created_at)                                                  AS latest_capture
            FROM training_data_flywheel
        `);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[training/stats]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /flywheel — list samples ───────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        await ensureSchema();
        const {
            page = 1,
            limit = 20,
            verified,       // 'true' | 'false' | undefined
            upload_type,    // e.g. 'thermal'
            mission_id,
            search,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = [];
        const params = [];

        if (verified === 'true')  conditions.push(`f.human_verified = true`);
        if (verified === 'false') conditions.push(`f.human_verified = false`);
        if (upload_type)          { params.push(upload_type); conditions.push(`f.upload_type = $${params.length}`); }
        if (mission_id)           { params.push(mission_id);  conditions.push(`f.mission_id = $${params.length}`); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        params.push(parseInt(limit), offset);
        const dataResult = await query(`
            SELECT
                f.id, f.mission_id, f.image_url, f.upload_type,
                f.detected_faults, f.human_verified, f.human_label,
                f.human_notes, f.verified_by, f.verified_at, f.created_at,
                d.title AS mission_title, d.location AS mission_location
            FROM training_data_flywheel f
            LEFT JOIN deployments d ON d.id = f.mission_id
            ${where}
            ORDER BY f.created_at DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        // Total count
        const countParams = params.slice(0, params.length - 2);
        const countResult = await query(
            `SELECT COUNT(*) AS total FROM training_data_flywheel f ${where}`,
            countParams
        );

        res.json({
            success: true,
            data: dataResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit)),
            },
        });
    } catch (err) {
        logger.error('[training/list]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── GET /flywheel/:id — single record ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const result = await query(`
            SELECT f.*, d.title AS mission_title, d.location AS mission_location
            FROM training_data_flywheel f
            LEFT JOIN deployments d ON d.id = f.mission_id
            WHERE f.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Record not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── PUT /flywheel/:id/verify — human review + label correction ─────────────────
//  Body: { human_verified: bool, human_label: { faults: [...] }, human_notes: string }
router.put('/:id/verify', async (req, res) => {
    try {
        const { human_verified, human_label, human_notes } = req.body;
        const userId = req.user?.id || null;

        const result = await query(`
            UPDATE training_data_flywheel
            SET
                human_verified = $1,
                human_label    = $2,
                human_notes    = $3,
                verified_by    = $4,
                verified_at    = NOW()
            WHERE id = $5
            RETURNING *
        `, [
            human_verified ?? true,
            human_label ? JSON.stringify(human_label) : null,
            human_notes || null,
            userId,
            req.params.id,
        ]);

        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Record not found' });
        logger.info(`[training] Human verified record ${req.params.id} by user ${userId}`);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[training/verify]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /flywheel/annotate — manually add a new annotated image ───────────────
//  Body: { image_url, upload_type, mission_id?, detected_faults, human_notes? }
router.post('/annotate', async (req, res) => {
    try {
        await ensureSchema();
        const { image_url, upload_type, mission_id, detected_faults, human_notes } = req.body;

        if (!image_url) return res.status(400).json({ success: false, error: 'image_url is required' });

        const faults = detected_faults || [];
        const userId = req.user?.id || null;

        const result = await query(`
            INSERT INTO training_data_flywheel
                (image_url, upload_type, mission_id, detected_faults, human_verified, human_label, human_notes, verified_by, verified_at)
            VALUES ($1, $2, $3, $4, true, $4, $5, $6, NOW())
            RETURNING *
        `, [
            image_url,
            upload_type || 'manual',
            mission_id || null,
            JSON.stringify(faults),
            human_notes || 'Manually annotated',
            userId,
        ]);

        logger.info(`[training] Manual annotation added by user ${userId} for ${image_url}`);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[training/annotate]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST /flywheel/:id/fault — add a missed fault to an existing record ────────
//  Body: { fault: { type, severity, confidence, location, description, ... } }
router.post('/:id/fault', async (req, res) => {
    try {
        const { fault } = req.body;
        if (!fault) return res.status(400).json({ success: false, error: 'fault object is required' });

        // Fetch the current record
        const cur = await query(`SELECT * FROM training_data_flywheel WHERE id = $1`, [req.params.id]);
        if (cur.rows.length === 0) return res.status(404).json({ success: false, error: 'Record not found' });

        const row = cur.rows[0];

        // Use human_label if it exists, otherwise fall back to detected_faults
        const base = row.human_label || row.detected_faults || {};
        const faults = base.faults || base.anomalies || base.defects || [];
        const newFault = { ...fault, id: `H${String(faults.length + 1).padStart(3, '0')}`, human_added: true };

        const updatedLabel = { ...(typeof base === 'object' ? base : {}), faults: [...faults, newFault] };

        const result = await query(`
            UPDATE training_data_flywheel
            SET human_label = $1, human_verified = true, verified_at = NOW(), verified_by = $2
            WHERE id = $3
            RETURNING *
        `, [JSON.stringify(updatedLabel), req.user?.id || null, req.params.id]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[training/add-fault]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── DELETE /flywheel/:id/fault/:faultIdx — remove a specific fault from label ──
router.delete('/:id/fault/:faultIdx', async (req, res) => {
    try {
        const faultIdx = parseInt(req.params.faultIdx);
        const cur = await query(`SELECT * FROM training_data_flywheel WHERE id = $1`, [req.params.id]);
        if (cur.rows.length === 0) return res.status(404).json({ success: false, error: 'Record not found' });

        const row = cur.rows[0];
        const base = row.human_label || row.detected_faults || {};
        const faults = [...(base.faults || base.anomalies || base.defects || [])];

        if (faultIdx < 0 || faultIdx >= faults.length) {
            return res.status(400).json({ success: false, error: 'Invalid fault index' });
        }
        faults.splice(faultIdx, 1);

        const updatedLabel = { ...(typeof base === 'object' ? base : {}), faults };
        const result = await query(`
            UPDATE training_data_flywheel SET human_label = $1, verified_at = NOW() WHERE id = $2 RETURNING *
        `, [JSON.stringify(updatedLabel), req.params.id]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[training/remove-fault]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── DELETE /flywheel/:id — delete a false-positive record entirely ─────────────
router.delete('/:id', async (req, res) => {
    try {
        const result = await query(
            `DELETE FROM training_data_flywheel WHERE id = $1 RETURNING id`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Record not found' });
        res.json({ success: true, message: 'Record deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
