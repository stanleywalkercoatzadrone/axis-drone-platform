import { aiService } from '../services/aiService.js';
import db from '../config/database.js';

/**
 * Generate AI Daily Operational Summary
 */
export const generateDailySummary = async (req, res) => {
    try {
        const { date, deploymentId } = req.query;
        const userId = req.user?.id;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required'
            });
        }

        // 1. Gather Daily Logs for the date
        let logsQuery = `
            SELECT l.*, p.full_name as pilot_name, p.role
            FROM daily_logs l
            JOIN personnel p ON l.technician_id = p.id
            WHERE l.date = $1
        `;
        const params = [date];

        if (deploymentId) {
            logsQuery += ' AND l.deployment_id = $2';
            params.push(deploymentId);
        }

        const logsResult = await db.query(logsQuery, params);
        const dailyLogs = logsResult.rows;

        // 2. Gather Mission Context
        let missionQuery = 'SELECT * FROM deployments WHERE date <= $1 AND status != \'Cancelled\'';
        const missionParams = [date];

        if (deploymentId) {
            missionQuery = 'SELECT * FROM deployments WHERE id = $1';
            missionParams[0] = deploymentId;
        }

        const missionResult = await db.query(missionQuery, missionParams);
        const missionData = missionResult.rows;

        // 3. Calculate Daily Cost
        const totalCost = dailyLogs.reduce((acc, log) => acc + parseFloat(log.daily_pay), 0);

        // 4. Call AI Service
        const analysis = await aiService.generateDailyOperationalSummary({
            date,
            missionData,
            dailyLogs,
            totalCost
        }, userId);

        res.json({
            success: true,
            data: analysis.data,
            requestId: analysis.requestId,
            metadata: analysis.metadata
        });

    } catch (error) {
        console.error('Error generating AI daily summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate AI daily summary',
            error: error.message
        });
    }
};
