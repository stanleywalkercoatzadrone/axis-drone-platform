/**
 * pilotMetricsController.js
 * Phase 8 — Pilot performance scoring from real mission data (daily_logs).
 * Additive only — reads from existing tables, writes to pilot_metrics.
 */
import { query } from '../config/database.js';

/**
 * Recompute a pilot's metrics from daily_logs data and upsert into pilot_metrics.
 * Uses technician_id in daily_logs (which references personnel.id).
 */
export async function upsertPilotMetrics(pilotId) {
    try {
        // missions_completed = distinct deployments with status 'Completed'
        const completedRes = await query(`
            SELECT COUNT(DISTINCT dl.deployment_id) as missions_completed
            FROM daily_logs dl
            JOIN deployments d ON d.id = dl.deployment_id
            WHERE dl.technician_id = $1
              AND d.status = 'Completed'
        `, [pilotId]);

        // sessions_completed = total daily log entries (each = one day worked)
        // total_deployments = all distinct deployments regardless of status
        const sessionsRes = await query(`
            SELECT
                COUNT(*) as sessions_completed,
                COUNT(DISTINCT deployment_id) as total_deployments,
                AVG(dl.daily_pay) as avg_daily_pay
            FROM daily_logs dl
            WHERE dl.technician_id = $1
        `, [pilotId]);

        // faults_detected from thermal_faults if table exists (best-effort)
        let fd = 0;
        try {
            const faultsRes = await query(`
                SELECT COUNT(*) as faults_detected
                FROM thermal_faults
                WHERE mission_id IN (
                    SELECT DISTINCT deployment_id FROM daily_logs WHERE technician_id = $1
                )
            `, [pilotId]);
            fd = parseInt(faultsRes.rows[0]?.faults_detected ?? 0);
        } catch (_) { /* thermal_faults may not exist — non-fatal */ }

        const mc = parseInt(completedRes.rows[0]?.missions_completed ?? 0);
        const sc = parseInt(sessionsRes.rows[0]?.sessions_completed ?? 0);
        const td = parseInt(sessionsRes.rows[0]?.total_deployments ?? 0);
        const avg = parseFloat(sessionsRes.rows[0]?.avg_daily_pay ?? 0);
        const wi = 0; // weather_interruptions not tracked in daily_logs

        // Score: completed missions * 3 + total session days + faults bonus + active deployments
        const pilotScore = Math.max(0, (mc * 3) + sc + fd + td);

        await query(`
            INSERT INTO pilot_metrics (
                pilot_id, missions_completed, sessions_completed,
                weather_interruptions, avg_completion_speed,
                faults_detected, pilot_score, last_computed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
            ON CONFLICT (pilot_id) DO UPDATE SET
                missions_completed      = EXCLUDED.missions_completed,
                sessions_completed      = EXCLUDED.sessions_completed,
                weather_interruptions   = EXCLUDED.weather_interruptions,
                avg_completion_speed    = EXCLUDED.avg_completion_speed,
                faults_detected         = EXCLUDED.faults_detected,
                pilot_score             = EXCLUDED.pilot_score,
                last_computed_at        = now()
        `, [pilotId, mc, sc, wi, avg, fd, pilotScore]);

        return { mc, sc, wi, avg, fd, pilotScore };
    } catch (e) {
        console.warn('[pilotMetrics] upsert failed (non-fatal):', e.message);
        return null;
    }
}

/** GET /api/pilot-metrics/:pilotId */
export const getPilotMetrics = async (req, res) => {
    try {
        const { pilotId } = req.params;

        // Resolve user-id → personnel-id if needed
        let resolvedId = pilotId;
        const directRes = await query(
            `SELECT id FROM personnel WHERE id = $1`, [pilotId]
        );
        if (directRes.rows.length === 0) {
            const userRes = await query(`SELECT email FROM users WHERE id = $1`, [pilotId]);
            if (userRes.rows.length > 0) {
                const pRes = await query(`SELECT id FROM personnel WHERE email = $1`, [userRes.rows[0].email]);
                if (pRes.rows.length > 0) resolvedId = pRes.rows[0].id;
            }
        }

        // Recompute fresh from daily_logs
        await upsertPilotMetrics(resolvedId);

        const metricRow = await query(
            `SELECT * FROM pilot_metrics WHERE pilot_id = $1`, [resolvedId]
        );

        if (metricRow.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    missions_completed: 0, sessions_completed: 0,
                    weather_interruptions: 0, avg_completion_speed: 0,
                    faults_detected: 0, pilot_score: 0, rating: 5.0
                }
            });
        }

        res.json({ success: true, data: metricRow.rows[0] });
    } catch (err) {
        console.error('[getPilotMetrics]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

/** GET /api/pilot-metrics/leaderboard — top pilots ranked by score */
export const getLeaderboard = async (req, res) => {
    try {
        const { tenantId } = req.user;

        const tenantFilter = tenantId
            ? `(p.tenant_id::text = '${tenantId}'::text OR p.tenant_id IS NULL)`
            : `1=1`;
        const personnelTenantFilter = tenantId
            ? `(tenant_id::text = '${tenantId}'::text OR tenant_id IS NULL)`
            : `1=1`;

        // Always recompute metrics from daily_logs for all personnel in this tenant
        const allPersonnel = await query(`
            SELECT id as pilot_id FROM personnel
            WHERE ${personnelTenantFilter}
        `);

        for (const p of allPersonnel.rows) {
            await upsertPilotMetrics(p.pilot_id);
        }

        // Fetch freshly computed metrics joined with personnel names
        const result = await query(`
            SELECT pm.*, p.full_name, p.email, p.photo_url
            FROM pilot_metrics pm
            JOIN personnel p ON p.id = pm.pilot_id
            WHERE ${tenantFilter}
            ORDER BY pm.pilot_score DESC
            LIMIT 20
        `);

        if (result.rows.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const normalized = result.rows.map(r => ({
            ...r,
            faults_detected: r.faults_detected ?? r.thermal_faults_detected ?? 0,
            pilot_name: r.full_name || r.pilot_name || `Pilot ${r.pilot_id}`,
            rating: r.rating ?? 5.0,
        }));

        res.json({ success: true, data: normalized });
    } catch (err) {
        console.error('[getLeaderboard]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};
