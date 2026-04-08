import { query } from '../config/database.js';

/**
 * Axis AI Pilot Insights Service
 * Generates performance insights from daily_logs and deployment data.
 */

export const generatePilotInsights = async (pilotId, userId) => {
    try {
        // Fetch actual pilot activity from daily_logs
        const activityRes = await query(`
            SELECT 
                p.full_name,
                p.daily_pay_rate,
                COUNT(dl.id) as total_days,
                COUNT(DISTINCT dl.deployment_id) as total_missions,
                COALESCE(SUM(dl.daily_pay), 0) as total_pay,
                COALESCE(SUM(dl.bonus_pay), 0) as total_bonus,
                COALESCE(AVG(dl.daily_pay), 0) as avg_daily_pay,
                COUNT(dl.id) FILTER (WHERE dl.date >= NOW() - INTERVAL '30 days') as recent_days,
                COUNT(DISTINCT dl.deployment_id) FILTER (WHERE dl.date >= NOW() - INTERVAL '30 days') as recent_missions
            FROM personnel p
            LEFT JOIN daily_logs dl ON dl.technician_id = p.id
            WHERE p.id = $1
            GROUP BY p.id, p.full_name, p.daily_pay_rate
        `, [pilotId]);

        if (activityRes.rows.length === 0) {
            return ['No pilot record found.'];
        }

        const stats = activityRes.rows[0];
        const totalDays = parseInt(stats.total_days) || 0;
        const totalMissions = parseInt(stats.total_missions) || 0;
        const totalBonus = parseFloat(stats.total_bonus) || 0;
        const totalPay = parseFloat(stats.total_pay) || 0;
        const recentDays = parseInt(stats.recent_days) || 0;
        const recentMissions = parseInt(stats.recent_missions) || 0;
        const bonusRate = totalPay > 0 ? (totalBonus / totalPay) * 100 : 0;

        // Fetch expired documents
        const docsRes = await query(`
            SELECT COUNT(*) as expired
            FROM pilot_documents
            WHERE personnel_id = $1 AND expiration_date < NOW()
        `, [pilotId]);
        const expiredDocs = parseInt(docsRes.rows[0]?.expired) || 0;

        // Try to use Gemini AI for enhanced insights
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
            if (apiKey) {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const prompt = `You are an aviation operations AI analyst. Generate 3-5 concise performance insights for a drone pilot/technician based on the following data:

Pilot: ${stats.full_name}
Total Mission Days: ${totalDays}
Total Missions: ${totalMissions}
Recent Activity (30 days): ${recentDays} days, ${recentMissions} missions
Total Earnings: $${totalPay.toFixed(2)}
Total Bonus Pay: $${totalBonus.toFixed(2)} (${bonusRate.toFixed(1)}% bonus rate)
Expired Documents: ${expiredDocs}

Return only a JSON array of insight strings (no markdown, no explanation), e.g.:
["Insight 1", "Insight 2", "Insight 3"]`;

                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();

                // Extract JSON array from response
                const match = text.match(/\[[\s\S]*\]/);
                if (match) {
                    const parsed = JSON.parse(match[0]);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            }
        } catch (aiErr) {
            // Fall through to rule-based insights
        }

        // Rule-based fallback insights
        const insights = [];

        if (totalMissions === 0) {
            insights.push('No mission history on record. Assign this pilot to a deployment to begin tracking performance.');
            return insights;
        }

        // Activity insights
        if (recentMissions > 0) {
            insights.push(`Active in the last 30 days: ${recentDays} days worked across ${recentMissions} mission(s). Maintaining consistent deployment cadence.`);
        } else {
            insights.push(`No activity in the last 30 days. Consider reaching out to confirm availability for upcoming deployments.`);
        }

        // Bonus performance
        if (bonusRate > 15) {
            insights.push(`Exceptional performance — ${bonusRate.toFixed(0)}% bonus rate on total pay, well above the baseline. Recommend prioritizing for high-value missions.`);
        } else if (bonusRate > 5) {
            insights.push(`Above-average performance with a ${bonusRate.toFixed(0)}% bonus rate. Consistently meets or exceeds mission requirements.`);
        } else if (totalDays > 0) {
            insights.push(`Steady performer with ${totalDays} total days logged. Bonus activity is low — consider reviewing mission performance targets to incentivize higher output.`);
        }

        // Mission volume
        if (totalMissions >= 10) {
            insights.push(`Veteran operator with ${totalMissions} missions completed. High experience level supports deployment on complex or remote site projects.`);
        } else if (totalMissions >= 3) {
            insights.push(`Building experience with ${totalMissions} missions. Continue to assign varied mission types to develop the full skill profile.`);
        }

        // Document compliance
        if (expiredDocs > 0) {
            insights.push(`⚠ ${expiredDocs} expired document(s) on file (e.g. insurance, certification). Requires renewal before the next assignment to maintain compliance.`);
        } else {
            insights.push('Documentation fully compliant. All certificates and required documents are current.');
        }

        return insights.slice(0, 5);
    } catch (error) {
        console.error('Failed to generate pilot insights:', error);
        return ['Performance insights temporarily unavailable. Please try again later.'];
    }
};
