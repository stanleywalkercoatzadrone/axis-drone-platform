/**
 * missionOrchestrator.js
 * Phase 3 – Mission Orchestrator Service
 *
 * Generates intelligent mission plans by combining:
 * - Forecast window data
 * - Pilot performance + reliability
 * - Priority scoring
 * - AI confidence model
 * - Conflict detection
 *
 * SAFETY GUARANTEED: Read-only recommendations. Admin approval always required.
 * Manual overrides always take priority.
 */
import { query } from '../config/database.js';
import { calculatePriorityScore } from './missionPriorityEngine.js';
import { calculateAIConfidence } from './aiConfidenceModel.js';
import { detectOrchestrationConflicts } from '../utils/orchestrationConflicts.js';

/**
 * Orchestrate a single mission — generate a recommended plan and write to DB.
 * @param {string} missionId
 * @returns {Object} orchestration result
 */
export async function orchestrateMission(missionId) {
    // 1. Load mission data
    const missionRes = await query(
        `SELECT d.id, d.title, d.status, d.site_name, d.site_id, d.industry_key,
                d.latitude, d.longitude, d.days_on_site, d.tenant_id,
                d.orchestration_enabled
         FROM deployments d
         WHERE d.id = $1`,
        [missionId]
    );
    if (missionRes.rows.length === 0) throw new Error(`Mission ${missionId} not found`);
    const mission = missionRes.rows[0];

    // Phase 12: Respect orchestration_enabled flag
    if (mission.orchestration_enabled === false) {
        return {
            missionId,
            skipped: true,
            reason: 'orchestration_enabled = false for this mission',
        };
    }

    // 2. Get best forecast window
    const windowsRes = await query(
        `SELECT id, forecast_start_date, forecast_end_date, consecutive_days,
                weather_score, confidence_score, forecast_confidence, recommended
         FROM mission_forecast_windows
         WHERE mission_id = $1
         ORDER BY COALESCE(forecast_confidence, 0) DESC, confidence_score DESC
         LIMIT 5`,
        [missionId]
    );
    const bestWindow = windowsRes.rows.find(w => w.recommended) || windowsRes.rows[0] || null;

    // 3. Get best available pilot by reliability score
    const pilotRes = await query(
        `SELECT pp.pilot_id, pp.reliability_score, pp.missions_completed,
                pp.average_blocks_per_day, pp.report_quality_score,
                u.full_name, u.email,
                COALESCE(
                    (SELECT AVG(mdp.completion_rate)
                     FROM mission_daily_performance mdp
                     INNER JOIN deployment_personnel dp ON dp.deployment_id = mdp.mission_id
                     INNER JOIN personnel p ON p.id = dp.personnel_id
                     WHERE p.user_id = pp.pilot_id),
                    70
                ) as historical_completion_rate
         FROM pilot_performance pp
         JOIN users u ON u.id = pp.pilot_id
         WHERE pp.reliability_score IS NOT NULL
         ORDER BY pp.reliability_score DESC
         LIMIT 1`
    );
    const bestPilot = pilotRes.rows[0] || null;

    // 4. Calculate priority score
    const priorityScore = calculatePriorityScore({
        forecastConfidence: parseFloat(bestWindow?.forecast_confidence) || parseFloat(bestWindow?.confidence_score) || 50,
        weatherScore: parseFloat(bestWindow?.weather_score) || 50,
        financialExposure: 0, // extend when field added
        clientPriority: 50,   // extend when field added
    });

    // 5. Calculate predicted completion days
    const estimatedDays = Math.max(1, mission.days_on_site || 7);

    // 6. Calculate AI confidence score (Phase 11)
    const aiConfidence = calculateAIConfidence({
        forecastConfidence: parseFloat(bestWindow?.forecast_confidence) || parseFloat(bestWindow?.confidence_score) || 50,
        pilotReliabilityScore: parseFloat(bestPilot?.reliability_score) || 50,
        historicalCompletionRate: parseFloat(bestPilot?.historical_completion_rate) || 70,
        weatherStabilityScore: parseFloat(bestWindow?.weather_score) || 50,
        forecastWindowDays: parseInt(bestWindow?.consecutive_days) || 0,
        estimatedMissionDays: estimatedDays,
    });

    // 7. Detect conflicts (Phase 9) — warnings only, never blocking
    const conflictResult = await detectOrchestrationConflicts({
        missionId,
        pilotId: bestPilot?.pilot_id || null,
        startDate: bestWindow?.forecast_start_date || null,
        endDate: bestWindow?.forecast_end_date || null,
        siteId: mission.site_id,
        weatherScore: parseFloat(bestWindow?.weather_score) || 50,
        forecastConfidence: parseFloat(bestWindow?.forecast_confidence) || parseFloat(bestWindow?.confidence_score) || 50,
        consecutiveDays: parseInt(bestWindow?.consecutive_days) || 0,
        estimatedDays,
    });

    // 8. Write recommendation to mission_orchestration table
    // Check if a non-approved suggestion already exists and upsert
    const existingRes = await query(
        `SELECT id, manual_override FROM mission_orchestration
         WHERE mission_id = $1 AND status = 'suggested'
         ORDER BY created_at DESC LIMIT 1`,
        [missionId]
    );

    let orchestrationId;
    if (existingRes.rows.length > 0 && !existingRes.rows[0].manual_override) {
        // Update existing suggestion
        const updateRes = await query(
            `UPDATE mission_orchestration SET
                recommended_start_date = $1,
                recommended_end_date = $2,
                recommended_pilot = $3,
                recommended_forecast_window = $4,
                predicted_completion_days = $5,
                ai_confidence = $6,
                priority_score = $7,
                updated_at = NOW()
             WHERE id = $8
             RETURNING id`,
            [
                bestWindow?.forecast_start_date || null,
                bestWindow?.forecast_end_date || null,
                bestPilot?.pilot_id || null,
                bestWindow?.id || null,
                estimatedDays,
                aiConfidence,
                priorityScore,
                existingRes.rows[0].id,
            ]
        );
        orchestrationId = updateRes.rows[0]?.id;
    } else {
        // Insert new suggestion
        const insertRes = await query(
            `INSERT INTO mission_orchestration
                (mission_id, recommended_start_date, recommended_end_date,
                 recommended_pilot, recommended_forecast_window,
                 predicted_completion_days, ai_confidence, priority_score, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'suggested')
             RETURNING id`,
            [
                missionId,
                bestWindow?.forecast_start_date || null,
                bestWindow?.forecast_end_date || null,
                bestPilot?.pilot_id || null,
                bestWindow?.id || null,
                estimatedDays,
                aiConfidence,
                priorityScore,
            ]
        );
        orchestrationId = insertRes.rows[0]?.id;
    }

    return {
        orchestrationId,
        missionId,
        missionTitle: mission.title,
        recommendedPilot: bestPilot ? {
            pilotId: bestPilot.pilot_id,
            fullName: bestPilot.full_name,
            reliabilityScore: parseFloat(bestPilot.reliability_score),
            avgBlocksPerDay: parseFloat(bestPilot.average_blocks_per_day) || null,
        } : null,
        startDate: bestWindow?.forecast_start_date || null,
        endDate: bestWindow?.forecast_end_date || null,
        predictedCompletionDays: estimatedDays,
        priorityScore,
        aiConfidence,
        conflicts: conflictResult,
        requiresAdminApproval: true, // Phase 13: Always required
    };
}

/**
 * Run orchestration for all active missions.
 * Called by the nightly scheduler (Phase 5).
 * @param {string} [tenantId] - optional tenant filter
 * @returns {Object} summary
 */
export async function orchestrateAllActiveMissions(tenantId) {
    console.log('[missionOrchestrator] Starting orchestration run...');
    let processed = 0, skipped = 0, errors = 0;

    const result = await query(
        `SELECT id, title, orchestration_enabled FROM deployments
         WHERE status IN ('Scheduled', 'Active', 'Delayed')
         AND latitude IS NOT NULL
         AND longitude IS NOT NULL
         ${tenantId ? 'AND (tenant_id = $1 OR tenant_id IS NULL)' : ''}
         ORDER BY created_at DESC`,
        tenantId ? [tenantId] : []
    );

    for (const mission of result.rows) {
        try {
            const res = await orchestrateMission(mission.id);
            if (res.skipped) { skipped++; }
            else { processed++; }
        } catch (err) {
            errors++;
            console.warn(`[missionOrchestrator] ⚠️  Failed for ${mission.id}: ${err.message}`);
        }
    }

    console.log(`[missionOrchestrator] Complete — Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
    return { processed, skipped, errors };
}
