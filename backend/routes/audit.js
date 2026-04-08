import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN', 'auditor', 'AUDITOR'));

router.get('/', getAuditLogs);

/**
 * GET /api/audit/export
 * Export audit logs as CSV. Admin + Auditor only.
 * Query params: ?from=ISO&to=ISO&userId=UUID&action=string&limit=N
 */
router.get('/export', async (req, res) => {
    try {
        const { from, to, userId, action: actionFilter, limit = 5000 } = req.query;
        const params = [req.user.tenantId];
        let where = 'WHERE 1=1';

        // Tenant scope (admin sees own tenant; adjust if super-admin needed)
        // Note: audit_logs may not have tenant_id — join via users if needed
        if (from) {
            params.push(from);
            where += ` AND al.created_at >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            where += ` AND al.created_at <= $${params.length}`;
        }
        if (userId) {
            params.push(userId);
            where += ` AND al.user_id = $${params.length}`;
        }
        if (actionFilter) {
            params.push(`%${actionFilter}%`);
            where += ` AND al.action ILIKE $${params.length}`;
        }

        params.push(Math.min(parseInt(limit, 10) || 5000, 10000));

        const result = await query(
            `SELECT
               al.id, al.user_id, u.email AS user_email,
               al.action, al.resource_type, al.resource_id,
               al.request_id, al.ip_address,
               al.metadata, al.created_at
             FROM audit_logs al
             LEFT JOIN users u ON u.id = al.user_id
             ${where}
             ORDER BY al.created_at DESC
             LIMIT $${params.length}`,
            params
        );

        // Build CSV
        const cols = ['id', 'user_id', 'user_email', 'action', 'resource_type', 'resource_id',
                       'request_id', 'ip_address', 'metadata', 'created_at'];
        const escape = (v) => {
            if (v == null) return '';
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const csv = [
            cols.join(','),
            ...result.rows.map(row => cols.map(c => escape(row[c])).join(','))
        ].join('\n');

        const filename = `axis-audit-export-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Record-Count', result.rows.length);
        res.send(csv);
    } catch (err) {
        console.error('[audit/export]', err.message);
        res.status(500).json({ success: false, error: 'Failed to export audit logs', requestId: req.requestId });
    }
});

export default router;

