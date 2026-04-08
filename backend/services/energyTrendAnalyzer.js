/**
 * energyTrendAnalyzer.js
 * Phase 12 – Energy Loss Trend Analysis
 *
 * Tracks energy loss over time across inspection cycles.
 * Compares current losses against historical baselines.
 * READ-ONLY.
 */
import { query } from '../config/database.js';

/**
 * Analyze energy loss trend for a deployment.
 * Groups fault_energy_loss records by week to show trend.
 * @param {string} deploymentId
 * @param {number} [weeks=12] - lookback period
 * @returns {Promise<Object>}
 */
export async function analyzeEnergyTrend(deploymentId, weeks = 12) {
    // Weekly aggregation
    const weeklyRes = await query(
        `SELECT
            DATE_TRUNC('week', el.calculated_at)  AS week,
            COUNT(*)                               AS fault_count,
            SUM(el.estimated_kwh_loss_daily)       AS daily_kwh_loss,
            SUM(el.estimated_revenue_loss_daily)   AS daily_revenue_loss,
            SUM(el.estimated_revenue_loss_annual)  AS annual_revenue_loss
         FROM fault_energy_loss el
         WHERE el.deployment_id = $1
           AND el.calculated_at >= NOW() - INTERVAL '${weeks} weeks'
         GROUP BY DATE_TRUNC('week', el.calculated_at)
         ORDER BY week ASC`,
        [deploymentId]
    );

    const weekly = weeklyRes.rows.map(r => ({
        week: r.week,
        faultCount: parseInt(r.fault_count) || 0,
        dailyKwhLoss: parseFloat(r.daily_kwh_loss) || 0,
        dailyRevenueLoss: parseFloat(r.daily_revenue_loss) || 0,
        annualRevenueLoss: parseFloat(r.annual_revenue_loss) || 0,
    }));

    // Trend analysis: compare first half vs second half
    let trendMessage = 'Insufficient data for trend analysis';
    let trendDirection = 'stable';
    let changePercent = 0;

    if (weekly.length >= 4) {
        const mid = Math.floor(weekly.length / 2);
        const firstHalf = weekly.slice(0, mid);
        const secondHalf = weekly.slice(mid);

        const avgFirst = firstHalf.reduce((s, w) => s + w.annualRevenueLoss, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, w) => s + w.annualRevenueLoss, 0) / secondHalf.length;

        changePercent = avgFirst > 0
            ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100)
            : 0;

        if (changePercent > 10) {
            trendDirection = 'increasing';
            trendMessage = `Energy loss increased ${changePercent}% over the last ${weeks}-week period`;
        } else if (changePercent < -10) {
            trendDirection = 'decreasing';
            trendMessage = `Energy loss decreased ${Math.abs(changePercent)}% — repairs may be showing effect`;
        } else {
            trendDirection = 'stable';
            trendMessage = `Energy loss is stable (${changePercent > 0 ? '+' : ''}${changePercent}% change)`;
        }
    }

    // Cumulative loss calculation
    const totalCumulativeRevenueLoss = weekly.reduce((s, w) => s + w.annualRevenueLoss, 0);

    return {
        deploymentId,
        weeksAnalyzed: weeks,
        weekly,
        trendDirection,
        changePercent,
        trendMessage,
        totalCumulativeRevenueLoss: Math.round(totalCumulativeRevenueLoss * 100) / 100,
    };
}
