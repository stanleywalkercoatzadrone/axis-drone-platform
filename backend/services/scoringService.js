import { query, transaction } from '../config/database.js';

/**
 * Axis Performance Index (API) Scoring Service
 * Computes scores from actual daily_logs and mission_work_sessions data.
 *
 * ID mapping (confirmed from pilotMetricsController.js):
 *   - daily_logs.technician_id       → personnel.id
 *   - mission_work_sessions.pilot_id → personnel.id
 *   - pilot_documents: tries pilot_id first (live schema), then personnel_id
 */

export const calculateIndividualScores = async (personnelId, isRolling = false) => {
    const dlDateWindow = isRolling ? `AND dl.date >= NOW() - INTERVAL '30 days'` : '';
    const sessDateWindow = isRolling ? `AND mws.start_time >= NOW() - INTERVAL '30 days'` : '';

    // ── 1. Daily logs ─────────────────────────────────────────────────────────
    let totalDays = 0, totalMissions = 0, totalPay = 0, totalBonus = 0;
    try {
        const r = (await query(`
            SELECT
                COUNT(*) as total_days,
                COUNT(DISTINCT dl.deployment_id) as total_missions,
                COALESCE(SUM(dl.daily_pay), 0) as total_pay,
                COALESCE(SUM(dl.bonus_pay), 0) as total_bonus
            FROM daily_logs dl
            WHERE dl.technician_id = $1 ${dlDateWindow}
        `, [personnelId])).rows[0];
        totalDays = parseInt(r.total_days) || 0;
        totalMissions = parseInt(r.total_missions) || 0;
        totalPay = parseFloat(r.total_pay) || 0;
        totalBonus = parseFloat(r.total_bonus) || 0;
    } catch (_) { }

    // ── 2. Mission work sessions ───────────────────────────────────────────────
    let sessionMissions = 0, sessionsCompleted = 0, weatherStops = 0, avgCompletion = 0;
    try {
        const r = (await query(`
            SELECT
                COUNT(DISTINCT mws.mission_id) as session_missions,
                COUNT(*) FILTER (WHERE mws.status = 'completed') as sessions_completed,
                COUNT(*) FILTER (WHERE mws.weather_stop = true) as weather_stops,
                COALESCE(AVG(mws.completion_percent), 0) as avg_completion
            FROM mission_work_sessions mws
            WHERE mws.pilot_id = $1 ${sessDateWindow}
        `, [personnelId])).rows[0];
        sessionMissions = parseInt(r.session_missions) || 0;
        sessionsCompleted = parseInt(r.sessions_completed) || 0;
        weatherStops = parseInt(r.weather_stops) || 0;
        avgCompletion = parseFloat(r.avg_completion) || 0;
    } catch (_) { }

    // ── 3. Document compliance — try pilot_id first (live schema) ─────────────
    let totalDocs = 0, expiredDocs = 0;
    try {
        let docsRow;
        const docsQ = `
            SELECT
                COUNT(*) as total_docs,
                COUNT(*) FILTER (WHERE expiration_date < NOW()) as expired_docs
            FROM pilot_documents
            WHERE {COL} = $1
        `;
        try {
            docsRow = (await query(docsQ.replace('{COL}', 'pilot_id'), [personnelId])).rows[0];
        } catch (_) {
            docsRow = (await query(docsQ.replace('{COL}', 'personnel_id'), [personnelId])).rows[0];
        }
        totalDocs = parseInt(docsRow.total_docs) || 0;
        expiredDocs = parseInt(docsRow.expired_docs) || 0;
    } catch (_) { }

    // ── 4. Compute scores ──────────────────────────────────────────────────────
    const effectiveMissions = Math.max(totalMissions, sessionMissions);
    const hasActivity = effectiveMissions > 0 || totalDays > 0 || sessionsCompleted > 0;

    // Acceptance — activity level
    let acceptanceScore = 0;
    if (hasActivity) {
        if (effectiveMissions >= 10) acceptanceScore = 100;
        else if (effectiveMissions >= 5) acceptanceScore = 85;
        else if (effectiveMissions >= 1) acceptanceScore = 55 + (effectiveMissions * 6);
        else acceptanceScore = 40;
    }

    // Completion — daily log ratio first, then session completion %
    let completionScore = 0;
    if (hasActivity) {
        if (totalMissions > 0) {
            const avgDays = totalDays / totalMissions;
            completionScore = Math.min(100, 55 + (avgDays * 9));
        } else if (sessionsCompleted > 0) {
            completionScore = Math.min(100, Math.max(40, avgCompletion - (weatherStops * 5)));
        } else if (totalDays > 0) {
            completionScore = 50;
        }
    }

    // QA — bonus pay ratio, then session quality
    let qaScore = 0;
    if (hasActivity) {
        if (totalDays > 0 && totalPay > 0) {
            const bonusRate = totalBonus / Math.max(1, totalPay);
            qaScore = Math.min(100, 70 + (bonusRate * 100));
        } else if (sessionsCompleted > 0) {
            qaScore = Math.max(50, 70 - (weatherStops * 8) + Math.min(25, sessionsCompleted * 3));
        } else {
            qaScore = 50;
        }
    }

    // Rating — document compliance
    let ratingScore = 0;
    if (totalDocs > 0) {
        ratingScore = Math.max(0, 100 - (expiredDocs * 10));
    } else if (hasActivity) {
        ratingScore = 50; // active but no docs
    }

    // Reliability — penalize weather stops + expired docs
    let reliabilityScore = 0;
    if (hasActivity) {
        reliabilityScore = Math.max(0, Math.min(100,
            100 - (expiredDocs * 15) - (weatherStops * 8)
        ));
    }

    return {
        acceptance: Math.round(acceptanceScore),
        completion: Math.round(completionScore),
        qa: Math.round(qaScore),
        rating: Math.round(ratingScore),
        reliability: Math.round(reliabilityScore),
        hasActivity,
        totalMissions: effectiveMissions,
        sessionsCompleted,
    };
};

