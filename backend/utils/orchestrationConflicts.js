/**
 * orchestrationConflicts.js
 * Phase 9 – Conflict Detection Utility
 *
 * Detects scheduling conflicts: pilot double-booking, weather conflicts,
 * overlapping missions, insufficient forecast windows.
 * Returns warnings only — NEVER blocks scheduling.
 */
import { query } from '../config/database.js';

/**
 * Check if a pilot is already booked during the proposed window.
 * @param {string} pilotId
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} excludeMissionId - mission being scheduled (skip self)
 * @returns {Array} conflict warnings
 */
async function checkPilotDoubleBooking(pilotId, startDate, endDate, excludeMissionId) {
    const warnings = [];
    if (!pilotId || !startDate || !endDate) return warnings;

    try {
        // Check orchestration table for overlapping assignments
        const result = await query(
            `SELECT mo.mission_id, d.title, mo.recommended_start_date, mo.recommended_end_date
             FROM mission_orchestration mo
             JOIN deployments d ON d.id = mo.mission_id
             WHERE mo.recommended_pilot = $1
             AND mo.mission_id != $2
             AND mo.status IN ('suggested', 'approved')
             AND mo.recommended_start_date <= $3::date
             AND mo.recommended_end_date >= $4::date`,
            [pilotId, excludeMissionId, endDate, startDate]
        );

        if (result.rows.length > 0) {
            result.rows.forEach(row => {
                warnings.push({
                    type: 'PILOT_DOUBLE_BOOKING',
                    severity: 'high',
                    message: `Pilot already scheduled for "${row.title}" (${row.recommended_start_date} – ${row.recommended_end_date})`,
                    conflictMissionId: row.mission_id,
                });
            });
        }
    } catch (e) {
        console.warn('[orchestrationConflicts] Pilot check error:', e.message);
    }
    return warnings;
}

/**
 * Check if forecast window has sufficient weather quality.
 * @param {number} weatherScore
 * @param {number} forecastConfidence
 * @returns {Array} warnings
 */
function checkWeatherConflict(weatherScore, forecastConfidence) {
    const warnings = [];
    if ((parseFloat(weatherScore) || 0) < 40) {
        warnings.push({
            type: 'WEATHER_CONFLICT',
            severity: 'high',
            message: `Low weather score (${weatherScore}/100) — significant flight delay risk`,
        });
    } else if ((parseFloat(weatherScore) || 0) < 60) {
        warnings.push({
            type: 'WEATHER_CONCERN',
            severity: 'medium',
            message: `Below-average weather score (${weatherScore}/100) — some delay risk`,
        });
    }
    if ((parseFloat(forecastConfidence) || 0) < 50) {
        warnings.push({
            type: 'LOW_FORECAST_CONFIDENCE',
            severity: 'medium',
            message: `Low forecast confidence (${forecastConfidence}%) — schedule may need adjustment`,
        });
    }
    return warnings;
}

/**
 * Check if mission overlaps with other active missions at the same site.
 * @param {string} missionId
 * @param {string} siteId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Array} warnings
 */
async function checkOverlappingMissions(missionId, siteId, startDate, endDate) {
    const warnings = [];
    if (!siteId) return warnings;

    try {
        const result = await query(
            `SELECT d.id, d.title FROM deployments d
             WHERE d.site_id = $1 AND d.id != $2
             AND d.status IN ('Active', 'Scheduled')
             LIMIT 5`,
            [siteId, missionId]
        );

        if (result.rows.length > 0) {
            warnings.push({
                type: 'OVERLAPPING_SITE_MISSIONS',
                severity: 'low',
                message: `${result.rows.length} other mission(s) active at same site: ${result.rows.map(r => `"${r.title}"`).join(', ')}`,
            });
        }
    } catch (e) {
        console.warn('[orchestrationConflicts] Overlap check error:', e.message);
    }
    return warnings;
}

/**
 * Check if there is a sufficient forecast window (minimum 3 days).
 * @param {number} consecutiveDays
 * @param {number} estimatedDays
 * @returns {Array} warnings
 */
function checkInsufficientForecastWindow(consecutiveDays, estimatedDays) {
    const warnings = [];
    if (!consecutiveDays || !estimatedDays) return warnings;

    if (consecutiveDays < estimatedDays) {
        warnings.push({
            type: 'INSUFFICIENT_FORECAST_WINDOW',
            severity: 'medium',
            message: `Forecast window (${consecutiveDays} days) shorter than estimated mission duration (${estimatedDays} days)`,
        });
    }
    if (consecutiveDays < 3) {
        warnings.push({
            type: 'SHORT_FORECAST_WINDOW',
            severity: 'high',
            message: `Forecast window too short (${consecutiveDays} days) — high disruption risk`,
        });
    }
    return warnings;
}

/**
 * Run all conflict checks for a proposed orchestration plan.
 * Returns { warnings[], hasHighSeverity, hasConflicts }
 *
 * @param {Object} plan
 * @param {string} plan.missionId
 * @param {string} plan.pilotId
 * @param {string} plan.startDate
 * @param {string} plan.endDate
 * @param {string} plan.siteId
 * @param {number} plan.weatherScore
 * @param {number} plan.forecastConfidence
 * @param {number} plan.consecutiveDays
 * @param {number} plan.estimatedDays
 */
export async function detectOrchestrationConflicts(plan) {
    const {
        missionId, pilotId, startDate, endDate, siteId,
        weatherScore, forecastConfidence, consecutiveDays, estimatedDays
    } = plan;

    const [pilotWarnings, overlapWarnings] = await Promise.all([
        checkPilotDoubleBooking(pilotId, startDate, endDate, missionId),
        checkOverlappingMissions(missionId, siteId, startDate, endDate),
    ]);

    const staticWarnings = [
        ...checkWeatherConflict(weatherScore, forecastConfidence),
        ...checkInsufficientForecastWindow(consecutiveDays, estimatedDays),
    ];

    const warnings = [...pilotWarnings, ...overlapWarnings, ...staticWarnings];
    const hasHighSeverity = warnings.some(w => w.severity === 'high');
    const hasConflicts = warnings.length > 0;

    return { warnings, hasHighSeverity, hasConflicts };
}
