import { query, transaction } from '../config/database.js';

/**
 * Axis Performance Index (API) Scoring Service
 * Computes scores from actual daily_logs and pilot_documents data.
 */

/**
 * Calculate individual metric scores for a pilot.
 * @param {string} pilotId - UUID of the pilot
 * @param {boolean} isRolling - Whether to calculate for the last 30 days only
 * @returns {Promise<Object>} Object containing individual scores
 */
export const calculateIndividualScores = async (pilotId, isRolling = false) => {
    const dateFilter = isRolling
        ? `AND dl.date >= NOW() - INTERVAL '30 days'`
        : '';

    // 1. Missions worked (days logged)
    const logsRes = await query(`
        SELECT
            COUNT(*) as total_days,
            COUNT(DISTINCT dl.deployment_id) as total_missions,
            SUM(dl.daily_pay) as total_pay,
            SUM(COALESCE(dl.bonus_pay, 0)) as total_bonus,
            AVG(COALESCE(dl.bonus_pay, 0)) as avg_bonus
        FROM daily_logs dl
        WHERE dl.technician_id = $1 ${dateFilter}
    `, [pilotId]);

    const logStats = logsRes.rows[0];
    const totalDays = parseInt(logStats.total_days) || 0;
    const totalMissions = parseInt(logStats.total_missions) || 0;

    // 2. Completion Score — ratio of days completed vs missions expected
    // Pilots with more missions score higher
    let completionScore = 100;
    if (totalMissions > 0) {
        // Reward consistent multi-day missions
        const avgDaysPerMission = totalDays / totalMissions;
        completionScore = Math.min(100, 60 + (avgDaysPerMission * 8));
    }

    // 3. Activity Score — regular work frequency indicates reliable pilot
    let acceptanceScore = 100;
    if (totalMissions === 0) {
        acceptanceScore = 50; // No missions on record
    } else if (totalMissions >= 5) {
        acceptanceScore = 100;
    } else {
        acceptanceScore = 60 + (totalMissions * 8);
    }

    // 4. QA/Quality Score — based on bonus pay (positive performance)
    // Pilots who receive bonus pay consistently perform above expectations
    const avgBonus = parseFloat(logStats.avg_bonus) || 0;
    const totalPay = parseFloat(logStats.total_pay) || 0;
    let qaScore = 75; // Base score
    if (totalDays > 0) {
        const bonusRate = parseFloat(logStats.total_bonus) / Math.max(1, totalPay);
        qaScore = Math.min(100, 75 + (bonusRate * 100));
    }

    // 5. Rating Score — based on document compliance (active, certified pilots score higher)
    const docsRes = await query(`
        SELECT 
            COUNT(*) as total_docs,
            COUNT(*) FILTER (WHERE expiration_date > NOW() OR expiration_date IS NULL) as valid_docs,
            COUNT(*) FILTER (WHERE expiration_date < NOW()) as expired_docs
        FROM pilot_documents
        WHERE personnel_id = $1
    `, [pilotId]);

    const docStats = docsRes.rows[0];
    const totalDocs = parseInt(docStats.total_docs) || 0;
    const expiredDocs = parseInt(docStats.expired_docs) || 0;
    let ratingScore = totalDocs > 0 ? 100 : 80; // Reward documented pilots
    ratingScore -= (expiredDocs * 10); // Penalize expired docs
    ratingScore = Math.max(0, Math.min(100, ratingScore));

    // 6. Reliability Score — based on expired documents
    let reliabilityScore = 100;
    reliabilityScore -= (expiredDocs * 15);
    reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

    return {
        acceptance: Math.round(acceptanceScore),
        completion: Math.round(completionScore),
        qa: Math.round(qaScore),
        rating: Math.round(ratingScore),
        reliability: Math.round(reliabilityScore)
    };
};

/**
 * Calculate the final API Score for a pilot using weighted metrics.
 */
export const calculateFinalAPIScore = async (pilotId, isRolling = false) => {
    const scores = await calculateIndividualScores(pilotId, isRolling);

    // Fetch dynamic weights from DB
    const res = await query('SELECT * FROM performance_config WHERE is_active = TRUE LIMIT 1');
    const config = res.rows[0] || {};

    const weights = {
        acceptance: config.acceptance_enabled !== false ? (config.acceptance_weight ?? 20) : 0,
        completion: config.completion_enabled !== false ? (config.completion_weight ?? 25) : 0,
        qa: config.qa_enabled !== false ? (config.qa_weight ?? 25) : 0,
        rating: config.rating_enabled !== false ? (config.rating_weight ?? 15) : 0,
        reliability: config.reliability_enabled !== false ? (config.reliability_weight ?? 15) : 0
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

/**
 * Determine the tier level based on the API score.
 */
export const getTierFromScore = (score) => {
    if (score >= 90) return 'Gold';
    if (score >= 80) return 'Silver';
    if (score >= 70) return 'Bronze';
    return 'At Risk';
};

/**
 * Refresh and persist pilot scores.
 */
export const refreshPilotPerformance = async (pilotId) => {
    const lifetimeScore = await calculateFinalAPIScore(pilotId, false);
    const rollingScore = await calculateFinalAPIScore(pilotId, true);
    const tierLevel = getTierFromScore(lifetimeScore);
    const scores = await calculateIndividualScores(pilotId, true);
    const reliabilityFlag = scores.reliability >= 70;

    await transaction(async (client) => {
        await client.query(`
            UPDATE personnel
            SET lifetime_score = $1,
                rolling_30_day_score = $2,
                tier_level = $3,
                reliability_flag = $4,
                updated_at = NOW()
            WHERE id = $5
        `, [lifetimeScore, rollingScore, tierLevel, reliabilityFlag, pilotId]);
    });

    return { lifetimeScore, rollingScore, tierLevel, reliabilityFlag };
};
