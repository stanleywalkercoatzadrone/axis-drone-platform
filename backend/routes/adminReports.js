/**
 * Admin Reports Route
 * Full CRUD for admin-generated reports with send-to-email capability.
 *
 * Authenticated (all):
 *   GET    /api/admin-reports          — list all reports for tenant
 *   GET    /api/admin-reports/:id      — get single report
 *
 * Admin-only (ADMIN, SUPER_ADMIN, IN_HOUSE):
 *   POST   /api/admin-reports          — create new report (draft)
 *   PUT    /api/admin-reports/:id      — update report
 *   POST   /api/admin-reports/:id/send — send report via email
 *   DELETE /api/admin-reports/:id      — delete report
 */

import express from 'express';
import db from '../config/database.js';
import { protect, authorize } from '../middleware/auth.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// ── Auto-migration: create admin_reports table if missing ─────────────────────
(async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_reports (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id       UUID NOT NULL,
                title           TEXT NOT NULL,
                report_type     TEXT DEFAULT 'custom',
                sections        JSONB DEFAULT '[]'::jsonb,
                status          TEXT DEFAULT 'draft',
                recipients      JSONB DEFAULT '[]'::jsonb,
                sent_at         TIMESTAMPTZ,
                created_by      UUID,
                created_by_name TEXT,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_admin_reports_tenant ON admin_reports(tenant_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_admin_reports_status ON admin_reports(status)`);
        logger.info('[adminReports] admin_reports table ready');
    } catch (err) {
        logger.warn('[adminReports] Auto-migration failed (non-fatal):', err.message);
    }
})();

// ── GET / — list all admin reports for tenant ─────────────────────────────────
router.get('/', protect, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const result = await db.query(
            `SELECT id, tenant_id, title, report_type, status, recipients,
                    sent_at, created_by, created_by_name, created_at, updated_at
             FROM admin_reports
             WHERE tenant_id = $1
             ORDER BY updated_at DESC
             LIMIT 100`,
            [tenantId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('[adminReports] GET /', error);
        res.status(500).json({ success: false, message: 'Failed to fetch admin reports', error: error.message });
    }
});

// ── GET /:id — get single report ──────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const result = await db.query(
            `SELECT * FROM admin_reports WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, tenantId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('[adminReports] GET /:id', error);
        res.status(500).json({ success: false, message: 'Failed to fetch report', error: error.message });
    }
});

// ── POST / — create new admin report (draft) ─────────────────────────────────
router.post('/', protect, authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const {
            title,
            report_type = 'custom',
            sections = [],
            recipients = [],
        } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, message: 'title is required' });
        }

        const result = await db.query(
            `INSERT INTO admin_reports
             (tenant_id, title, report_type, sections, recipients, created_by, created_by_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                tenantId,
                title,
                report_type,
                JSON.stringify(sections),
                JSON.stringify(recipients),
                req.user.id,
                req.user.fullName || req.user.full_name || req.user.email,
            ]
        );

        logger.info(`[adminReports] Report created: ${result.rows[0].id} by ${req.user.email}`);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('[adminReports] POST /', error);
        res.status(500).json({ success: false, message: 'Failed to create report', error: error.message });
    }
});

// ── PUT /:id — update admin report ────────────────────────────────────────────
router.put('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { title, report_type, sections, recipients, status } = req.body;

        const result = await db.query(
            `UPDATE admin_reports
             SET title           = COALESCE($1, title),
                 report_type     = COALESCE($2, report_type),
                 sections        = COALESCE($3, sections),
                 recipients      = COALESCE($4, recipients),
                 status          = COALESCE($5, status),
                 updated_at      = NOW()
             WHERE id = $6 AND tenant_id = $7
             RETURNING *`,
            [
                title || null,
                report_type || null,
                sections ? JSON.stringify(sections) : null,
                recipients ? JSON.stringify(recipients) : null,
                status || null,
                req.params.id,
                tenantId,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        logger.info(`[adminReports] Report updated: ${req.params.id} by ${req.user.email}`);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('[adminReports] PUT /:id', error);
        res.status(500).json({ success: false, message: 'Failed to update report', error: error.message });
    }
});

// ── POST /:id/send — send report via email ────────────────────────────────────
// For now: logs the send action and updates status to 'sent'.
// Actual email delivery will be wired up separately.
router.post('/:id/send', protect, authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { recipients } = req.body; // optional override

        // Fetch the report
        const reportResult = await db.query(
            `SELECT * FROM admin_reports WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, tenantId]
        );

        if (reportResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        const report = reportResult.rows[0];
        const sendTo = recipients || report.recipients || [];

        if (!Array.isArray(sendTo) || sendTo.length === 0) {
            return res.status(400).json({ success: false, message: 'No recipients specified' });
        }

        // Log the send (email service will be wired up later)
        logger.info(`[adminReports] SEND report ${report.id} "${report.title}" to ${sendTo.length} recipient(s) by ${req.user.email}`);
        sendTo.forEach(r => {
            logger.info(`[adminReports]   → ${r.email} (${r.name || 'unnamed'})`);
        });

        // Update status and sent_at, merge recipients if overridden
        const updateResult = await db.query(
            `UPDATE admin_reports
             SET status     = 'sent',
                 sent_at    = NOW(),
                 recipients = $1,
                 updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [JSON.stringify(sendTo), req.params.id, tenantId]
        );

        res.json({
            success: true,
            message: `Report "${report.title}" marked as sent to ${sendTo.length} recipient(s)`,
            data: updateResult.rows[0],
        });
    } catch (error) {
        logger.error('[adminReports] POST /:id/send', error);
        res.status(500).json({ success: false, message: 'Failed to send report', error: error.message });
    }
});

// ── DELETE /:id — delete admin report ─────────────────────────────────────────
router.delete('/:id', protect, authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const result = await db.query(
            `DELETE FROM admin_reports WHERE id = $1 AND tenant_id = $2 RETURNING id, title`,
            [req.params.id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        logger.info(`[adminReports] Report deleted: ${result.rows[0].id} "${result.rows[0].title}" by ${req.user.email}`);
        res.json({ success: true, message: 'Report deleted', data: result.rows[0] });
    } catch (error) {
        logger.error('[adminReports] DELETE /:id', error);
        res.status(500).json({ success: false, message: 'Failed to delete report', error: error.message });
    }
});

export default router;
