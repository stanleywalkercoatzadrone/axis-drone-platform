/**
 * clientReports.js — Client-scoped AI inspection report endpoints
 */
import express from 'express';
import { protect } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(protect);

// GET /api/client/ai-reports — all AI inspection reports for the logged-in client's missions
router.get('/ai-reports', async (req, res) => {
    try {
        const clientId = req.user.id;
        const result = await query(
            `SELECT ar.id, ar.deployment_id, ar.report_type, ar.report_data,
                    ar.created_at, d.title AS mission_title, d.site_name
             FROM ai_reports ar
             JOIN deployments d ON d.id = ar.deployment_id
             WHERE ar.report_type = 'ai_inspection'
               AND d.client_id = $1
             ORDER BY ar.created_at DESC
             LIMIT 50`,
            [clientId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/client/ai-reports/:reportId — single report
router.get('/ai-reports/:reportId', async (req, res) => {
    try {
        const clientId = req.user.id;
        const result = await query(
            `SELECT ar.*, d.title AS mission_title, d.site_name
             FROM ai_reports ar
             JOIN deployments d ON d.id = ar.deployment_id
             WHERE ar.id = $1 AND d.client_id = $2`,
            [req.params.reportId, clientId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Report not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
