/**
 * blockFaultAggregator.js
 * Phase 5 – Block Fault Aggregation Service
 *
 * Aggregates thermal fault statistics per solar block.
 * READ-ONLY — never mutates data.
 */
import { query } from '../config/database.js';

/**
 * Aggregate fault statistics for a single block.
 * @param {string} blockId
 * @returns {Promise<Object>}
 */
export async function aggregateFaultsForBlock(blockId) {
    const result = await query(
        `SELECT
            COUNT(*)                                                      AS fault_count,
            COUNT(*) FILTER (WHERE severity = 'critical')                AS critical_faults,
            COUNT(*) FILTER (WHERE severity = 'moderate')                AS moderate_faults,
            COUNT(*) FILTER (WHERE severity = 'low')                     AS low_faults,
            AVG(temperature_delta)                                        AS avg_temp_delta,
            MAX(temperature_delta)                                        AS max_temp_delta,
            MODE() WITHIN GROUP (ORDER BY fault_type)                    AS dominant_fault_type
         FROM thermal_faults
         WHERE block_id = $1`,
        [blockId]
    );

    const row = result.rows[0];
    const faultCount = parseInt(row.fault_count) || 0;

    // Get block acreage for density calculation
    const blockRes = await query(`SELECT acreage FROM solar_blocks WHERE id = $1`, [blockId]);
    const acreage = parseFloat(blockRes.rows[0]?.acreage) || 1;

    const faultDensity = acreage > 0
        ? Math.round((faultCount / acreage) * 100) / 100
        : 0;

    return {
        blockId,
        faultCount,
        criticalFaults: parseInt(row.critical_faults) || 0,
        moderateFaults: parseInt(row.moderate_faults) || 0,
        lowFaults: parseInt(row.low_faults) || 0,
        avgTempDelta: Math.round((parseFloat(row.avg_temp_delta) || 0) * 100) / 100,
        maxTempDelta: Math.round((parseFloat(row.max_temp_delta) || 0) * 100) / 100,
        dominantFaultType: row.dominant_fault_type || 'normal',
        faultDensity,
        acreage,
    };
}

/**
 * Aggregate fault statistics for an entire deployment.
 * @param {string} deploymentId
 * @returns {Promise<Object>}
 */
export async function aggregateFaultsForDeployment(deploymentId) {
    const result = await query(
        `SELECT
            COUNT(*)                                                      AS total_faults,
            COUNT(*) FILTER (WHERE severity = 'critical')                AS critical_faults,
            COUNT(*) FILTER (WHERE severity = 'moderate')                AS moderate_faults,
            COUNT(*) FILTER (WHERE severity = 'low')                     AS low_faults,
            AVG(temperature_delta)                                        AS avg_temp_delta,
            MAX(temperature_delta)                                        AS max_temp_delta,
            COUNT(DISTINCT block_id)                                      AS blocks_with_faults
         FROM thermal_faults
         WHERE deployment_id = $1`,
        [deploymentId]
    );

    // Per-block breakdown
    const blockBreakdown = await query(
        `SELECT
            tf.block_id,
            sb.block_name,
            sb.block_number,
            COUNT(*)                                                      AS fault_count,
            COUNT(*) FILTER (WHERE tf.severity = 'critical')             AS critical_faults,
            MAX(tf.temperature_delta)                                     AS max_temp_delta
         FROM thermal_faults tf
         LEFT JOIN solar_blocks sb ON sb.id = tf.block_id
         WHERE tf.deployment_id = $1
         GROUP BY tf.block_id, sb.block_name, sb.block_number
         ORDER BY COUNT(*) FILTER (WHERE tf.severity = 'critical') DESC, COUNT(*) DESC`,
        [deploymentId]
    );

    const row = result.rows[0];
    return {
        deploymentId,
        totalFaults: parseInt(row.total_faults) || 0,
        criticalFaults: parseInt(row.critical_faults) || 0,
        moderateFaults: parseInt(row.moderate_faults) || 0,
        lowFaults: parseInt(row.low_faults) || 0,
        avgTempDelta: Math.round((parseFloat(row.avg_temp_delta) || 0) * 100) / 100,
        maxTempDelta: Math.round((parseFloat(row.max_temp_delta) || 0) * 100) / 100,
        blocksWithFaults: parseInt(row.blocks_with_faults) || 0,
        blockBreakdown: blockBreakdown.rows.map(b => ({
            blockId: b.block_id,
            blockName: b.block_name || `Block ${b.block_number}`,
            faultCount: parseInt(b.fault_count) || 0,
            criticalFaults: parseInt(b.critical_faults) || 0,
            maxTempDelta: parseFloat(b.max_temp_delta) || 0,
        })),
    };
}

/**
 * Get recent faults for a deployment (last 50), client-safe version.
 * Strips AI confidence and internal scores.
 */
export async function getClientSafeFaults(deploymentId) {
    const result = await query(
        `SELECT id, block_id, latitude, longitude, fault_type, severity,
                temperature_delta, detected_at
         FROM thermal_faults
         WHERE deployment_id = $1 AND severity != 'normal'
         ORDER BY detected_at DESC LIMIT 50`,
        [deploymentId]
    );
    return result.rows;
}
