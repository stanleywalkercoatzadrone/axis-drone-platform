import { query } from '../config/database.js';

export const getAuditLogs = async (req, res, next) => {
    try {
        const { limit = 100, resourceType, userId } = req.query;

        let queryText = `
      SELECT a.*, u.full_name as user_name, u.email as user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
        const params = [];

        if (resourceType) {
            params.push(resourceType);
            queryText += ` AND a.resource_type = $${params.length}`;
        }

        if (userId) {
            params.push(userId);
            queryText += ` AND a.user_id = $${params.length}`;
        }

        params.push(parseInt(limit));
        queryText += ` ORDER BY a.timestamp DESC LIMIT $${params.length}`;

        const result = await query(queryText, params);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};
