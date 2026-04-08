/**
 * forecastScheduler.js
 * Phase 7 – Automated Forecast Scheduler
 * Phase 5 (Enterprise) – Scheduler Resilience: startup catch-up if last run is stale.
 * Phase 5 (Orchestrator) – Auto-orchestration at 02:30 AM after forecast run.
 */
import cron from 'node-cron';
import { query } from '../config/database.js';
import { generateForecast } from './missionForecaster.js';
// Phase 5: Import orchestrator — runs 30 min after nightly forecast generation
import { orchestrateAllActiveMissions } from './missionOrchestrator.js';

let schedulerStarted = false;

/**
 * Update last_forecast_run timestamp in system_settings.
 */
async function updateLastForecastRun() {
    try {
        await query(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES ('last_forecast_run', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [new Date().toISOString()]
        );
    } catch (e) {
        console.warn('[forecastScheduler] Failed to update last_forecast_run:', e.message);
    }
}

/**
 * Check if the last forecast run was today — if not, we need to catch up.
 */
async function isRunStaleToday() {
    try {
        const result = await query(
            `SELECT value FROM system_settings WHERE key = 'last_forecast_run'`
        );
        const lastRun = result.rows[0]?.value;
        if (!lastRun) return true;

        const lastRunDate = new Date(lastRun).toDateString();
        const todayDate = new Date().toDateString();
        return lastRunDate !== todayDate;
    } catch (e) {
        console.warn('[forecastScheduler] Could not read last_forecast_run:', e.message);
        return false;
    }
}

/**
 * Run forecast generation for all active missions with coordinates.
 */
export async function runForecastForAllActiveMissions() {
    console.log('[forecastScheduler] Starting forecast run...');
    let processed = 0, skipped = 0, errors = 0;

    try {
        const result = await query(
            `SELECT id, title, latitude, longitude
             FROM deployments
             WHERE status IN ('active', 'in_progress', 'scheduled', 'Active', 'Scheduled')
             AND latitude IS NOT NULL AND longitude IS NOT NULL
             ORDER BY created_at DESC`
        );

        const missions = result.rows;
        console.log(`[forecastScheduler] Found ${missions.length} active missions with coordinates.`);

        for (const mission of missions) {
            try {
                await generateForecast(mission.id);
                processed++;
                console.log(`[forecastScheduler] ✅ ${mission.title} (${mission.id})`);
            } catch (err) {
                errors++;
                console.warn(`[forecastScheduler] ⚠️  Failed for ${mission.id}: ${err.message}`);
            }
        }

        const missingRes = await query(
            `SELECT COUNT(*) as cnt FROM deployments
             WHERE status IN ('active', 'in_progress', 'scheduled', 'Active', 'Scheduled')
             AND (latitude IS NULL OR longitude IS NULL)`
        );
        skipped = parseInt(missingRes.rows[0].cnt) || 0;

        await updateLastForecastRun();
    } catch (err) {
        console.error('[forecastScheduler] Fatal error during run:', err.message);
    }

    console.log(`[forecastScheduler] Run complete. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
    return { processed, skipped, errors };
}

/**
 * Phase 5 (Orchestrator): Run orchestration after forecast generation.
 * Non-blocking — errors are swallowed to protect scheduler stability.
 */
async function runOrchestratorAfterForecast() {
    try {
        console.log('[forecastScheduler] 🤖 Starting post-forecast orchestration...');
        const result = await orchestrateAllActiveMissions();
        console.log(`[forecastScheduler] 🤖 Orchestration complete: ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors`);
    } catch (err) {
        console.warn('[forecastScheduler] Orchestration run failed (non-fatal):', err.message);
    }
}

/**
 * Start the forecast + orchestration schedulers.
 * Safe to call multiple times — only registers once.
 */
export async function startForecastScheduler() {
    if (schedulerStarted) {
        console.log('[forecastScheduler] Already running.');
        return;
    }

    // Startup catch-up: run if we missed today's forecast window
    const stale = await isRunStaleToday();
    if (stale) {
        console.log('[forecastScheduler] 📋 Last run was not today — running startup catch-up...');
        setImmediate(async () => {
            await runForecastForAllActiveMissions();
            await runOrchestratorAfterForecast();
        });
    } else {
        console.log('[forecastScheduler] ✅ Forecast already ran today.');
    }

    // 02:00 AM ET — Nightly forecast generation
    cron.schedule('0 2 * * *', async () => {
        console.log('[forecastScheduler] 🕐 02:00 AM trigger fired');
        await runForecastForAllActiveMissions();
    }, { scheduled: true, timezone: 'America/New_York' });

    // 02:30 AM ET — Mission orchestration (runs after forecast is fresh)
    cron.schedule('30 2 * * *', async () => {
        console.log('[forecastScheduler] 🤖 02:30 AM orchestration trigger fired');
        await runOrchestratorAfterForecast();
    }, { scheduled: true, timezone: 'America/New_York' });

    schedulerStarted = true;
    console.log('[forecastScheduler] ✅ Schedulers started: forecast @ 02:00 AM, orchestration @ 02:30 AM ET');
}
