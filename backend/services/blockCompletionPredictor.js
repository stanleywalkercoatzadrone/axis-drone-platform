/**
 * blockCompletionPredictor.js
 * Phase 8 – Block Completion Predictor Service
 *
 * Predicts site completion date based on remaining blocks,
 * pilot productivity, and upcoming forecast weather windows.
 * READ-ONLY. Does not mutate data.
 */
import { query } from '../config/database.js';
import { analyzeDeploymentCoverage } from './blockCoverageAnalyzer.js';

const FLIGHT_HOURS_PER_DAY = 6;
const PILOT_ACRES_PER_HOUR = 10; // baseline

/**
 * Predict site completion for a deployment.
 * @param {string} deploymentId
 * @returns {Object} completion prediction
 */
export async function predictSiteCompletion(deploymentId) {
    // 1. Get current block coverage
    const coverage = await analyzeDeploymentCoverage(deploymentId);
    if (coverage.totalBlocks === 0) {
        return {
            deploymentId,
            noBlocks: true,
            message: 'No blocks defined — import blocks to enable prediction',
        };
    }

    // 2. Get best upcoming forecast window
    const forecastRes = await query(
        `SELECT forecast_start_date, forecast_end_date, consecutive_days,
                weather_score, forecast_confidence, confidence_score, recommended
         FROM mission_forecast_windows
         WHERE mission_id = $1
         ORDER BY COALESCE(forecast_confidence, 0) DESC, confidence_score DESC
         LIMIT 3`,
        [deploymentId]
    );
    const bestWindow = forecastRes.rows.find(r => r.recommended) || forecastRes.rows[0] || null;

    // 3. Get pilot productivity from pilot_performance if pilots assigned
    const pilotRes = await query(
        `SELECT COALESCE(AVG(pp.average_blocks_per_day), 1) as avg_productivity
         FROM deployment_personnel dp
         JOIN personnel p ON p.id = dp.personnel_id
         JOIN pilot_performance pp ON pp.pilot_id = p.user_id
         WHERE dp.deployment_id = $1`,
        [deploymentId]
    );
    const avgBlocksPerDay = parseFloat(pilotRes.rows[0]?.avg_productivity) || 1;

    // 4. Weather-adjusted productivity
    const weatherScore = parseFloat(bestWindow?.weather_score) || 70;
    const weatherFactor = Math.max(0.4, weatherScore / 100);
    const acresPerDay = PILOT_ACRES_PER_HOUR * FLIGHT_HOURS_PER_DAY * weatherFactor;

    // 5. Days remaining estimate
    const acresRemaining = coverage.acresRemaining || 0;
    const estimatedDaysRemaining = acresRemaining > 0
        ? Math.ceil(acresRemaining / acresPerDay * 10) / 10
        : 0;

    // 6. Predicted completion date
    let predictedCompletionDate = null;
    if (bestWindow?.forecast_start_date) {
        const startDate = new Date(bestWindow.forecast_start_date + 'T00:00:00');
        startDate.setDate(startDate.getDate() + Math.ceil(estimatedDaysRemaining));
        predictedCompletionDate = startDate.toISOString().split('T')[0];
    } else if (estimatedDaysRemaining > 0) {
        const today = new Date();
        today.setDate(today.getDate() + Math.ceil(estimatedDaysRemaining));
        predictedCompletionDate = today.toISOString().split('T')[0];
    }

    return {
        deploymentId,
        percentComplete: coverage.percentComplete,
        blocksRemaining: coverage.blocksPending + coverage.blocksInProgress,
        blocksCompleted: coverage.blocksCompleted,
        acresRemaining,
        acresPerDay: Math.round(acresPerDay * 100) / 100,
        estimatedDaysRemaining,
        predictedCompletionDate,
        forecastWindow: bestWindow ? {
            start: bestWindow.forecast_start_date,
            end: bestWindow.forecast_end_date,
            weatherScore,
            daysAvailable: parseInt(bestWindow.consecutive_days) || 0,
        } : null,
        confidence: bestWindow
            ? Math.round((parseFloat(bestWindow.forecast_confidence) || parseFloat(bestWindow.confidence_score) || 50))
            : 30,
    };
}
