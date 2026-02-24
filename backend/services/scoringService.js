import { query, transaction } from '../config/database.js';

/**
 * Axis Performance Index (API) Scoring Service
 * Handles calculation and persistence of pilot performance scores.
 */

/**
 * Calculate individual metric scores for a pilot.
 * @param {string} pilotId - UUID of the pilot
 * @param {boolean} isRolling - Whether to calculate for the last 30 days only
 * @returns {Promise<Object>} Object containing individual scores
 */
export const calculateIndividualScores = async (pilotId, isRolling = false) => {
    const timeFilter = isRolling ? "AND (created_at >= NOW() - INTERVAL '30 days')" : "";

    // 1. Acceptance Score
    // Formula: (Accepted Jobs / Offered Jobs) * 100
    const acceptanceRes = await query(`
        SELECT 
            COUNT(*) as total_offered,
            COUNT(*) FILTER (WHERE accepted_at IS NOT NULL) as total_accepted
        FROM job_offers
        WHERE pilot_id = $1 ${timeFilter.replace('created_at', 'offered_at')}
    `, [pilotId]);

    const { total_offered, total_accepted } = acceptanceRes.rows[0];
    const acceptanceScore = total_offered > 0 ? (total_accepted / total_offered) * 100 : 100;

    // 2. Completion Score
    // Formula: (Completed Jobs / Accepted Jobs) * 100
    // Auto deduct 20 points if No Show or Late Cancellation
    const completionRes = await query(`
        SELECT 
            COUNT(*) as total_accepted,
            COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as total_completed,
            COUNT(*) FILTER (WHERE no_show = TRUE OR cancelled = TRUE) as total_penalties
        FROM job_completions
        WHERE pilot_id = $1 ${timeFilter.replace('created_at', 'completed_at')}
    `, [pilotId]);

    const { total_accepted: acceptedForComp, total_completed, total_penalties } = completionRes.rows[0];
    let completionScore = acceptedForComp > 0 ? (total_completed / acceptedForComp) * 100 : 100;

    if (total_penalties > 0) {
        completionScore = Math.max(0, completionScore - (total_penalties * 20));
    }

    // 3. QA Quality Score
    // Formula: (qa_score * 20) with deductions for rework and checklist completion
    const qaRes = await query(`
        SELECT 
            AVG(qa_score) as avg_qa,
            AVG(checklist_completion_percent) as avg_checklist,
            COUNT(*) FILTER (WHERE rework_required = TRUE) as rework_count
        FROM qa_reviews
        WHERE pilot_id = $1 ${timeFilter}
    `, [pilotId]);

    const { avg_qa, avg_checklist, rework_count } = qaRes.rows[0];
    let qaScore = avg_qa ? avg_qa * 20 : 100; // Default to 100 if no reviews

    // Apply rework deduction
    if (rework_count > 0) {
        qaScore = Math.max(0, qaScore - (rework_count * 5));
    }

    // Adjust by checklist completion (weighted average)
    if (avg_checklist !== null) {
        qaScore = (qaScore * 0.7) + (avg_checklist * 0.3);
    }

    // 4. Client Rating Score
    // Formula: average_rating * 20
    const ratingRes = await query(`
        SELECT AVG(rating) as avg_rating
        FROM client_reviews
        WHERE pilot_id = $1 ${timeFilter}
    `, [pilotId]);

    const { avg_rating } = ratingRes.rows[0];
    const ratingScore = avg_rating ? avg_rating * 20 : 100;

    // 5. Reliability Score
    // Formula: Start at 100, subtract penalties
    // Note: Some reliability factors might come from the personnel documents table (insurance, Part 107)
    const reliabilityRes = await query(`
        SELECT 
            COUNT(*) FILTER (WHERE no_show = TRUE) as no_show_count
        FROM job_completions
        WHERE pilot_id = $1 ${timeFilter.replace('created_at', 'completed_at')}
    `, [pilotId]);

    // Check document status for reliability
    const docsRes = await query(`
        SELECT category, expiration_date
        FROM pilot_documents
        WHERE personnel_id = $1 AND expiration_date < NOW()
    `, [pilotId]);

    let reliabilityScore = 100;
    reliabilityScore -= (reliabilityRes.rows[0].no_show_count * 25);

    docsRes.rows.forEach(doc => {
        if (doc.category === 'Insurance') reliabilityScore -= 15;
        if (doc.category === 'Certification') reliabilityScore -= 10; // Part 107
    });

    // Safety violation check (mocked for now, integration with audit logs possible)
    // reliabilityScore -= (safety_violations * 20);

    return {
        acceptance: Math.round(acceptanceScore),
        completion: Math.round(completionScore),
        qa: Math.round(qaScore),
        rating: Math.round(ratingScore),
        reliability: Math.max(0, Math.round(reliabilityScore))
    };
};

