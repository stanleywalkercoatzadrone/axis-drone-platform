/**
 * forecastAlerts.js
 * Phase 10 – Forecast Alert Notification System
 *
 * Triggers when a new optimal forecast window is detected for a mission.
 * Notifies via: email, pilot dashboard notification (DB), with Slack/SMS hooks provided.
 * Non-blocking — all failures are swallowed.
 */
import { query } from '../config/database.js';
import { sendMissionAssignmentEmail } from './emailService.js';

/**
 * Check for new recommended windows and fire alerts if found.
 * Called after each forecast generation.
 * @param {string} missionId
 * @param {Object[]} windows - scored forecast windows
 */
export async function triggerForecastAlerts(missionId, windows) {
    try {
        const optimalWindows = windows.filter(w => w.recommended || w.confidence_score >= 75);
        if (optimalWindows.length === 0) return;

        const best = optimalWindows[0];

        // Load mission + assigned pilots
        const missionRes = await query(
            `SELECT d.title, d.site_name, d.tenant_id,
                    array_agg(DISTINCT p.email) FILTER (WHERE p.email IS NOT NULL) as pilot_emails,
                    array_agg(DISTINCT p.full_name) FILTER (WHERE p.full_name IS NOT NULL) as pilot_names
             FROM deployments d
             LEFT JOIN deployment_personnel dp ON dp.deployment_id = d.id
             LEFT JOIN personnel p ON p.id = dp.personnel_id
             WHERE d.id = $1
             GROUP BY d.id`,
            [missionId]
        );
        if (missionRes.rows.length === 0) return;
        const mission = missionRes.rows[0];

        const messageBody = `
Optimal forecast window detected for ${mission.title}
Site: ${mission.site_name || 'N/A'}

Window: ${best.startDate || best.forecast_start_date || '?'} – ${best.endDate || best.forecast_end_date || '?'}
Weather Score: ${best.weatherScore || best.weather_score || '?'}/100
Forecast Confidence: ${best.forecastConfidence || best.forecast_confidence || best.confidenceScore || '?'}%
Consecutive Days: ${best.consecutiveDays || best.consecutive_days || '?'}

This is an automated forecast advisory from the Axis Platform.
`.trim();

        // 1. Store in-app notification (dashboard)
        await createDashboardNotification(missionId, mission.tenant_id, mission.title, best);

        // 2. Email pilot(s) assigned to the mission
        const pilotEmails = mission.pilot_emails || [];
        for (const email of pilotEmails) {
            try {
                await sendMissionAssignmentEmail({
                    to: email,
                    subject: `📡 Optimal Flight Window: ${mission.title}`,
                    text: messageBody,
                    html: `<pre style="font-family:monospace">${messageBody}</pre>`
                }).catch(() => { }); // Never throw
            } catch { /* swallow */ }
        }

        // 3. Slack webhook (if configured)
        if (process.env.SLACK_WEBHOOK_URL) {
            fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: `📡 *${mission.title}*: ${messageBody}` })
            }).catch(() => { });
        }

        console.log(`[forecastAlerts] Alerts sent for mission ${missionId} (${optimalWindows.length} optimal windows)`);
    } catch (err) {
        console.warn('[forecastAlerts] Error (non-fatal):', err.message);
    }
}

/**
 * Create in-app notification record for pilot dashboards.
 */
async function createDashboardNotification(missionId, tenantId, missionTitle, window) {
    try {
        // Ensure notifications table exists
        await query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id   TEXT,
                mission_id  UUID,
                type        TEXT DEFAULT 'FORECAST_ALERT',
                title       TEXT,
                message     TEXT,
                read        BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await query(
            `INSERT INTO notifications (tenant_id, mission_id, type, title, message)
             VALUES ($1, $2, 'FORECAST_ALERT', $3, $4)`,
            [
                tenantId,
                missionId,
                `Optimal Window: ${missionTitle}`,
                `Window ${window.startDate || window.forecast_start_date} – ${window.endDate || window.forecast_end_date}, Confidence: ${window.forecastConfidence || window.confidence_score || '?'}%`
            ]
        );
    } catch (e) {
        console.warn('[forecastAlerts] Failed to create dashboard notification:', e.message);
    }
}
