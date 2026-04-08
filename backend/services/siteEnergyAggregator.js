/**
 * siteEnergyAggregator.js
 * Phase 6 – Site-level energy loss aggregation
 *
 * Aggregates energy loss across an entire deployment (solar site).
 * Provides breakdown by block, fault type, and severity.
 * READ-ONLY.
 */
import { query } from '../config/database.js';

/**
 * Aggregate total energy loss for a full deployment.
 * @param {string} deploymentId
 * @returns {Promise<Object>}
 */
export async function getSiteEnergyLoss(deploymentId) {
    // Site totals
    const totalsRes = await query(
        `SELECT
            COALESCE(SUM(el.estimated_kw_loss),             0) AS site_kw_loss,
            COALESCE(SUM(el.estimated_kwh_loss_daily),      0) AS site_daily_kwh_loss,
            COALESCE(SUM(el.estimated_kwh_loss_annual),     0) AS site_annual_kwh_loss,
            COALESCE(SUM(el.estimated_revenue_loss_daily),  0) AS site_daily_revenue_loss,
            COALESCE(SUM(el.estimated_revenue_loss_annual), 0) AS site_annual_revenue_loss,
            COUNT(DISTINCT el.fault_id)                        AS total_faults,
            COUNT(DISTINCT el.block_id)                        AS blocks_with_loss
         FROM fault_energy_loss el
         WHERE el.deployment_id = $1`,
        [deploymentId]
    );

    // Breakdown by fault type
    const byTypeRes = await query(
        `SELECT
            tf.fault_type,
            COUNT(*)                                           AS fault_count,
            SUM(el.estimated_revenue_loss_annual)              AS annual_revenue_loss
         FROM fault_energy_loss el
         JOIN thermal_faults tf ON tf.id = el.fault_id
         WHERE el.deployment_id = $1
         GROUP BY tf.fault_type
         ORDER BY SUM(el.estimated_revenue_loss_annual) DESC`,
        [deploymentId]
    );

    // Breakdown by severity
    const bySevRes = await query(
        `SELECT
            tf.severity,
            COUNT(*)                                            AS fault_count,
            SUM(el.estimated_revenue_loss_annual)               AS annual_revenue_loss
         FROM fault_energy_loss el
         JOIN thermal_faults tf ON tf.id = el.fault_id
         WHERE el.deployment_id = $1
         GROUP BY tf.severity
         ORDER BY SUM(el.estimated_revenue_loss_annual) DESC`,
        [deploymentId]
    );

    const t = totalsRes.rows[0];

    return {
        deploymentId,
        siteKwLoss: Math.round(parseFloat(t.site_kw_loss) * 1000) / 1000,
        siteDailyKwhLoss: Math.round(parseFloat(t.site_daily_kwh_loss) * 100) / 100,
        siteAnnualKwhLoss: Math.round(parseFloat(t.site_annual_kwh_loss) * 100) / 100,
        siteDailyRevenueLoss: Math.round(parseFloat(t.site_daily_revenue_loss) * 100) / 100,
        siteAnnualRevenueLoss: Math.round(parseFloat(t.site_annual_revenue_loss) * 100) / 100,
        totalFaults: parseInt(t.total_faults) || 0,
        blocksWithLoss: parseInt(t.blocks_with_loss) || 0,
        byFaultType: byTypeRes.rows.map(r => ({
            faultType: r.fault_type,
            faultCount: parseInt(r.fault_count) || 0,
            annualRevenueLoss: Math.round(parseFloat(r.annual_revenue_loss) * 100) / 100,
        })),
        bySeverity: bySevRes.rows.map(r => ({
            severity: r.severity,
            faultCount: parseInt(r.fault_count) || 0,
            annualRevenueLoss: Math.round(parseFloat(r.annual_revenue_loss) * 100) / 100,
        })),
    };
}

/**
 * Client-safe version of site energy loss.
 * Strips fault type breakdown and internal details.
 */
export async function getClientSiteLoss(deploymentId) {
    const full = await getSiteEnergyLoss(deploymentId);
    // Phase 11: Return only aggregated financial data to clients
    return {
        deploymentId: full.deploymentId,
        siteDailyRevenueLoss: full.siteDailyRevenueLoss,
        siteAnnualRevenueLoss: full.siteAnnualRevenueLoss,
        siteDailyKwhLoss: full.siteDailyKwhLoss,
        siteAnnualKwhLoss: full.siteAnnualKwhLoss,
        totalFaults: full.totalFaults,
        blocksWithLoss: full.blocksWithLoss,
    };
}
