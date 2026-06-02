/**
 * Downloads Route
 * Handles distribution of the Axis Ortho desktop application.
 *
 * Public:
 *   GET  /api/downloads/axis-ortho          — version metadata + download URLs
 *
 * Admin-only:
 *   POST /api/downloads/axis-ortho/send     — email download link to a user
 *   GET  /api/downloads/axis-ortho/log      — list who has been sent the link
 */

import express from 'express';
import db from '../config/database.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendAxisOrthoDownloadEmail } from '../services/emailService.js';
import { logger } from '../services/logger.js';

const router = express.Router();

const VERSION = '1.0.0';
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

const DOWNLOADS = {
    arm64: {
        arch:     'Apple Silicon (M1/M2/M3)',
        url:      `${BASE_URL}/uploads/downloads/AxisOrtho-arm64.dmg`,
        filename: 'AxisOrtho-arm64.dmg',
        size:     '109 MB',
    },
    x64: {
        arch:     'Intel (x64)',
        url:      `${BASE_URL}/uploads/downloads/AxisOrtho-x64.dmg`,
        filename: 'AxisOrtho-x64.dmg',
        size:     '116 MB',
    },
    win_x64: {
        arch:     'Windows (x64)',
        url:      `${BASE_URL}/uploads/downloads/AxisOrtho-x64-Setup.exe`,
        filename: 'AxisOrtho-x64-Setup.exe',
        size:     '124 MB',
    },
    win_arm64: {
        arch:     'Windows (ARM64)',
        url:      `${BASE_URL}/uploads/downloads/AxisOrtho-arm64-Setup.exe`,
        filename: 'AxisOrtho-arm64-Setup.exe',
        size:     '118 MB',
    },
};

// ── GET /api/downloads/axis-ortho ─────────────────────────────────────────────
// Public — returns version metadata and download URLs
router.get('/axis-ortho', async (req, res) => {
    res.json({
        success: true,
        data: {
            name:        'Axis Ortho',
            version:     VERSION,
            description: 'Offline-first orthomosaic processing for Mac & Windows. Processes drone images locally via NodeODM and syncs results to Axis Platform when online.',
            requires:    'macOS 10.12+ or Windows 10+, Docker Desktop',
            releasedAt:  new Date().toISOString(),
            downloads:   DOWNLOADS,
        },
    });
});

// ── POST /api/downloads/axis-ortho/send ───────────────────────────────────────
// Admin only — send download link email to a personnel / user
router.post('/axis-ortho/send', protect, authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    try {
        const { recipientId, recipientType = 'personnel' } = req.body;
        const tenantId = req.user.tenantId;

        if (!recipientId) {
            return res.status(400).json({ success: false, message: 'recipientId is required' });
        }

        // Look up recipient — support both personnel and users tables
        let recipient;
        if (recipientType === 'user') {
            const result = await db.query(
                'SELECT id, full_name, email FROM users WHERE id = $1 AND tenant_id = $2',
                [recipientId, tenantId]
            );
            recipient = result.rows[0];
        } else {
            const result = await db.query(
                'SELECT id, full_name, email FROM personnel WHERE id = $1 AND tenant_id = $2',
                [recipientId, tenantId]
            );
            recipient = result.rows[0];
        }

        if (!recipient) {
            return res.status(404).json({ success: false, message: 'Recipient not found' });
        }

        // Send the email
        await sendAxisOrthoDownloadEmail({
            to:               recipient.email,
            fullName:         recipient.full_name,
            downloadUrlArm64: DOWNLOADS.arm64.url,
            downloadUrlX64:   DOWNLOADS.x64.url,
            downloadUrlWinX64:   DOWNLOADS.win_x64.url,
            downloadUrlWinArm64: DOWNLOADS.win_arm64.url,
            version:          VERSION,
        });

        // Log the send
        await db.query(
            `INSERT INTO axis_ortho_download_log
             (recipient_id, recipient_type, recipient_email, sent_by, tenant_id, sent_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT DO NOTHING`,
            [recipientId, recipientType, recipient.email, req.user.id, tenantId]
        ).catch(() => {
            // Table may not exist yet — non-fatal, just log
            logger.warn('[downloads] axis_ortho_download_log table missing — skipping log insert');
        });

        logger.info(`[downloads] Axis Ortho download link sent to ${recipient.email} by ${req.user.email}`);

        res.json({
            success: true,
            message: `Download link sent to ${recipient.full_name} (${recipient.email})`,
        });
    } catch (error) {
        logger.error('[downloads/axis-ortho/send]', error);
        res.status(500).json({ success: false, message: 'Failed to send download link', error: error.message });
    }
});

// ── GET /api/downloads/axis-ortho/log ─────────────────────────────────────────
// Admin only — who has been sent the link
router.get('/axis-ortho/log', protect, authorize('ADMIN', 'SUPER_ADMIN', 'IN_HOUSE'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const result = await db.query(
            `SELECT l.*, u.full_name AS sent_by_name
             FROM axis_ortho_download_log l
             LEFT JOIN users u ON l.sent_by = u.id
             WHERE l.tenant_id = $1
             ORDER BY l.sent_at DESC
             LIMIT 100`,
            [tenantId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        // Table may not exist — return empty gracefully
        res.json({ success: true, data: [] });
    }
});

export default router;
