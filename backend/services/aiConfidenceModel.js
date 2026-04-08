/**
 * aiConfidenceModel.js
 * Phase 11 – AI Confidence Model
 *
 * Computes a 0-100 AI confidence score for mission orchestration recommendations.
 * Inputs: forecast confidence, pilot reliability, historical completion accuracy, weather stability.
 */

/**
 * Calculate AI confidence score for a mission orchestration recommendation.
 *
 * @param {Object} params
 * @param {number} params.forecastConfidence - 0-100 from mission_forecast_windows
 * @param {number} params.pilotReliabilityScore - 0-100 from pilot_performance
 * @param {number} params.historicalCompletionRate - 0-100 average completion rate
 * @param {number} params.weatherStabilityScore - 0-100 weather score
 * @param {number} params.forecastWindowDays - number of consecutive flyable days
 * @param {number} params.estimatedMissionDays - estimated mission duration
 * @returns {number} aiConfidence 0-100
 */
export function calculateAIConfidence({
    forecastConfidence = 50,
    pilotReliabilityScore = 50,
    historicalCompletionRate = 70,
    weatherStabilityScore = 50,
    forecastWindowDays = 0,
    estimatedMissionDays = 0,
}) {
    // Normalize all inputs to 0-100
    const fc = Math.min(100, Math.max(0, parseFloat(forecastConfidence) || 50));
    const pr = Math.min(100, Math.max(0, parseFloat(pilotReliabilityScore) || 50));
    const hc = Math.min(100, Math.max(0, parseFloat(historicalCompletionRate) || 70));
    const ws = Math.min(100, Math.max(0, parseFloat(weatherStabilityScore) || 50));

    // Window adequacy factor: 100 if window >= 2x mission days, scales down
    const windowAdequacy = estimatedMissionDays > 0
        ? Math.min(100, (forecastWindowDays / Math.max(1, estimatedMissionDays)) * 60)
        : 60;

    // Weighted formula
    const score =
        (fc * 0.35) +        // Forecast confidence is primary signal
        (pr * 0.25) +        // Pilot reliability
        (hc * 0.20) +        // Historical completion rate
        (ws * 0.10) +        // Weather stability
        (windowAdequacy * 0.10); // Forecast window adequacy

    // Apply a penalty if any individual input is critically low
    const criticalLow = Math.min(fc, pr, ws);
    const penalty = criticalLow < 30 ? (30 - criticalLow) * 0.3 : 0;

    return Math.round(Math.min(100, Math.max(0, score - penalty)));
}

/**
 * Classify confidence tier.
 * @param {number} score - 0-100
 * @returns {{ tier: string, label: string, color: string }}
 */
export function classifyConfidence(score) {
    if (score >= 85) return { tier: 'HIGH', label: 'High Confidence', color: '#22c55e' };
    if (score >= 65) return { tier: 'MEDIUM', label: 'Moderate Confidence', color: '#f59e0b' };
    if (score >= 45) return { tier: 'LOW', label: 'Low Confidence', color: '#f97316' };
    return { tier: 'VERY_LOW', label: 'Very Low Confidence', color: '#ef4444' };
}
