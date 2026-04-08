/**
 * faultPriorityEngine.js
 * Phase 11 – Fault Priority Scoring + Block Risk Score
 * Phase 12 – Updates solar_blocks.fault_risk_score
 *
 * Ranks faults by urgency. Updates block risk column.
 * Non-destructive: only updates fault_risk_score column on solar_blocks.
 */
import { query } from '../config/database.js';

const SEVERITY_WEIGHTS = { critical: 40, moderate: 20, low: 5, normal: 0 };
const MAX_DELTA = 30; // Normalize temperature delta against 30°C max

/**
 * Calculate a priority score (0-100) for a single fault.
 * @param {{ severity, temperature_delta, fault_type }} fault
 * @returns {number} priority score
 */
export function scoreFault(fault) {
    const severityWeight = SEVERITY_WEIGHTS[fault.severity] || 0;
    const deltaNorm = Math.min(1, (parseFloat(fault.temperature_delta) || 0) / MAX_DELTA);
    const deltaScore = deltaNorm * 40;

    // Type-based bonus for most dangerous faults
    const typeBonus = {
        string_outage: 20,
        bypass_diode_failure: 15,
        hot_cell: 15,
        connector_overheating: 10,
        panel_mismatch: 5,
        shading_anomaly: 3,
        minor_thermal_deviation: 1,
    }[fault.fault_type] || 0;

    return Math.min(100, Math.round(severityWeight + deltaScore + typeBonus));
}

/**
 * Calculate block risk score from aggregated fault data.
 * @param {{ criticalFaults, moderateFaults, lowFaults, faultDensity, maxTempDelta }} agg
 * @returns {number} risk score 0-100
 */
export function scoreBlockRisk(agg) {
    const criticalWeight = Math.min(40, (agg.criticalFaults || 0) * 8);
    const moderateWeight = Math.min(20, (agg.moderateFaults || 0) * 3);
    const lowWeight = Math.min(10, (agg.lowFaults || 0) * 1);
    const densityScore = Math.min(20, (agg.faultDensity || 0) * 10);
    const deltaScore = Math.min(10, ((agg.maxTempDelta || 0) / MAX_DELTA) * 10);

    return Math.min(100, Math.round(criticalWeight + moderateWeight + lowWeight + densityScore + deltaScore));
}

/**
 * Phase 12: Recalculate and persist fault_risk_score for all blocks in a deployment.
 * @param {string} deploymentId
 * @returns {Promise<{ updated: number }>}
 */
export async function updateBlockRiskScores(deploymentId) {
    // Get all blocks for the deployment
    const blocksRes = await query(
        `SELECT sb.id, sb.acreage,
                COUNT(tf.id)                                     AS fault_count,
                COUNT(tf.id) FILTER (WHERE tf.severity='critical') AS critical_faults,
                COUNT(tf.id) FILTER (WHERE tf.severity='moderate') AS moderate_faults,
                COUNT(tf.id) FILTER (WHERE tf.severity='low')      AS low_faults,
                MAX(tf.temperature_delta)                          AS max_temp_delta
         FROM solar_blocks sb
         LEFT JOIN thermal_faults tf ON tf.block_id = sb.id
         WHERE sb.deployment_id = $1
         GROUP BY sb.id, sb.acreage`,
        [deploymentId]
    );

    let updated = 0;
    for (const row of blocksRes.rows) {
        const acreage = parseFloat(row.acreage) || 1;
        const faultCount = parseInt(row.fault_count) || 0;
        const agg = {
            criticalFaults: parseInt(row.critical_faults) || 0,
            moderateFaults: parseInt(row.moderate_faults) || 0,
            lowFaults: parseInt(row.low_faults) || 0,
            faultDensity: acreage > 0 ? (faultCount / acreage) : 0,
            maxTempDelta: parseFloat(row.max_temp_delta) || 0,
        };
        const riskScore = scoreBlockRisk(agg);
        await query(
            `UPDATE solar_blocks SET fault_risk_score = $1, updated_at = NOW() WHERE id = $2`,
            [riskScore, row.id]
        );
        updated++;
    }

    return { updated };
}

/**
 * Get priority-ranked faults for a deployment.
 * @param {string} deploymentId
 * @param {number} [limit]
 * @returns {Promise<Array>}
 */
export async function getRankedFaults(deploymentId, limit = 50) {
    const result = await query(
        `SELECT tf.*,
                sb.block_name,
                sb.block_number
         FROM thermal_faults tf
         LEFT JOIN solar_blocks sb ON sb.id = tf.block_id
         WHERE tf.deployment_id = $1
         ORDER BY
             CASE tf.severity WHEN 'critical' THEN 1 WHEN 'moderate' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
             tf.temperature_delta DESC,
             tf.detected_at DESC
         LIMIT $2`,
        [deploymentId, limit]
    );

    return result.rows.map(f => ({
        ...f,
        priority_score: scoreFault(f),
    }));
}
