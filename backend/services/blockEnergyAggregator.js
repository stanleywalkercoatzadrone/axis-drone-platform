/**
 * blockEnergyAggregator.js
 * Phase 5 – Per-block energy loss aggregation
 *
 * Sums all fault energy losses for a solar block.
 * READ-ONLY. Does not mutate data.
 */
import { query } from '../config/database.js';

/**
 * Aggregate energy loss for a single block.
 * @param {string} blockId
 * @returns {Promise<Object>}
 */
export async function getBlockEnergyLoss(blockId) {
    const result = await query(
        `SELECT
            SUM(el.estimated_kw_loss)             AS total_kw_loss,
            SUM(el.estimated_kwh_loss_daily)       AS daily_kwh_loss,
            SUM(el.estimated_kwh_loss_annual)      AS annual_kwh_loss,
            SUM(el.estimated_revenue_loss_daily)   AS daily_revenue_loss,
            SUM(el.estimated_revenue_loss_annual)  AS annual_revenue_loss,
            COUNT(el.id)                           AS fault_count,
            MAX(el.calculated_at)                  AS last_calculated
         FROM fault_energy_loss el
         WHERE el.block_id = $1
           AND (el.manual_override IS FALSE OR el.manual_override IS NULL)`,
        [blockId]
    );

    // Also get manually overridden values and sum them in
    const overrides = await query(
        `SELECT
            SUM(el.estimated_kw_loss)             AS total_kw_loss,
            SUM(el.estimated_kwh_loss_daily)       AS daily_kwh_loss,
            SUM(el.estimated_kwh_loss_annual)      AS annual_kwh_loss,
            SUM(el.estimated_revenue_loss_daily)   AS daily_revenue_loss,
            SUM(el.estimated_revenue_loss_annual)  AS annual_revenue_loss
         FROM fault_energy_loss el
         WHERE el.block_id = $1
           AND el.manual_override = TRUE`,
        [blockId]
    );

    const r = result.rows[0];
    const o = overrides.rows[0];

    const combine = (field) =>
        (parseFloat(r?.[field]) || 0) + (parseFloat(o?.[field]) || 0);

    return {
        blockId,
        faultCount: parseInt(r?.fault_count) || 0,
        blockKwLoss: Math.round(combine('total_kw_loss') * 10000) / 10000,
        dailyKwhLoss: Math.round(combine('daily_kwh_loss') * 100) / 100,
        annualKwhLoss: Math.round(combine('annual_kwh_loss') * 100) / 100,
        dailyRevenueLoss: Math.round(combine('daily_revenue_loss') * 100) / 100,
        annualRevenueLoss: Math.round(combine('annual_revenue_loss') * 100) / 100,
        lastCalculated: r?.last_calculated || null,
    };
}

/**
 * Get block-level energy losses for all blocks in a deployment.
 * @param {string} deploymentId
 * @returns {Promise<Array>}
 */
export async function getAllBlocksEnergyLoss(deploymentId) {
    const result = await query(
        `SELECT
            sb.id              AS block_id,
            sb.block_name,
            sb.block_number,
            sb.acreage,
            COUNT(el.id)                                                      AS fault_count,
            COALESCE(SUM(el.estimated_kw_loss),            0)                 AS block_kw_loss,
            COALESCE(SUM(el.estimated_kwh_loss_daily),     0)                 AS daily_kwh_loss,
            COALESCE(SUM(el.estimated_kwh_loss_annual),    0)                 AS annual_kwh_loss,
            COALESCE(SUM(el.estimated_revenue_loss_daily), 0)                 AS daily_revenue_loss,
            COALESCE(SUM(el.estimated_revenue_loss_annual),0)                 AS annual_revenue_loss
         FROM solar_blocks sb
         LEFT JOIN thermal_faults tf ON tf.block_id = sb.id
         LEFT JOIN fault_energy_loss el ON el.fault_id = tf.id
         WHERE sb.deployment_id = $1
         GROUP BY sb.id, sb.block_name, sb.block_number, sb.acreage
         ORDER BY SUM(el.estimated_revenue_loss_annual) DESC NULLS LAST`,
        [deploymentId]
    );

    return result.rows.map(r => ({
        blockId: r.block_id,
        blockName: r.block_name || `Block ${r.block_number}`,
        acreage: parseFloat(r.acreage) || 0,
        faultCount: parseInt(r.fault_count) || 0,
        blockKwLoss: Math.round(parseFloat(r.block_kw_loss) * 1000) / 1000,
        dailyKwhLoss: Math.round(parseFloat(r.daily_kwh_loss) * 100) / 100,
        annualKwhLoss: Math.round(parseFloat(r.annual_kwh_loss) * 100) / 100,
        dailyRevenueLoss: Math.round(parseFloat(r.daily_revenue_loss) * 100) / 100,
        annualRevenueLoss: Math.round(parseFloat(r.annual_revenue_loss) * 100) / 100,
    }));
}