export const calculateFinalAPIScore = async (personnelId, isRolling = false) => {
    const scores = await calculateIndividualScores(personnelId, isRolling);

    let config = {};
    try {
        const res = await query('SELECT * FROM performance_config WHERE is_active = TRUE LIMIT 1');
        config = res.rows[0] || {};
    } catch (_) { }

    const weights = {
        acceptance: config.acceptance_enabled !== false ? (config.acceptance_weight ?? 20) : 0,
        completion: config.completion_enabled !== false ? (config.completion_weight ?? 25) : 0,
        qa: config.qa_enabled !== false ? (config.qa_weight ?? 25) : 0,
        rating: config.rating_enabled !== false ? (config.rating_weight ?? 15) : 0,
        reliability: config.reliability_enabled !== false ? (config.reliability_weight ?? 15) : 0,
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return 0;

    const totalScore = (
        scores.acceptance * weights.acceptance +
        scores.completion * weights.completion +
        scores.qa * weights.qa +
        scores.rating * weights.rating +
        scores.reliability * weights.reliability
    );

    return Math.round(totalScore / totalWeight);
};

export const getTierFromScore = (score) => {
    if (score >= 90) return 'Gold';
    if (score >= 80) return 'Silver';
    if (score >= 70) return 'Bronze';
    if (score >= 1) return 'Provisional';
    return 'Unranked';
};

export const refreshPilotPerformance = async (personnelId) => {
    const lifetimeScore = await calculateFinalAPIScore(personnelId, false);
    const rollingScore = await calculateFinalAPIScore(personnelId, true);
    const tierLevel = getTierFromScore(lifetimeScore);
    const scores = await calculateIndividualScores(personnelId, true);
    const reliabilityFlag = scores.reliability >= 70;

    await transaction(async (client) => {
        await client.query(`
            UPDATE personnel
            SET lifetime_score       = $1,
                rolling_30_day_score = $2,
                tier_level           = $3,
                reliability_flag     = $4,
                updated_at           = NOW()
            WHERE id = $5
        `, [lifetimeScore, rollingScore, tierLevel, reliabilityFlag, personnelId]);
    });

    return { lifetimeScore, rollingScore, tierLevel, reliabilityFlag };
};