/**
 * Calculate the final API Score for a pilot using weighted metrics.
 * @param {string} pilotId - UUID of the pilot
 * @param {boolean} isRolling - Whether to calculate for the last 30 days only
 * @returns {Promise<number>} Final Axis Performance Index (API) Score (0-100)
 */
export const calculateFinalAPIScore = async (pilotId, isRolling = false) => {
    // Get enabled metrics and weights
    const configRes = await query('SELECT * FROM performance_config WHERE is_active = TRUE LIMIT 1');
    if (configRes.rows.length === 0) return 0;
    const config = configRes.rows[0];

    const scores = await calculateIndividualScores(pilotId, isRolling);

    let totalScore = 0;
    let totalWeight = 0;

    if (config.acceptance_enabled) {
        totalScore += (scores.acceptance * config.acceptance_weight);
        totalWeight += config.acceptance_weight;
    }
    if (config.completion_enabled) {
        totalScore += (scores.completion * config.completion_weight);
        totalWeight += config.completion_weight;
    }
    if (config.qa_enabled) {
        totalScore += (scores.qa * config.qa_weight);
        totalWeight += config.qa_weight;
    }
    if (config.rating_enabled) {
        totalScore += (scores.rating * config.rating_weight);
        totalWeight += config.rating_weight;
    }
    if (config.reliability_enabled) {
        totalScore += (scores.reliability * config.reliability_weight);
        totalWeight += config.reliability_weight;
    }

    // Normalized score (should naturally be /100 if weights sum to 100)
    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    return finalScore;
};

/**
 * Determine the tier level based on the API score.
 * @param {number} score - API Score
 * @returns {string} Gold, Silver, Bronze, or At Risk
 */
export const getTierFromScore = (score) => {
    if (score >= 90) return 'Gold';
    if (score >= 80) return 'Silver';
    if (score >= 70) return 'Bronze';
    return 'At Risk';
};

/**
 * Refresh and persist pilot scores.
 * @param {string} pilotId - UUID of the pilot
 */
export const refreshPilotPerformance = async (pilotId) => {
    const lifetimeScore = await calculateFinalAPIScore(pilotId, false);
    const rollingScore = await calculateFinalAPIScore(pilotId, true);
    const tierLevel = getTierFromScore(lifetimeScore);
    const reliabilityFlag = (await calculateIndividualScores(pilotId, true)).reliability >= 70;

    await transaction(async (client) => {
        // Update personnel table
        await client.query(`
            UPDATE personnel
            SET lifetime_score = $1,
                rolling_30_day_score = $2,
                tier_level = $3,
                reliability_flag = $4,
                updated_at = NOW()
            WHERE id = $5
        `, [lifetimeScore, rollingScore, tierLevel, reliabilityFlag, pilotId]);

        // Create snapshot
        await client.query(`
            INSERT INTO performance_snapshots (pilot_id, lifetime_score, rolling_score)
            VALUES ($1, $2, $3)
        `, [pilotId, lifetimeScore, rollingScore]);
    });

    return { lifetimeScore, rollingScore, tierLevel, reliabilityFlag };
};
