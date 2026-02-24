import { query } from '../config/database.js';
import { calculateFinalAPIScore } from './scoringService.js';

/**
 * Axis AI Auto-Assignment Engine
 * Handles pilot selection based on performance, distance, and reliability.
 */

/**
 * Calculate distance between two GPS coordinates (Haversine formula).
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Get Assignment Fit Score for a pilot for a specific mission.
 * @param {Object} pilot - Pilot data from database
 * @param {Object} mission - Mission data (lat, lon, isPremium)
 * @returns {number} Fit Score (0-100)
 */
export const calculateAssignmentFitScore = async (pilot, mission) => {
    const { rolling_30_day_score, latitude, longitude, id } = pilot;
    const { mission_lat, mission_lng, is_premium } = mission;

    // 1. Rolling Score (60% weight)
    const rollingScore = rolling_30_day_score || 0;

    // 2. Distance Score (20% weight)
    let distanceScore = 0;
    if (latitude && longitude && mission_lat && mission_lng) {
        const distance = calculateDistance(latitude, longitude, mission_lat, mission_lng);
        // Score is 100 at 0 miles, 0 at 100 miles
        distanceScore = Math.max(0, 100 - (distance));
    }

    // 3. Recent Activity Bonus (20% weight)
    // Check if pilot has completed a job in the last 7 days (loyalty bonus)
    const activityRes = await query(`
        SELECT COUNT(*) as recent_jobs
        FROM job_completions
        WHERE pilot_id = $1 AND completed_at >= NOW() - INTERVAL '7 days'
    `, [id]);

    const recentActivityBonus = activityRes.rows[0].recent_jobs > 0 ? 100 : 0;

    let fitScore = (rollingScore * 0.6) + (distanceScore * 0.2) + (recentActivityBonus * 0.2);

    // Premium Client Adjustment: Weight QA score higher if premium
    if (is_premium) {
        const qaRes = await query(`
            SELECT AVG(qa_score) as avg_qa FROM qa_reviews WHERE pilot_id = $1
        `, [id]);
        const avgQa = qaRes.rows[0].avg_qa || 0;
        const qaBonus = (avgQa * 20); // 0-100
        fitScore = (fitScore * 0.7) + (qaBonus * 0.3);
    }

    return Math.round(fitScore);
};

/**
 * Find the best pilots for a job.
 * @param {Object} missionParams - { lat, lng, regionId, isPremium }
 * @param {number} limit - Number of candidates to return
 * @returns {Promise<Array>} List of best pilots with their Fit Scores
 */
export const findBestCandidates = async (missionParams, limit = 5) => {
    const { lat, lng, regionId, isPremium } = missionParams;

    // Step 1: Filter pilots
    // - region match (if applicable)
    // - status must be Active
    // - reliability_score >= 70 (rolling reliability)
    const eligiblePilotsRes = await query(`
        SELECT p.id, p.full_name, p.latitude, p.longitude, p.rolling_30_day_score, p.lifetime_score
        FROM personnel p
        WHERE p.status = 'Active'
          AND (p.role = 'Pilot' OR p.role = 'Both')
          AND p.reliability_flag = TRUE
          -- AND p.region_id = $1 (if region filtering enabled)
    `);

    const candidates = [];

    for (const pilot of eligiblePilotsRes.rows) {
        const distance = calculateDistance(pilot.latitude, pilot.longitude, lat, lng);

        // Step 3: Within radius (30 miles default)
        if (distance <= 30) {
            const fitScore = await calculateAssignmentFitScore(pilot, {
                mission_lat: lat,
                mission_lng: lng,
                is_premium: isPremium
            });
            candidates.push({
                ...pilot,
                distance: Math.round(distance * 10) / 10,
                fitScore
            });
        }
    }

    // Sort by Fit Score descending
    return candidates.sort((a, b) => b.fitScore - a.fitScore).slice(0, limit);
};
