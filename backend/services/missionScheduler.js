/**
 * missionScheduler.js
 * Phase 12 – Automated Mission Scheduling Service
 *
 * Suggests optimal mission start date, pilot assignment, and completion window.
 * READ-ONLY analysis — produces a recommended plan. Admin approval required.
 */
import { query } from '../config/database.js';

/**
 * Generate a recommended schedule plan for a mission.
 * @param {string} missionId
 * @returns {Object} recommendedPlan
 */
export async function suggestMissionSchedule(missionId) {
    // 1. Load mission and its forecast windows
    const missionRes = await query(
        `SELECT d.id, d.title, d.latitude, d.longitude, d.industry_key, d.site_name,
                d.days_on_site
         FROM deployments d WHERE d.id = $1`,
        [missionId]
    );
    if (missionRes.rows.length === 0) throw new Error('Mission not found');
    const mission = missionRes.rows[0];

    // 2. Load forecast windows (best windows first)
    const windowsRes = await query(
        `SELECT forecast_start_date, forecast_end_date, consecutive_days,
                weather_score, confidence_score, recommended, forecast_confidence
         FROM mission_forecast_windows
         WHERE mission_id = $1
         ORDER BY confidence_score DESC, weather_score DESC
         LIMIT 5`,
        [missionId]
    );
    const windows = windowsRes.rows;

    // 3. Load available pilots with reliability scores
    const pilotsRes = await query(
        `SELECT pp.pilot_id, pp.reliability_score, pp.missions_completed,
                pp.average_blocks_per_day, pp.equipment_failure_rate,
                u.full_name, u.email
         FROM pilot_performance pp
         JOIN users u ON u.id = pp.pilot_id
         WHERE pp.reliability_score IS NOT NULL
         ORDER BY pp.reliability_score DESC
         LIMIT 10`
    );
    const pilots = pilotsRes.rows;

    // 4. Determine best window
    const bestWindow = windows.find(w => w.recommended) || windows[0] || null;

    // 5. Determine best pilot (highest reliability score)
    const recommendedPilot = pilots[0] || null;

    // 6. Estimate output — use best pilot's average blocks/day or fallback
    const blocksPerDay = parseFloat(recommendedPilot?.average_blocks_per_day) || 300;
    const estimatedCompletionDays = mission.days_on_site || Math.ceil(1000 / blocksPerDay);

    return {
        missionId,
        missionTitle: mission.title,
        siteName: mission.site_name,
        industry: mission.industry_key,
        recommendation: {
            suggestedStartDate: bestWindow?.forecast_start_date || null,
            suggestedEndDate: bestWindow
                ? new Date(
                    new Date(bestWindow.forecast_start_date).getTime() +
                    estimatedCompletionDays * 24 * 60 * 60 * 1000
                ).toISOString().split('T')[0]
                : null,
            estimatedCompletionDays,
            recommendedPilot: recommendedPilot
                ? {
                    pilotId: recommendedPilot.pilot_id,
                    fullName: recommendedPilot.full_name,
                    reliabilityScore: parseFloat(recommendedPilot.reliability_score),
                    missionsCompleted: recommendedPilot.missions_completed,
                    avgBlocksPerDay: parseFloat(recommendedPilot.average_blocks_per_day) || null,
                }
                : null,
            forecastWindow: bestWindow
                ? {
                    startDate: bestWindow.forecast_start_date,
                    endDate: bestWindow.forecast_end_date,
                    weatherScore: bestWindow.weather_score,
                    confidenceScore: bestWindow.confidence_score,
                    forecastConfidence: bestWindow.forecast_confidence,
                    consecutiveDays: bestWindow.consecutive_days,
                }
                : null,
            requiresAdminApproval: true,
            generatedAt: new Date().toISOString(),
        },
        availablePilots: pilots.map(p => ({
            pilotId: p.pilot_id,
            fullName: p.full_name,
            reliabilityScore: parseFloat(p.reliability_score) || null,
            missionsCompleted: p.missions_completed,
        })),
        forecastWindows: windows,
    };
}

/**
 * Get all pending schedule suggestions for admin review.
 * These are stored in mission_schedule_suggestions (advisory only).
 */
export async function getScheduleSuggestions(tenantId) {
    const result = await query(
        `SELECT mss.*, d.title as mission_title, d.site_name
         FROM mission_schedule_suggestions mss
         JOIN deployments d ON d.id = mss.mission_id
         WHERE d.tenant_id = $1 AND mss.status = 'pending'
         ORDER BY mss.created_at DESC`,
        [tenantId]
    );
    return result.rows;
}
