/**
 * pilotMetricsController.js
 * Phase 8 — Pilot performance scoring from real mission data.
 * Additive only — reads from existing tables, writes to pilot_metrics.
 */
import { query } from '../config/database.js';

/**
 * Recompute a pilot's metrics from real data and upsert into pilot_metrics.
 * Called internally after session events.
 */
export async function upsertPilotMetrics(pilotId) {
    try {
        // missions_completed = sessions that are "closed" or "completed" per mission
        const completedRes = await query(`
            SELECT COUNT(DISTINCT mission_id) as missions_completed
            FROM mission_work_sessions
            WHERE pilot_id = $1 AND status IN ('completed', 'closed')
        `, [pilotId]);

        const sessionsRes = await query(`
            SELECT
                COUNT(*) as sessions_completed,
                COUNT(*) FILTER (WHERE weather_stop = true) as weather_interruptions,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60.0)
                    FILTER (WHERE end_time IS NOT NULL) as avg_session_minutes
            FROM mission_work_sessions
            WHERE pilot_id = $1
        `, [pilotId]);

        const faultsRes = await query(`
            SELECT COUNT(*) as faults_detected
            FROM thermal_faults
            WHERE mission_id IN (
                SELECT DISTINCT mission_id FROM mission_work_sessions WHERE pilot_id = $1
            )
        `, [pilotId]);

        const mc = parseInt(completedRes.rows[0]?.missions_completed ?? 0);
        const sc = parseInt(sessionsRes.rows[0]?.sessions_completed ?? 0);
        const wi = parseInt(sessionsRes.rows[0]?.weather_interruptions ?? 0);
        const avg = parseFloat(sessionsRes.rows[0]?.avg_session_minutes ?? 0);
        const fd = parseInt(faultsRes.rows[0]?.faults_detected ?? 0);

        // Score formula from spec: (missions_completed * 2) + sessions_completed + thermal_faults_detected - weather_interruptions
        const pilotScore = Math.max(0, (mc * 2) + sc + fd - wi);

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

        // Resolve user-id → personnel-id if needed (same pattern as performance endpoint)
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

        // Recompute fresh
        const computed = await upsertPilotMetrics(resolvedId);

        const metricRow = await query(
            `SELECT * FROM pilot_metrics WHERE pilot_id = $1`, [resolvedId]
        );

        if (metricRow.rows.length === 0) {
            // First time — return zeroes
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

/** GET /api/pilot-metrics/leaderboard — top 10 pilots */
export const getLeaderboard = async (req, res) => {
    try {
        const { tenantId } = req.user;

        // Build tenant filter — if tenantId is null/undefined, show all personnel
        const tenantFilter = tenantId
            ? `(p.tenant_id::text = '${tenantId}'::text OR p.tenant_id IS NULL)`
            : `1=1`;
        const personnelTenantFilter = tenantId
            ? `(tenant_id::text = '${tenantId}'::text OR tenant_id IS NULL)`
            : `1=1`;

        // First try pre-computed metrics
        let result = await query(`
            SELECT pm.*, p.full_name, p.email, p.photo_url
            FROM pilot_metrics pm
            JOIN personnel p ON p.id = pm.pilot_id
            WHERE ${tenantFilter}
            ORDER BY pm.pilot_score DESC
            LIMIT 20
        `);

        // If pilot_metrics table is empty, compute live from session data and upsert
        if (result.rows.length === 0) {
            const pilotsWithSessions = await query(`
                SELECT DISTINCT mws.pilot_id, p.full_name, p.email, p.photo_url
                FROM mission_work_sessions mws
                JOIN personnel p ON p.id = mws.pilot_id
                WHERE ${tenantFilter}
            `);

            if (pilotsWithSessions.rows.length > 0) {
                for (const pilot of pilotsWithSessions.rows) {
                    await upsertPilotMetrics(pilot.pilot_id);
                }
                result = await query(`
                    SELECT pm.*, p.full_name, p.email, p.photo_url
                    FROM pilot_metrics pm
                    JOIN personnel p ON p.id = pm.pilot_id
                    WHERE ${tenantFilter}
                    ORDER BY pm.pilot_score DESC
                    LIMIT 20
                `);
            }

            // If still no sessions at all — return ALL personnel as zeroed leaderboard
            if (result.rows.length === 0) {
                const allPilots = await query(`
                    SELECT id as pilot_id, full_name, email, photo_url,
                           0 as missions_completed, 0 as sessions_completed,
                           0 as weather_interruptions, 0 as avg_completion_speed,
                           0 as faults_detected, 0 as pilot_score, 5.0 as rating
                    FROM personnel
                    WHERE ${personnelTenantFilter}
                    ORDER BY full_name ASC
                    LIMIT 20
                `);
                return res.json({ success: true, data: allPilots.rows });
            }
        }

        // Normalize field names (controller uses thermal_faults_detected, view expects faults_detected)
        const normalized = result.rows.map(r => ({
            ...r,
            faults_detected: r.faults_detected ?? r.thermal_faults_detected ?? 0,
            pilot_name: r.pilot_name ?? r.full_name,
            rating: r.rating ?? 5.0,
        }));

        res.json({ success: true, data: normalized });
    } catch (err) {
        console.error('[getLeaderboard]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};
