/**
 * weatherRiskClassifier.js
 * Phase 4 – Weather Risk Classifier Utility
 *
 * Classifies weather risk for a mission forecast window.
 * Used by Mission Grid API, Orchestrator, and Command Center.
 */

/**
 * Classify weather risk from forecast window data.
 * @param {Object} forecastWindow - forecast window record
 * @param {number} [forecastWindow.forecast_confidence]
 * @param {number} [forecastWindow.confidence_score]
 * @param {number} [forecastWindow.weather_score]
 * @returns {{ risk: 'LOW'|'MEDIUM'|'HIGH', label: string, color: string, score: number }}
 */
export function classifyWeatherRisk(forecastWindow) {
    if (!forecastWindow) {
        return { risk: 'HIGH', label: 'No Forecast', color: '#ef4444', score: 0 };
    }

    // Use forecast_confidence first, fall back to confidence_score, then weather_score
    const confidence = parseFloat(
        forecastWindow.forecast_confidence ??
        forecastWindow.confidence_score ??
        forecastWindow.weather_score ??
        0
    );

    if (confidence >= 80) return { risk: 'LOW', label: 'Low Risk', color: '#22c55e', score: confidence };
    if (confidence >= 60) return { risk: 'MEDIUM', label: 'Medium Risk', color: '#f59e0b', score: confidence };
    return { risk: 'HIGH', label: 'High Risk', color: '#ef4444', score: confidence };
}

/**
 * Classify from a raw weather score (0-100).
 */
export function classifyFromWeatherScore(weatherScore) {
    return classifyWeatherRisk({ weather_score: weatherScore });
}

/**
 * Get Leaflet marker color class for a mission.
 * @param {'pending'|'scheduled'|'active'|'paused'|'delayed'|'completed'} status
 * @returns {string} hex color
 */
export function getMissionMarkerColor(status) {
    const map = {
        active: '#22c55e',
        scheduled: '#3b82f6',
        pending: '#eab308',
        paused: '#94a3b8',
        delayed: '#ef4444',
        completed: '#8b5cf6',
        // Legacy status values from existing deployments
        Active: '#22c55e',
        Scheduled: '#3b82f6',
        Draft: '#eab308',
        Delayed: '#ef4444',
        Completed: '#8b5cf6',
        Cancelled: '#64748b',
        Review: '#06b6d4',
    };
    return map[status] || '#6b7280';
}
