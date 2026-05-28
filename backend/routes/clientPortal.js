import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import {
    getClientProjects,
    getClientMissions,
    getClientLBD,
    getClientDeliverables,
    getClientActivity,
} from '../controllers/clientPortalController.js';

const router = express.Router();

const clientAndAdmin = authorize('admin', 'client', 'client_user', 'customer');

router.get('/projects',     protect, clientAndAdmin, getClientProjects);
router.get('/missions',     protect, clientAndAdmin, getClientMissions);
router.get('/lbd',          protect, clientAndAdmin, getClientLBD);
router.get('/deliverables', protect, clientAndAdmin, getClientDeliverables);
router.get('/activity',     protect, clientAndAdmin, getClientActivity);

/**
 * GET /api/client/media
 * Returns deployment_files scoped to this client's missions only.
 * Matches the shape of /api/admin/media so ClientMapViewer works as-is.
 */
router.get('/media', protect, clientAndAdmin, async (req, res) => {
    try {
        const { normalizeRole } = await import('../utils/roleUtils.js');
        const clientId = normalizeRole(req.user.role) === 'admin'
            ? (req.query.client_id || req.user.id)
            : req.user.id;

        const limit  = Math.min(Number(req.query.limit)  || 200, 1000);
        const offset = Number(req.query.offset) || 0;

        const result = await query(
            `SELECT
                df.id,
                df.name,
                df.url,
                df.type,
                df.size,
                df.created_at,
                d.title       AS mission_title,
                d.id          AS mission_id
            FROM deployment_files df
            JOIN deployments d ON d.id = df.deployment_id
            JOIN projects    p ON p.id = d.project_id
            WHERE p.client_id = $1
            ORDER BY df.created_at DESC
            LIMIT $2 OFFSET $3`,
            [clientId, limit, offset]
        );

        res.json({ success: true, data: result.rows, total: result.rowCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;

