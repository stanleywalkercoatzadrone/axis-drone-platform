/**
 * Solar Farm Intelligence Platform Routes
 * Sites, Surveys, Assets, QA/QC Issues, Thermal Findings,
 * Progress Snapshots, Reports, and GeoJSON/KML/CSV Exports
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

const ALL_ROLES   = ['admin', 'superadmin', 'pilot_technician', 'pilot', 'client', 'client_user'];
const WRITE_ROLES = ['admin', 'superadmin', 'pilot_technician'];

// ─────────────────────────────────────────────────────────────────────────────
// SITES
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites
router.get('/sites', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { status } = req.query;
    const params = [tenantId];
    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = `AND s.status = $${params.length}`;
    }
    const result = await query(
      `SELECT s.*,
              COUNT(DISTINCT sv.id)::int                                          AS surveys_count,
              COUNT(DISTINCT qi.id) FILTER (WHERE qi.status = 'open')::int        AS open_issues_count,
              COUNT(DISTINCT tf.id) FILTER (WHERE tf.status = 'open')::int        AS open_thermal_count
       FROM solar_sites s
       LEFT JOIN solar_surveys         sv ON sv.site_id = s.id
       LEFT JOIN solar_qaqc_issues     qi ON qi.site_id = s.id
       LEFT JOIN solar_thermal_findings tf ON tf.site_id = s.id
       WHERE s.tenant_id = $1 ${statusClause}
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /sites', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /sites
router.post('/sites', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const {
      name, client_name, location, lat, lng, capacity_mw,
      total_modules_planned, total_tracker_rows_planned, total_piles_planned,
      status, epc_contractor, owner_name, cod_target, notes, metadata,
    } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });
    const result = await query(
      `INSERT INTO solar_sites
         (tenant_id, name, client_name, location, lat, lng, capacity_mw,
          total_modules_planned, total_tracker_rows_planned, total_piles_planned,
          status, epc_contractor, owner_name, cod_target, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        tenantId, name, client_name || null, location || null,
        lat ?? null, lng ?? null, capacity_mw ?? null,
        total_modules_planned ?? 0, total_tracker_rows_planned ?? 0, total_piles_planned ?? 0,
        status || 'planning', epc_contractor || null, owner_name || null,
        cod_target || null, notes || null,
        metadata ? JSON.stringify(metadata) : '{}',
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] POST /sites', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /sites/:id
router.get('/sites/:id', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const [siteRes, latestSurveyRes, statsRes] = await Promise.all([
      query('SELECT * FROM solar_sites WHERE id = $1 AND tenant_id = $2', [id, tenantId]),
      query(
        `SELECT * FROM solar_surveys WHERE site_id = $1 ORDER BY survey_date DESC NULLS LAST, created_at DESC LIMIT 1`,
        [id]
      ),
      query(
        `SELECT
           COUNT(DISTINCT sv.id)::int                                          AS total_surveys,
           COUNT(DISTINCT a.id)::int                                           AS total_assets,
           COUNT(DISTINCT qi.id) FILTER (WHERE qi.status = 'open')::int        AS open_issues,
           COUNT(DISTINCT tf.id) FILTER (WHERE tf.status = 'open')::int        AS open_thermal,
           COUNT(DISTINCT tf.id) FILTER (WHERE tf.severity = 'critical' AND tf.status = 'open')::int AS critical_thermal
         FROM solar_sites s
         LEFT JOIN solar_surveys          sv ON sv.site_id = s.id
         LEFT JOIN solar_assets            a ON a.site_id  = s.id
         LEFT JOIN solar_qaqc_issues      qi ON qi.site_id = s.id
         LEFT JOIN solar_thermal_findings tf ON tf.site_id = s.id
         WHERE s.id = $1`,
        [id]
      ),
    ]);
    if (!siteRes.rows.length) return res.status(404).json({ success: false, message: 'Site not found' });
    res.json({
      success: true,
      data: {
        ...siteRes.rows[0],
        latest_survey: latestSurveyRes.rows[0] || null,
        stats: statsRes.rows[0],
      },
    });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /sites/:id
router.put('/sites/:id', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const {
      name, client_name, location, lat, lng, capacity_mw,
      total_modules_planned, total_tracker_rows_planned, total_piles_planned,
      status, epc_contractor, owner_name, cod_target, notes, metadata,
    } = req.body;
    const result = await query(
      `UPDATE solar_sites SET
         name                       = COALESCE($1,  name),
         client_name                = COALESCE($2,  client_name),
         location                   = COALESCE($3,  location),
         lat                        = COALESCE($4,  lat),
         lng                        = COALESCE($5,  lng),
         capacity_mw                = COALESCE($6,  capacity_mw),
         total_modules_planned      = COALESCE($7,  total_modules_planned),
         total_tracker_rows_planned = COALESCE($8,  total_tracker_rows_planned),
         total_piles_planned        = COALESCE($9,  total_piles_planned),
         status                     = COALESCE($10, status),
         epc_contractor             = COALESCE($11, epc_contractor),
         owner_name                 = COALESCE($12, owner_name),
         cod_target                 = COALESCE($13, cod_target),
         notes                      = COALESCE($14, notes),
         metadata                   = COALESCE($15, metadata),
         updated_at                 = NOW()
       WHERE id = $16 AND tenant_id = $17
       RETURNING *`,
      [
        name || null, client_name || null, location || null,
        lat ?? null, lng ?? null, capacity_mw ?? null,
        total_modules_planned ?? null, total_tracker_rows_planned ?? null, total_piles_planned ?? null,
        status || null, epc_contractor || null, owner_name || null,
        cod_target || null, notes || null,
        metadata ? JSON.stringify(metadata) : null,
        id, tenantId,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Site not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] PUT /sites/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SURVEYS
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites/:siteId/surveys
router.get('/sites/:siteId/surveys', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const result = await query(
      `SELECT * FROM solar_surveys
       WHERE site_id = $1 AND tenant_id = $2
       ORDER BY survey_date DESC NULLS LAST, created_at DESC`,
      [siteId, tenantId]
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/surveys', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /sites/:siteId/surveys
router.post('/sites/:siteId/surveys', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const {
      orthomosaic_job_id, deployment_id, survey_date, flight_date,
      gsd_cm, area_ha, image_count, reconstructed_count, reprojection_error,
      has_gps, data_quality, processing_engine, spatial_reference, notes, metadata,
    } = req.body;
    const result = await query(
      `INSERT INTO solar_surveys
         (tenant_id, site_id, orthomosaic_job_id, deployment_id, survey_date, flight_date,
          gsd_cm, area_ha, image_count, reconstructed_count, reprojection_error,
          has_gps, data_quality, processing_engine, spatial_reference, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        tenantId, siteId,
        orthomosaic_job_id || null, deployment_id || null,
        survey_date || null, flight_date || null,
        gsd_cm ?? null, area_ha ?? null,
        image_count ?? null, reconstructed_count ?? null, reprojection_error ?? null,
        has_gps ?? false,
        data_quality || 'good', processing_engine || 'OpenDroneMap',
        spatial_reference || 'WGS84/UTM',
        notes || null,
        metadata ? JSON.stringify(metadata) : '{}',
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] POST /sites/:siteId/surveys', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /surveys/:id
router.get('/surveys/:id', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const result = await query(
      `SELECT sv.*, s.name AS site_name, s.location AS site_location, s.capacity_mw
       FROM solar_surveys sv
       JOIN solar_sites s ON s.id = sv.site_id
       WHERE sv.id = $1 AND sv.tenant_id = $2`,
      [id, tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Survey not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] GET /surveys/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /surveys/:id
router.put('/surveys/:id', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const {
      orthomosaic_job_id, deployment_id, survey_date, flight_date,
      gsd_cm, area_ha, image_count, reconstructed_count, reprojection_error,
      has_gps, data_quality, processing_engine, spatial_reference, notes, metadata,
    } = req.body;
    const result = await query(
      `UPDATE solar_surveys SET
         orthomosaic_job_id  = COALESCE($1,  orthomosaic_job_id),
         deployment_id       = COALESCE($2,  deployment_id),
         survey_date         = COALESCE($3,  survey_date),
         flight_date         = COALESCE($4,  flight_date),
         gsd_cm              = COALESCE($5,  gsd_cm),
         area_ha             = COALESCE($6,  area_ha),
         image_count         = COALESCE($7,  image_count),
         reconstructed_count = COALESCE($8,  reconstructed_count),
         reprojection_error  = COALESCE($9,  reprojection_error),
         has_gps             = COALESCE($10, has_gps),
         data_quality        = COALESCE($11, data_quality),
         processing_engine   = COALESCE($12, processing_engine),
         spatial_reference   = COALESCE($13, spatial_reference),
         notes               = COALESCE($14, notes),
         metadata            = COALESCE($15, metadata),
         updated_at          = NOW()
       WHERE id = $16 AND tenant_id = $17
       RETURNING *`,
      [
        orthomosaic_job_id || null, deployment_id || null,
        survey_date || null, flight_date || null,
        gsd_cm ?? null, area_ha ?? null,
        image_count ?? null, reconstructed_count ?? null, reprojection_error ?? null,
        has_gps ?? null,
        data_quality || null, processing_engine || null, spatial_reference || null,
        notes || null,
        metadata ? JSON.stringify(metadata) : null,
        id, tenantId,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Survey not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] PUT /surveys/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites/:siteId/assets
router.get('/sites/:siteId/assets', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const { type, status } = req.query;
    const params = [siteId, tenantId];
    const conditions = [];
    if (type)   { params.push(type);   conditions.push(`asset_type = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`installation_status = $${params.length}`); }
    const extra = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM solar_assets
       WHERE site_id = $1 AND tenant_id = $2 ${extra}
       ORDER BY asset_type, asset_id_label`,
      params
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/assets', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /sites/:siteId/assets
router.post('/sites/:siteId/assets', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const {
      last_survey_id, asset_type, asset_id_label, lat, lng, geometry,
      installation_status, last_inspection_date, specs, notes,
    } = req.body;
    if (!asset_type) return res.status(400).json({ success: false, message: 'asset_type is required' });
    const result = await query(
      `INSERT INTO solar_assets
         (tenant_id, site_id, last_survey_id, asset_type, asset_id_label,
          lat, lng, geometry, installation_status, last_inspection_date, specs, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        tenantId, siteId, last_survey_id || null, asset_type, asset_id_label || null,
        lat ?? null, lng ?? null,
        geometry ? JSON.stringify(geometry) : null,
        installation_status || 'planned', last_inspection_date || null,
        specs ? JSON.stringify(specs) : '{}',
        notes || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] POST /sites/:siteId/assets', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /sites/:siteId/assets/bulk
router.post('/sites/:siteId/assets/bulk', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const { assets } = req.body;
    if (!Array.isArray(assets) || !assets.length) {
      return res.status(400).json({ success: false, message: 'assets array is required' });
    }
    const inserted = [];
    for (const asset of assets) {
      const {
        last_survey_id, asset_type, asset_id_label, lat, lng, geometry,
        installation_status, last_inspection_date, specs, notes,
      } = asset;
      if (!asset_type) continue;
      const r = await query(
        `INSERT INTO solar_assets
           (tenant_id, site_id, last_survey_id, asset_type, asset_id_label,
            lat, lng, geometry, installation_status, last_inspection_date, specs, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          tenantId, siteId, last_survey_id || null, asset_type, asset_id_label || null,
          lat ?? null, lng ?? null,
          geometry ? JSON.stringify(geometry) : null,
          installation_status || 'planned', last_inspection_date || null,
          specs ? JSON.stringify(specs) : '{}',
          notes || null,
        ]
      );
      inserted.push(r.rows[0]);
    }
    res.status(201).json({ success: true, data: inserted, total: inserted.length });
  } catch (e) {
    console.error('[SolarFarm] POST /sites/:siteId/assets/bulk', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /assets/:id
router.put('/assets/:id', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const {
      last_survey_id, asset_type, asset_id_label, lat, lng, geometry,
      installation_status, last_inspection_date, specs, notes,
    } = req.body;
    const result = await query(
      `UPDATE solar_assets SET
         last_survey_id       = COALESCE($1,  last_survey_id),
         asset_type           = COALESCE($2,  asset_type),
         asset_id_label       = COALESCE($3,  asset_id_label),
         lat                  = COALESCE($4,  lat),
         lng                  = COALESCE($5,  lng),
         geometry             = COALESCE($6,  geometry),
         installation_status  = COALESCE($7,  installation_status),
         last_inspection_date = COALESCE($8,  last_inspection_date),
         specs                = COALESCE($9,  specs),
         notes                = COALESCE($10, notes),
         updated_at           = NOW()
       WHERE id = $11 AND tenant_id = $12
       RETURNING *`,
      [
        last_survey_id || null, asset_type || null, asset_id_label || null,
        lat ?? null, lng ?? null,
        geometry ? JSON.stringify(geometry) : null,
        installation_status || null, last_inspection_date || null,
        specs ? JSON.stringify(specs) : null,
        notes || null,
        id, tenantId,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Asset not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] PUT /assets/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// QA/QC ISSUES
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites/:siteId/issues
router.get('/sites/:siteId/issues', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const { survey_id, severity, status, type } = req.query;
    const params = [siteId, tenantId];
    const conditions = [];
    if (survey_id) { params.push(survey_id); conditions.push(`survey_id = $${params.length}`); }
    if (severity)  { params.push(severity);  conditions.push(`severity = $${params.length}`); }
    if (status)    { params.push(status);    conditions.push(`status = $${params.length}`); }
    if (type)      { params.push(type);      conditions.push(`issue_type = $${params.length}`); }
    const extra = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM solar_qaqc_issues
       WHERE site_id = $1 AND tenant_id = $2 ${extra}
       ORDER BY
         CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/issues', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /surveys/:surveyId/issues
router.get('/surveys/:surveyId/issues', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { surveyId } = req.params;
    const result = await query(
      `SELECT * FROM solar_qaqc_issues
       WHERE survey_id = $1 AND tenant_id = $2
       ORDER BY
         CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         created_at DESC`,
      [surveyId, tenantId]
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /surveys/:surveyId/issues', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /surveys/:surveyId/issues
router.post('/surveys/:surveyId/issues', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { surveyId } = req.params;
    // Resolve site_id from survey
    const surveyRes = await query(
      'SELECT site_id FROM solar_surveys WHERE id = $1 AND tenant_id = $2',
      [surveyId, tenantId]
    );
    if (!surveyRes.rows.length) return res.status(404).json({ success: false, message: 'Survey not found' });
    const siteId = surveyRes.rows[0].site_id;
    const {
      asset_id, title, description, issue_type, severity, status,
      lat, lng, image_urls, assignee_name, assignee_email, detected_by, notes,
    } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const result = await query(
      `INSERT INTO solar_qaqc_issues
         (tenant_id, site_id, survey_id, asset_id, title, description,
          issue_type, severity, status, lat, lng, image_urls,
          assignee_name, assignee_email, detected_by, resolution_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        tenantId, siteId, surveyId, asset_id || null,
        title, description || null,
        issue_type || 'other', severity || 'medium', status || 'open',
        lat ?? null, lng ?? null,
        image_urls ? JSON.stringify(image_urls) : '[]',
        assignee_name || null, assignee_email || null,
        detected_by || 'manual', notes || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] POST /surveys/:surveyId/issues', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /issues/:id
router.put('/issues/:id', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const {
      title, description, issue_type, severity, status,
      assignee_name, assignee_email, resolution_notes, resolved_at,
      lat, lng, image_urls,
    } = req.body;
    const result = await query(
      `UPDATE solar_qaqc_issues SET
         title            = COALESCE($1,  title),
         description      = COALESCE($2,  description),
         issue_type       = COALESCE($3,  issue_type),
         severity         = COALESCE($4,  severity),
         status           = COALESCE($5,  status),
         assignee_name    = COALESCE($6,  assignee_name),
         assignee_email   = COALESCE($7,  assignee_email),
         resolution_notes = COALESCE($8,  resolution_notes),
         resolved_at      = COALESCE($9,  resolved_at),
         lat              = COALESCE($10, lat),
         lng              = COALESCE($11, lng),
         image_urls       = COALESCE($12, image_urls),
         updated_at       = NOW()
       WHERE id = $13 AND tenant_id = $14
       RETURNING *`,
      [
        title || null, description || null, issue_type || null,
        severity || null, status || null,
        assignee_name || null, assignee_email || null,
        resolution_notes || null, resolved_at || null,
        lat ?? null, lng ?? null,
        image_urls ? JSON.stringify(image_urls) : null,
        id, tenantId,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Issue not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] PUT /issues/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /issues/:id
router.delete('/issues/:id', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const result = await query(
      'DELETE FROM solar_qaqc_issues WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Issue not found' });
    res.json({ success: true, data: { id: result.rows[0].id } });
  } catch (e) {
    console.error('[SolarFarm] DELETE /issues/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THERMAL FINDINGS
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites/:siteId/thermal
router.get('/sites/:siteId/thermal', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const { survey_id, severity, status } = req.query;
    const params = [siteId, tenantId];
    const conditions = [];
    if (survey_id) { params.push(survey_id); conditions.push(`survey_id = $${params.length}`); }
    if (severity)  { params.push(severity);  conditions.push(`severity = $${params.length}`); }
    if (status)    { params.push(status);    conditions.push(`status = $${params.length}`); }
    const extra = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM solar_thermal_findings
       WHERE site_id = $1 AND tenant_id = $2 ${extra}
       ORDER BY
         CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         created_at DESC`,
      params
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/thermal', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /surveys/:surveyId/thermal
router.get('/surveys/:surveyId/thermal', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { surveyId } = req.params;
    const result = await query(
      `SELECT * FROM solar_thermal_findings
       WHERE survey_id = $1 AND tenant_id = $2
       ORDER BY temperature_delta DESC NULLS LAST, created_at DESC`,
      [surveyId, tenantId]
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /surveys/:surveyId/thermal', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /surveys/:surveyId/thermal
router.post('/surveys/:surveyId/thermal', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { surveyId } = req.params;
    const surveyRes = await query(
      'SELECT site_id FROM solar_surveys WHERE id = $1 AND tenant_id = $2',
      [surveyId, tenantId]
    );
    if (!surveyRes.rows.length) return res.status(404).json({ success: false, message: 'Survey not found' });
    const siteId = surveyRes.rows[0].site_id;
    const {
      asset_id, thermal_fault_id, finding_type, severity,
      temperature_delta, lat, lng, image_url,
      string_id, module_id, status, detected_by, notes,
    } = req.body;
    const result = await query(
      `INSERT INTO solar_thermal_findings
         (tenant_id, site_id, survey_id, asset_id, thermal_fault_id, finding_type,
          severity, temperature_delta, lat, lng, image_url,
          string_id, module_id, status, detected_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        tenantId, siteId, surveyId, asset_id || null, thermal_fault_id || null,
        finding_type || 'hotspot', severity || 'medium',
        temperature_delta ?? null, lat ?? null, lng ?? null,
        image_url || null, string_id || null, module_id || null,
        status || 'open', detected_by || 'manual', notes || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] POST /surveys/:surveyId/thermal', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /thermal/:id
router.put('/thermal/:id', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const {
      finding_type, severity, temperature_delta, lat, lng,
      image_url, string_id, module_id, status, detected_by, notes,
    } = req.body;
    const result = await query(
      `UPDATE solar_thermal_findings SET
         finding_type      = COALESCE($1,  finding_type),
         severity          = COALESCE($2,  severity),
         temperature_delta = COALESCE($3,  temperature_delta),
         lat               = COALESCE($4,  lat),
         lng               = COALESCE($5,  lng),
         image_url         = COALESCE($6,  image_url),
         string_id         = COALESCE($7,  string_id),
         module_id         = COALESCE($8,  module_id),
         status            = COALESCE($9,  status),
         detected_by       = COALESCE($10, detected_by),
         notes             = COALESCE($11, notes),
         updated_at        = NOW()
       WHERE id = $12 AND tenant_id = $13
       RETURNING *`,
      [
        finding_type || null, severity || null,
        temperature_delta ?? null, lat ?? null, lng ?? null,
        image_url || null, string_id || null, module_id || null,
        status || null, detected_by || null, notes || null,
        id, tenantId,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Thermal finding not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] PUT /thermal/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS SNAPSHOTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites/:siteId/progress
router.get('/sites/:siteId/progress', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const result = await query(
      `SELECT * FROM solar_progress_snapshots
       WHERE site_id = $1 AND tenant_id = $2
       ORDER BY snapshot_date DESC, created_at DESC`,
      [siteId, tenantId]
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/progress', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /surveys/:surveyId/progress
router.get('/surveys/:surveyId/progress', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { surveyId } = req.params;
    const result = await query(
      'SELECT * FROM solar_progress_snapshots WHERE survey_id = $1 AND tenant_id = $2',
      [surveyId, tenantId]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (e) {
    console.error('[SolarFarm] GET /surveys/:surveyId/progress', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /surveys/:surveyId/progress  (upsert)
router.post('/surveys/:surveyId/progress', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { surveyId } = req.params;
    const surveyRes = await query(
      'SELECT site_id FROM solar_surveys WHERE id = $1 AND tenant_id = $2',
      [surveyId, tenantId]
    );
    if (!surveyRes.rows.length) return res.status(404).json({ success: false, message: 'Survey not found' });
    const siteId = surveyRes.rows[0].site_id;
    const {
      snapshot_date,
      piles_planned, piles_installed,
      tracker_rows_planned, tracker_rows_installed,
      modules_planned, modules_installed,
      inverter_pads_planned, inverter_pads_installed,
      roads_planned_m, roads_completed_m,
      blocks_planned, blocks_completed,
      overall_progress_pct, earthwork_pct, civil_pct, electrical_pct,
      notes,
    } = req.body;
    const result = await query(
      `INSERT INTO solar_progress_snapshots
         (tenant_id, site_id, survey_id, snapshot_date,
          piles_planned, piles_installed,
          tracker_rows_planned, tracker_rows_installed,
          modules_planned, modules_installed,
          inverter_pads_planned, inverter_pads_installed,
          roads_planned_m, roads_completed_m,
          blocks_planned, blocks_completed,
          overall_progress_pct, earthwork_pct, civil_pct, electrical_pct,
          notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (survey_id) DO UPDATE SET
         snapshot_date           = EXCLUDED.snapshot_date,
         piles_planned           = EXCLUDED.piles_planned,
         piles_installed         = EXCLUDED.piles_installed,
         tracker_rows_planned    = EXCLUDED.tracker_rows_planned,
         tracker_rows_installed  = EXCLUDED.tracker_rows_installed,
         modules_planned         = EXCLUDED.modules_planned,
         modules_installed       = EXCLUDED.modules_installed,
         inverter_pads_planned   = EXCLUDED.inverter_pads_planned,
         inverter_pads_installed = EXCLUDED.inverter_pads_installed,
         roads_planned_m         = EXCLUDED.roads_planned_m,
         roads_completed_m       = EXCLUDED.roads_completed_m,
         blocks_planned          = EXCLUDED.blocks_planned,
         blocks_completed        = EXCLUDED.blocks_completed,
         overall_progress_pct    = EXCLUDED.overall_progress_pct,
         earthwork_pct           = EXCLUDED.earthwork_pct,
         civil_pct               = EXCLUDED.civil_pct,
         electrical_pct          = EXCLUDED.electrical_pct,
         notes                   = EXCLUDED.notes,
         updated_at              = NOW()
       RETURNING *`,
      [
        tenantId, siteId, surveyId,
        snapshot_date || new Date().toISOString().slice(0, 10),
        piles_planned ?? 0, piles_installed ?? 0,
        tracker_rows_planned ?? 0, tracker_rows_installed ?? 0,
        modules_planned ?? 0, modules_installed ?? 0,
        inverter_pads_planned ?? 0, inverter_pads_installed ?? 0,
        roads_planned_m ?? 0, roads_completed_m ?? 0,
        blocks_planned ?? 0, blocks_completed ?? 0,
        overall_progress_pct ?? 0, earthwork_pct ?? 0,
        civil_pct ?? 0, electrical_pct ?? 0,
        notes || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] POST /surveys/:surveyId/progress', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites/:siteId/reports
router.get('/sites/:siteId/reports', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const result = await query(
      `SELECT id, tenant_id, site_id, survey_id, title, report_type,
              generated_by, pdf_url, created_at
       FROM solar_reports
       WHERE site_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [siteId, tenantId]
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/reports', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /sites/:siteId/reports
router.post('/sites/:siteId/reports', protect, authorize(...WRITE_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const { survey_id, title, report_type, generated_by, content, pdf_url } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const result = await query(
      `INSERT INTO solar_reports
         (tenant_id, site_id, survey_id, title, report_type, generated_by, content, pdf_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        tenantId, siteId, survey_id || null,
        title, report_type || 'full',
        generated_by || req.user?.name || null,
        content ? JSON.stringify(content) : '{}',
        pdf_url || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] POST /sites/:siteId/reports', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /reports/:id
router.get('/reports/:id', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM solar_reports WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    console.error('[SolarFarm] GET /reports/:id', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /sites/:siteId/export/geojson
router.get('/sites/:siteId/export/geojson', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const result = await query(
      `SELECT id, asset_type, asset_id_label, installation_status,
              lat, lng, geometry, specs
       FROM solar_assets
       WHERE site_id = $1 AND tenant_id = $2
       ORDER BY asset_type, asset_id_label`,
      [siteId, tenantId]
    );
    const features = result.rows.map((a) => {
      // Use stored geometry if available, else build Point from lat/lng
      let geometry = null;
      if (a.geometry) {
        geometry = typeof a.geometry === 'string' ? JSON.parse(a.geometry) : a.geometry;
      } else if (a.lat != null && a.lng != null) {
        geometry = { type: 'Point', coordinates: [parseFloat(a.lng), parseFloat(a.lat)] };
      }
      return {
        type: 'Feature',
        geometry,
        properties: {
          id: a.id,
          asset_type: a.asset_type,
          asset_id_label: a.asset_id_label,
          installation_status: a.installation_status,
          specs: a.specs,
        },
      };
    });
    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', `attachment; filename="site_${siteId}_assets.geojson"`);
    res.json({ type: 'FeatureCollection', features });
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/export/geojson', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /sites/:siteId/export/kml
router.get('/sites/:siteId/export/kml', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const [siteRes, assetsRes] = await Promise.all([
      query('SELECT name FROM solar_sites WHERE id = $1 AND tenant_id = $2', [siteId, tenantId]),
      query(
        `SELECT id, asset_type, asset_id_label, installation_status, lat, lng, specs
         FROM solar_assets
         WHERE site_id = $1 AND tenant_id = $2 AND lat IS NOT NULL AND lng IS NOT NULL
         ORDER BY asset_type, asset_id_label`,
        [siteId, tenantId]
      ),
    ]);
    if (!siteRes.rows.length) return res.status(404).json({ success: false, message: 'Site not found' });
    const siteName = siteRes.rows[0].name;
    const placemarks = assetsRes.rows.map((a) => `
    <Placemark>
      <name>${escapeXml(a.asset_id_label || a.id)}</name>
      <description><![CDATA[Type: ${a.asset_type} | Status: ${a.installation_status}]]></description>
      <ExtendedData>
        <Data name="asset_type"><value>${escapeXml(a.asset_type)}</value></Data>
        <Data name="installation_status"><value>${escapeXml(a.installation_status)}</value></Data>
        <Data name="asset_id"><value>${escapeXml(a.id)}</value></Data>
      </ExtendedData>
      <Point><coordinates>${a.lng},${a.lat},0</coordinates></Point>
    </Placemark>`).join('\n');
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(siteName)} – Assets</name>
    <Folder>
      <name>Solar Assets</name>
      ${placemarks}
    </Folder>
  </Document>
</kml>`;
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', `attachment; filename="site_${siteId}_assets.kml"`);
    res.send(kml);
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/export/kml', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /sites/:siteId/export/csv  (QA/QC issues)
router.get('/sites/:siteId/export/csv', protect, authorize(...ALL_ROLES), async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.body.tenant_id;
    const { siteId } = req.params;
    const result = await query(
      `SELECT title, issue_type, severity, status, lat, lng, assignee_name, created_at
       FROM solar_qaqc_issues
       WHERE site_id = $1 AND tenant_id = $2
       ORDER BY
         CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         created_at DESC`,
      [siteId, tenantId]
    );
    const header = 'title,issue_type,severity,status,lat,lng,assignee_name,created_at\n';
    const rows = result.rows.map((r) =>
      [
        csvEscape(r.title),
        csvEscape(r.issue_type),
        csvEscape(r.severity),
        csvEscape(r.status),
        r.lat ?? '',
        r.lng ?? '',
        csvEscape(r.assignee_name || ''),
        r.created_at ? new Date(r.created_at).toISOString() : '',
      ].join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="site_${siteId}_issues.csv"`);
    res.send(header + rows);
  } catch (e) {
    console.error('[SolarFarm] GET /sites/:siteId/export/csv', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default router;
