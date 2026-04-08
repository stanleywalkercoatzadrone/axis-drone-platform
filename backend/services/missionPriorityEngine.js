/**
 * missionPriorityEngine.js
 * Phase 2 – Mission Priority Engine
 *
 * Determines which missions should be scheduled first based on weighted scoring.
 * READ-ONLY — does not mutate any mission data.
 */
import { query } from '../config/database.js';

/**
 * Default weights for priority calculation.
 * Admin can override via system_settings in future.
 */
const WEIGHTS = {
    financialExposure: 0.40,
    clientPriority: 0.20,
    forecastConfidence: 0.20,
    weatherRisk: 0.10,
    deadlineUrgency: 0.10,
};

/**
 * Calculate deadline urgency score (0-100).
 * Closer deadlines get higher urgency.
 * @param {string|null} deadline - ISO date string or null
 */
function calcDeadlineUrgency(deadline) {
    if (!deadline) return 30; // Unknown deadline → medium urgency
    const daysUntil = Math.max(0, (new Date(deadline) - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7) return 100;
    if (daysUntil <= 14) return 85;
    if (daysUntil <= 30) return 65;
    if (daysUntil <= 60) return 40;
    return 20;
}

/**
 * Normalize financial exposure to 0-100 score.
 * Assumes $500k is "maximum" exposure.
 * @param {number} exposure
 */
function normalizeFinancialExposure(exposure) {
    const MAX = 500000;
    return Math.min(100, Math.round((parseFloat(exposure) || 0) / MAX * 100));
}

/**
 * Convert weather score (0-100) to risk adjustment (0-100).
 * Low weather score = high risk adjustment (contributes positively to priority).
 */
function calcWeatherRiskAdjustment(weatherScore) {
    // High risk weather (low score) → higher priority to get it done before conditions worsen
    return Math.max(0, 100 - (parseFloat(weatherScore) || 50));
}

/**
 * Calculate priority score for a single mission.
 * All inputs normalized to 0-100 before weighting.
 *
 * @param {Object} params
 * @param {number} params.financialExposure - dollar value at risk
 * @param {number} params.clientPriority - 0-100 client tier score
 * @param {number} params.forecastConfidence - 0-100 forecast confidence
 * @param {number} params.weatherScore - 0-100 weather score
 * @param {string|null} params.deadline - target completion date
 * @param {Object} [params.weights] - optional weight overrides
 * @returns {number} priority score 0-100
 */
export function calculatePriorityScore({
    financialExposure = 0,
    clientPriority = 50,
    forecastConfidence = 50,
    weatherScore = 50,
    deadline = null,
    weights = WEIGHTS,
}) {
    const w = { ...WEIGHTS, ...weights };

    const components = {
        financialExposure: normalizeFinancialExposure(financialExposure) * w.financialExposure,
        clientPriority: Math.min(100, parseFloat(clientPriority) || 50) * w.clientPriority,
        forecastConfidence: Math.min(100, parseFloat(forecastConfidence) || 50) * w.forecastConfidence,
        weatherRisk: calcWeatherRiskAdjustment(weatherScore) * w.weatherRisk,
        deadlineUrgency: calcDeadlineUrgency(deadline) * w.deadlineUrgency,
    };

    const total = Object.values(components).reduce((sum, v) => sum + v, 0);
    return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * Score all active missions and return ranked list.
 * @param {string} tenantId
 * @returns {Array} ranked missions with priority scores
 */
export async function rankActiveMissions(tenantId) {
    const result = await query(
        `SELECT d.id, d.title, d.status, d.site_name, d.industry_key,
                d.latitude, d.longitude, d.days_on_site,
                d.orchestration_enabled,
                -- Best forecast confidence for this mission
                COALESCE(
                    (SELECT MAX(mfw.forecast_confidence)
                     FROM mission_forecast_windows mfw
                     WHERE mfw.mission_id = d.id),
                    50
                ) as best_forecast_confidence,
                COALESCE(
                    (SELECT MAX(mfw.weather_score)
                     FROM mission_forecast_windows mfw
                     WHERE mfw.mission_id = d.id),
                    50
                ) as best_weather_score,
                -- Existing orchestration priority if any
                (SELECT mo.priority_score FROM mission_orchestration mo
                 WHERE mo.mission_id = d.id ORDER BY mo.created_at DESC LIMIT 1) as existing_priority
         FROM deployments d
         WHERE d.status IN ('Scheduled', 'Active', 'Delayed')
         AND (d.tenant_id = $1 OR d.tenant_id IS NULL)
         ORDER BY d.created_at DESC`,
        [tenantId]
    );

    return result.rows.map(row => ({
        missionId: row.id,
        title: row.title,
        status: row.status,
        siteName: row.site_name,
        orchestrationEnabled: row.orchestration_enabled !== false,
        priorityScore: calculatePriorityScore({
            forecastConfidence: parseFloat(row.best_forecast_confidence) || 50,
            weatherScore: parseFloat(row.best_weather_score) || 50,
            // Financial exposure and client priority default — extend when those fields added
            financialExposure: 0,
            clientPriority: 50,
        }),
    })).sort((a, b) => b.priorityScore - a.priorityScore);
}
