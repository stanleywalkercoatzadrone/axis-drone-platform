/**
 * BESS QA/QC Routes
 * Battery Energy Storage System inspection, defect, and checklist management
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

const BESS_ROLES = ['admin', 'pilot_technician', 'pilot', 'field_operator', 'senior_inspector'];
const READ_ROLES = [...BESS_ROLES, 'client', 'client_user', 'customer'];

// ── GET /inspections ─────────────────────────────────────────────────────────
router.get('/inspections', protect, authorize(...READ_ROLES), async (req, res) => {
  try {
    const { deployment_id, status, limit = 50 } = req.query;
    const params = [];
    const conditions = [];

    if (deployment_id) { params.push(deployment_id); conditions.push(`deployment_id = $${params.length}`); }
    if (status)        { params.push(status);        conditions.push(`status = $${params.length}`); }

    params.push(Math.min(parseInt(limit, 10) || 50, 200));
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM bess_inspections ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error('[BESS] GET /inspections', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── POST /inspections ────────────────────────────────────────────────────────
router.post('/inspections', protect, authorize(...BESS_ROLES), async (req, res) => {
  try {
    const { deployment_id, inspection_type = 'site_survey', site_name, site_address, inspector_name, tenant_id } = req.body;
    const inspector_id = req.user?.id || null;

    const result = await query(
      `INSERT INTO bess_inspections
         (deployment_id, tenant_id, inspection_type, site_name, site_address, inspector_id, inspector_name, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [deployment_id || null, tenant_id || null, inspection_type, site_name || null, site_address || null, inspector_id, inspector_name || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[BESS] POST /inspections', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── GET /inspections/:id ─────────────────────────────────────────────────────
router.get('/inspections/:id', protect, authorize(...READ_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const [inspRow, defectsRow, checklistRow] = await Promise.all([
      query('SELECT * FROM bess_inspections WHERE id = $1', [id]),
      query('SELECT * FROM bess_defects WHERE inspection_id = $1 ORDER BY created_at DESC', [id]),
      query('SELECT * FROM bess_checklist_responses WHERE inspection_id = $1 ORDER BY section, item_key', [id]),
    ]);
    if (!inspRow.rows.length) return res.status(404).json({ success: false, message: 'Inspection not found' });
    res.json({ success: true, data: { ...inspRow.rows[0], defects: defectsRow.rows, checklist_responses: checklistRow.rows } });
  } catch (e) {
    console.error('[BESS] GET /inspections/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── PUT /inspections/:id ─────────────────────────────────────────────────────
router.put('/inspections/:id', protect, authorize(...BESS_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, completed_at, pass_rate } = req.body;
    const result = await query(
      `UPDATE bess_inspections
       SET status       = COALESCE($1, status),
           notes        = COALESCE($2, notes),
           completed_at = COALESCE($3, completed_at),
           pass_rate    = COALESCE($4, pass_rate),
           updated_at   = NOW()
       WHERE id = $5 RETURNING *`,
      [status || null, notes || null, completed_at || null, pass_rate ?? null, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Inspection not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[BESS] PUT /inspections/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── POST /inspections/:id/defects ────────────────────────────────────────────
router.post('/inspections/:id/defects', protect, authorize(...BESS_ROLES), async (req, res) => {
  try {
    const { id: inspection_id } = req.params;
    const { component_type, defect_category, severity = 'minor', description, lat, lng, component_id } = req.body;
    if (!component_type || !defect_category || !description) {
      return res.status(400).json({ success: false, message: 'component_type, defect_category and description are required' });
    }
    const defectResult = await query(
      `INSERT INTO bess_defects
         (inspection_id, component_type, component_id, defect_category, severity, description, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [inspection_id, component_type, component_id || null, defect_category, severity, description, lat || null, lng || null]
    );
    await query(
      `UPDATE bess_inspections
       SET defect_count   = (SELECT COUNT(*) FROM bess_defects WHERE inspection_id = $1),
           critical_count = (SELECT COUNT(*) FROM bess_defects WHERE inspection_id = $1 AND severity = 'critical'),
           updated_at     = NOW()
       WHERE id = $1`,
      [inspection_id]
    );
    res.status(201).json({ success: true, data: defectResult.rows[0] });
  } catch (e) {
    console.error('[BESS] POST /inspections/:id/defects', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── PUT /defects/:id ─────────────────────────────────────────────────────────
router.put('/defects/:id', protect, authorize(...BESS_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, photo_url, notes, resolved_by } = req.body;
    const result = await query(
      `UPDATE bess_defects
       SET status      = COALESCE($1, status),
           photo_url   = COALESCE($2, photo_url),
           notes       = COALESCE($3, notes),
           resolved_by = COALESCE($4, resolved_by),
           resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
           updated_at  = NOW()
       WHERE id = $5 RETURNING *`,
      [status || null, photo_url || null, notes || null, resolved_by || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Defect not found' });
    const defect = result.rows[0];
    await query(
      `UPDATE bess_inspections
       SET defect_count   = (SELECT COUNT(*) FROM bess_defects WHERE inspection_id = $1),
           critical_count = (SELECT COUNT(*) FROM bess_defects WHERE inspection_id = $1 AND severity = 'critical'),
           updated_at     = NOW()
       WHERE id = $1`,
      [defect.inspection_id]
    );
    res.json({ success: true, data: defect });
  } catch (e) {
    console.error('[BESS] PUT /defects/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── POST /inspections/:id/checklist ──────────────────────────────────────────
router.post('/inspections/:id/checklist', protect, authorize(...BESS_ROLES), async (req, res) => {
  try {
    const { id: inspection_id } = req.params;
    const { responses } = req.body;
    if (!Array.isArray(responses) || !responses.length) {
      return res.status(400).json({ success: false, message: 'responses array is required' });
    }
    const upserted = [];
    for (const item of responses) {
      const { section, item_key, item_label, response, notes, photo_url } = item;
      const r = await query(
        `INSERT INTO bess_checklist_responses
           (inspection_id, section, item_key, item_label, response, notes, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (inspection_id, item_key) DO UPDATE
           SET response   = EXCLUDED.response,
               notes      = EXCLUDED.notes,
               photo_url  = EXCLUDED.photo_url,
               item_label = EXCLUDED.item_label,
               section    = EXCLUDED.section,
               updated_at = NOW()
         RETURNING *`,
        [inspection_id, section, item_key, item_label, response || null, notes || null, photo_url || null]
      );
      upserted.push(r.rows[0]);
    }
    // Recalculate pass rate
    const answered = upserted.filter(r => r.response && r.response !== 'pending');
    const passed   = upserted.filter(r => r.response === 'pass');
    const passRate = answered.length ? Math.round((passed.length / answered.length) * 10000) / 100 : null;
    if (passRate !== null) {
      await query(`UPDATE bess_inspections SET pass_rate = $1, updated_at = NOW() WHERE id = $2`, [passRate, inspection_id]);
    }
    res.json({ success: true, data: upserted });
  } catch (e) {
    console.error('[BESS] POST /inspections/:id/checklist', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── GET /patterns ────────────────────────────────────────────────────────────
router.get('/patterns', protect, authorize(...READ_ROLES), async (req, res) => {
  try {
    const result = await query(
      `SELECT component_type, defect_category,
              COUNT(*) AS occurrence_count,
              SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) AS open_count
       FROM bess_defects
       GROUP BY component_type, defect_category
       HAVING COUNT(*) > 1
       ORDER BY occurrence_count DESC
       LIMIT 20`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error('[BESS] GET /patterns', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── GET /inspections/:id/export ──────────────────────────────────────────────
router.get('/inspections/:id/export', protect, authorize(...READ_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const [inspRow, defectsRow, checklistRow] = await Promise.all([
      query('SELECT * FROM bess_inspections WHERE id = $1', [id]),
      query('SELECT * FROM bess_defects WHERE inspection_id = $1 ORDER BY severity, created_at', [id]),
      query('SELECT * FROM bess_checklist_responses WHERE inspection_id = $1 ORDER BY section, item_key', [id]),
    ]);
    if (!inspRow.rows.length) return res.status(404).json({ success: false, message: 'Inspection not found' });
    const inspection = inspRow.rows[0];
    const defects    = defectsRow.rows;
    const checklist  = checklistRow.rows;
    const answered   = checklist.filter(r => r.response && r.response !== 'pending');
    const passed     = checklist.filter(r => r.response === 'pass');
    const computedPassRate = answered.length ? Math.round((passed.length / answered.length) * 10000) / 100 : null;
    res.json({
      success: true,
      data: {
        inspection,
        defects,
        checklist_responses: checklist,
        summary: {
          total_defects:       defects.length,
          critical_count:      defects.filter(d => d.severity === 'critical').length,
          major_count:         defects.filter(d => d.severity === 'major').length,
          open_count:          defects.filter(d => d.status === 'open').length,
          resolved_count:      defects.filter(d => d.status === 'resolved').length,
          checklist_pass_rate: inspection.pass_rate ?? computedPassRate,
          checklist_total:     checklist.length,
          checklist_pass:      passed.length,
        },
      },
    });
  } catch (e) {
    console.error('[BESS] GET /inspections/:id/export', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
