/**
 * energyLossEstimator.js
 * Phase 2 + Phase 3 – Energy Loss Model + Severity Factors
 * Phase 4 – Auto energy calculation on fault insert
 *
 * Estimates kW, kWh, and revenue loss from thermal faults.
 * All assumptions are configurable via the DEFAULTS object.
 * Non-destructive — never modifies existing services.
 */
import { query } from '../config/database.js';

// ── Phase 3: Configurable severity factors ────────────────────────────────────
// Fraction of panel wattage lost per fault type (0.0 – 1.0)
export const SEVERITY_FACTORS = {
    hot_cell: 0.30,
    bypass_diode_failure: 0.45,
    string_outage: 1.00,
    connector_overheating: 0.25,
    panel_mismatch: 0.20,
    shading_anomaly: 0.15,
    minor_thermal_deviation: 0.05,
    normal: 0.00,
    // Generic severity fallbacks
    critical: 0.60,
    moderate: 0.30,
    low: 0.10,
};

// ── Phase 2: Configurable base assumptions ────────────────────────────────────
export const DEFAULTS = {
    panel_rating_watts: 550,    // W — standard bifacial panel
    avg_daily_irradiance: 5.5,    // peak sun hours
    electricity_rate_usd: 0.07,   // USD/kWh (utility purchase rate)
    panels_per_acre: 156,    // approximate utility-scale density
};

/**
 * Calculate energy and revenue loss for a single fault.
 * @param {{ fault_type, severity, temperature_delta }} fault
 * @param {Object} [config] - override DEFAULTS
 * @returns {Object} loss estimates
 */
export function calculateSingleFaultLoss(fault, config = {}) {
    const {
        panel_rating_watts = DEFAULTS.panel_rating_watts,
        avg_daily_irradiance = DEFAULTS.avg_daily_irradiance,
        electricity_rate_usd = DEFAULTS.electricity_rate_usd,
    } = config;

    // Phase 3: Severity factor — fault_type takes priority, then severity bucket
    let factor = SEVERITY_FACTORS[fault.fault_type]
        ?? SEVERITY_FACTORS[fault.severity]
        ?? 0.10;

    // ΔT boost: high temperature delta increases effective loss slightly
    const delta = parseFloat(fault.temperature_delta) || 0;
    if (delta > 20) factor = Math.min(1.0, factor * 1.15);
    else if (delta > 15) factor = Math.min(1.0, factor * 1.08);

    // kW lost per affected panel
    const kw_loss = (panel_rating_watts / 1000) * factor;

    // Daily and annual kWh loss
    const kwh_loss_daily = kw_loss * avg_daily_irradiance;
    const kwh_loss_annual = kwh_loss_daily * 365;

    // Revenue loss
    const revenue_loss_daily = kwh_loss_daily * electricity_rate_usd;
    const revenue_loss_annual = kwh_loss_annual * electricity_rate_usd;

    return {
        severity_factor: Math.round(factor * 100) / 100,
        estimated_kw_loss: Math.round(kw_loss * 10000) / 10000,
        estimated_kwh_loss_daily: Math.round(kwh_loss_daily * 10000) / 10000,
        estimated_kwh_loss_annual: Math.round(kwh_loss_annual * 10000) / 10000,
        estimated_revenue_loss_daily: Math.round(revenue_loss_daily * 100) / 100,
        estimated_revenue_loss_annual: Math.round(revenue_loss_annual * 100) / 100,
    };
}

/**
 * Phase 4: Calculate and persist energy loss for a fault record.
 * Called automatically when a thermal fault is created.
 * Graceful — errors are logged but do not bubble up.
 *
 * @param {Object} fault - thermal_faults row
 * @param {Object} [config] - optional configuration overrides
 */
export async function calculateAndPersistLoss(fault, config = {}) {
    try {
        if (!fault?.id) return;

        // Skip if already calculated
        const existing = await query(
            `SELECT id FROM fault_energy_loss WHERE fault_id = $1 LIMIT 1`,
            [fault.id]
        );
        if (existing.rows.length > 0) return; // idempotent

        const loss = calculateSingleFaultLoss(fault, config);

        await query(
            `INSERT INTO fault_energy_loss
                (fault_id, deployment_id, block_id,
                 estimated_kw_loss, estimated_kwh_loss_daily, estimated_kwh_loss_annual,
                 estimated_revenue_loss_daily, estimated_revenue_loss_annual)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT DO NOTHING`,
            [
                fault.id,
                fault.deployment_id || null,
                fault.block_id || null,
                loss.estimated_kw_loss,
                loss.estimated_kwh_loss_daily,
                loss.estimated_kwh_loss_annual,
                loss.estimated_revenue_loss_daily,
                loss.estimated_revenue_loss_annual,
            ]
        );

        console.log(`[energyLossEstimator] Loss calculated for fault ${fault.id}: ${loss.estimated_revenue_loss_annual} USD/yr`);
    } catch (err) {
        console.warn('[energyLossEstimator] Failed to persist energy loss (non-fatal):', err.message);
    }
}

/**
 * Recalculate energy loss for all faults in a deployment.
 * Useful for admin-triggered recalculation after rate updates.
 * @param {string} deploymentId
 * @param {Object} [config]
 */
export async function recalculateDeploymentLoss(deploymentId, config = {}) {
    const faults = await query(
        `SELECT * FROM thermal_faults WHERE deployment_id = $1`,
        [deploymentId]
    );
    let processed = 0;
    for (const fault of faults.rows) {
        // Delete old record first so idempotency check won't skip it
        await query(`DELETE FROM fault_energy_loss WHERE fault_id = $1`, [fault.id]);
        await calculateAndPersistLoss(fault, config);
        processed++;
    }
    return { processed };
}
