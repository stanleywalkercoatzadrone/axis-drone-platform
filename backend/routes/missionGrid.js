/**
 * missionGrid.js — Mission Grid Data API
 * Phase 3 – Global Mission Grid
 * Phase 11 – Admin-only access (clients and pilots cannot access)
 * Phase 13 – Redis caching (60s TTL)
 *
 * GET  /api/mission-grid               — Full grid data (admin only)
 * GET  /api/mission-grid/:missionId    — Single mission detail
 * POST /api/mission-grid/invalidate    — Bust cache on data change (admin)
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getCache, setCache, deleteCache } from '../config/redis.js';
import { classifyWeatherRisk, getMissionMarkerColor } from '../utils/weatherRiskClassifier.js';

const router = express.Router();
const CACHE_KEY = 'mission-grid-cache';
const CACHE_TTL = 60; // 60 seconds

// Phase 11: All routes are admin-only
router.use(protect);
router.use(authorize('admin'));

// ── GET /api/mission-grid ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { tenantId } = req.user;
        const cacheKeyTenant = `${CACHE_KEY}:${tenantId}`;

        // Phase 13: Check Redis cache first
        const cached = await getCache(cacheKeyTenant);
        if (cached) {
            return res.json({ success: true, missions: cached, cached: true });
        }

        const result = await query(
            `SELECT
                d.id,
                d.title,
                d.site_name,
                d.site_id,
                d.status,
                d.mission_status,
                d.industry_key,
                d.latitude,
                d.longitude,
                d.days_on_site,
                d.date,
                d.orchestration_enabled,
                d.created_at,
                -- Best forecast window
                (SELECT row_to_json(w) FROM (
                    SELECT mfw.forecast_start_date, mfw.forecast_end_date,
                           mfw.weather_score, mfw.confidence_score,
                           mfw.forecast_confidence, mfw.recommended,
                           mfw.consecutive_days
                    FROM mission_forecast_windows mfw
                    WHERE mfw.mission_id = d.id
                    ORDER BY COALESCE(mfw.forecast_confidence, 0) DESC
                    LIMIT 1
                ) w) AS forecast_window,
                -- AI orchestration recommendation
                (SELECT row_to_json(o) FROM (
                    SELECT mo.recommended_start_date, mo.recommended_end_date,
                           mo.ai_confidence, mo.priority_score, mo.status,
                           mo.manual_override, mo.predicted_completion_days,
                           u.full_name as recommended_pilot_name
                    FROM mission_orchestration mo
                    LEFT JOIN users u ON u.id = mo.recommended_pilot
                    WHERE mo.mission_id = d.id
                    ORDER BY mo.created_at DESC LIMIT 1
                ) o) AS orchestration,
                -- Assigned pilots
                COALESCE(
                    (SELECT json_agg(json_build_object(
                        'personnelId', p.id,
                        'name', p.full_name,
                        'email', p.email
                    ))
                    FROM deployment_personnel dp
                    JOIN personnel p ON p.id = dp.personnel_id
                    WHERE dp.deployment_id = d.id),
                    '[]'
                ) AS assigned_pilots,
                -- Pilot reliability score (best assigned)
                (SELECT MAX(pp.reliability_score)
                 FROM deployment_personnel dp
                 JOIN personnel p ON p.id = dp.personnel_id
                 JOIN pilot_performance pp ON pp.pilot_id = p.user_id
                 WHERE dp.deployment_id = d.id
                ) AS pilot_reliability
             FROM deployments d
             WHERE (d.tenant_id = $1 OR d.tenant_id IS NULL)
             AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
             ORDER BY d.date DESC, d.created_at DESC
             LIMIT 200`,
            [tenantId]
        );

        const missions = result.rows.map(row => {
            const w = row.forecast_window;
            const o = row.orchestration;
            const weatherRisk = classifyWeatherRisk(w);
            const markerColor = getMissionMarkerColor(row.mission_status || row.status);

            return {
                id: row.id,
                title: row.title,
                siteName: row.site_name,
                siteId: row.site_id,
                status: row.status,
                missionStatus: row.mission_status,
                industryKey: row.industry_key,
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude),
                daysOnSite: row.days_on_site,
                date: row.date,
                orchestrationEnabled: row.orchestration_enabled,
                assignedPilots: row.assigned_pilots || [],
                pilotReliability: row.pilot_reliability ? parseFloat(row.pilot_reliability) : null,
                forecastWindow: w ? {
                    startDate: w.forecast_start_date,
                    endDate: w.forecast_end_date,
                    weatherScore: w.weather_score,
                    confidenceScore: w.confidence_score,
                    forecastConfidence: w.forecast_confidence,
                    recommended: w.recommended,
                    consecutiveDays: w.consecutive_days,
                } : null,
                orchestration: o ? {
                    recommendedStartDate: o.recommended_start_date,
                    recommendedEndDate: o.recommended_end_date,
                    aiConfidence: o.ai_confidence,
                    priorityScore: o.priority_score,
                    status: o.status,
                    manualOverride: o.manual_override,
                    predictedCompletionDays: o.predicted_completion_days,
                    recommendedPilotName: o.recommended_pilot_name,
                } : null,
                weatherRisk: {
                    risk: weatherRisk.risk,
                    label: weatherRisk.label,
                    color: weatherRisk.color,
                    score: weatherRisk.score,
                },
                markerColor,
            };
        });

        // Phase 13: Cache for 60 seconds
        await setCache(cacheKeyTenant, missions, CACHE_TTL);

        res.json({ success: true, missions, cached: false, total: missions.length });
    } catch (err) {
        console.error('[missionGrid GET /]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/mission-grid/:missionId ─────────────────────────────────────────
router.get('/:missionId', async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await query(
            `SELECT d.*,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', p.full_name, 'email', p.email))
                         FROM deployment_personnel dp JOIN personnel p ON p.id = dp.personnel_id
                         WHERE dp.deployment_id = d.id), '[]'
                    ) AS assigned_pilots,
                    (SELECT row_to_json(mfw) FROM mission_forecast_windows mfw
                     WHERE mfw.mission_id = d.id
                     ORDER BY COALESCE(mfw.forecast_confidence, 0) DESC LIMIT 1) AS forecast_window,
                    (SELECT row_to_json(mo) FROM mission_orchestration mo
                     WHERE mo.mission_id = d.id ORDER BY mo.created_at DESC LIMIT 1) AS orchestration
             FROM deployments d WHERE d.id = $1`,
            [missionId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Mission not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/mission-grid/invalidate ────────────────────────────────────────
// Phase 13: Bust cache when forecast/assignment/status changes
router.post('/invalidate', async (req, res) => {
    try {
        const { tenantId } = req.user;
        await deleteCache(`${CACHE_KEY}:${tenantId}`);
        res.json({ success: true, message: 'Mission grid cache cleared' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
