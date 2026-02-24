import { query } from '../config/database.js';
import { aiService } from './aiService.js';
import { logger } from './logger.js';

/**
 * Axis AI Pilot Insights Service
 * Generates pattern-based performance insights for pilots.
 */

/**
 * Generate insights for a pilot based on activity from the last 60 days.
 * @param {string} pilotId - UUID of the pilot
 * @param {string} userId - UUID of the user requesting the insights (for AI logging)
 * @returns {Promise<Array>} List of AI-generated insights
 */
export const generatePilotInsights = async (pilotId, userId) => {
    try {
        // Fetch last 60 days of activity
        const activityData = await fetchPilotActivityHistory(pilotId, 60);

        if (activityData.total_events === 0) {
            return ["No recent activity detected to generate insights."];
        }

        // Prepare context for AI
        const variables = {
            pilotName: activityData.pilot_name,
            totalJobs: activityData.total_events,
            completionRate: activityData.completion_rate,
            avgQaScore: activityData.avg_qa,
            acceptanceRate: activityData.acceptance_rate,
            historyJson: JSON.stringify(activityData.history)
        };

        // Call AI service to generate patterns
        // Note: 'pilot_performance_insights' prompt needs to be defined in ai_prompt_templates
        const aiResponse = await aiService.generateStructured(
            'pilot_performance_insights',
            variables,
            userId,
            `/api/v1/analyze/pilot/${pilotId}/insights`
        );

        return aiResponse.data.insights || [];
    } catch (error) {
        logger.error('Failed to generate pilot insights', { error: error.message, pilotId });
        return ["AI Insight engine temporarily unavailable."];
    }
};

/**
 * Internal helper to fetch history data.
 */
async function fetchPilotActivityHistory(pilotId, days) {
    const historyRes = await query(`
        SELECT 
            p.full_name,
            (SELECT COUNT(*) FROM job_completions WHERE pilot_id = $1 AND completed_at >= NOW() - INTERVAL '${days} days') as total_completions,
            (SELECT COUNT(*) FROM job_offers WHERE pilot_id = $1 AND offered_at >= NOW() - INTERVAL '${days} days') as total_offers,
            (SELECT AVG(qa_score) FROM qa_reviews WHERE pilot_id = $1 AND created_at >= NOW() - INTERVAL '${days} days') as avg_qa
        FROM personnel p
        WHERE p.id = $1
    `, [pilotId]);

    if (historyRes.rows.length === 0) return { total_events: 0 };

    const data = historyRes.rows[0];

    // Fetch a simplified timeline for AI reasoning
    const timelineRes = await query(`
        SELECT 'Job' as type, completed_at as date, on_time, cancelled
        FROM job_completions
        WHERE pilot_id = $1 AND completed_at >= NOW() - INTERVAL '${days} days'
        UNION ALL
        SELECT 'QA' as type, created_at as date, qa_score as score, rework_required as rework
        FROM qa_reviews
        WHERE pilot_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY date DESC
        LIMIT 50
    `, [pilotId]);

    return {
        pilot_name: data.full_name,
        total_events: parseInt(data.total_completions) + parseInt(data.total_offers),
        completion_rate: data.total_offers > 0 ? (data.total_completions / data.total_offers) * 100 : 0,
        avg_qa: data.avg_qa || 0,
        history: timelineRes.rows
    };
}
