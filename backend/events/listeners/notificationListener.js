/**
 * Notification Listener — Axis Event Bus
 *
 * Listens to key system events and creates notification records.
 * Currently persists to the existing `notifications` table.
 * Future: fan out to WebSocket push, email, Slack webhook, etc.
 *
 * Non-blocking: errors never propagate to request cycle.
 */

import { eventBus, EVENT_TYPES } from '../eventBus.js';
import { query } from '../../config/database.js';
import { logger } from '../../services/logger.js';

/**
 * Map event types → notification templates.
 */
const NOTIFICATION_TEMPLATES = {
    [EVENT_TYPES.MISSION_CREATED]: (p) => ({
        type: 'MISSION_CREATED',
        title: 'New Mission Created',
        message: `Mission "${p.title || p.missionId}" was created.`,
        mission_id: p.missionId,
    }),
    [EVENT_TYPES.MISSION_STATUS_CHANGED]: (p) => ({
        type: 'MISSION_STATUS_CHANGED',
        title: 'Mission Status Updated',
        message: `Mission status changed from "${p.previousStatus}" to "${p.newStatus}".`,
        mission_id: p.missionId,
    }),
    [EVENT_TYPES.AI_ANALYSIS_COMPLETED]: (p) => ({
        type: 'AI_COMPLETE',
        title: 'AI Analysis Complete',
        message: `AI analysis for job ${p.jobId} completed successfully.`,
        mission_id: p.missionId,
    }),
    [EVENT_TYPES.AI_ANALYSIS_FAILED]: (p) => ({
        type: 'AI_FAILED',
        title: 'AI Analysis Failed',
        message: `AI analysis job ${p.jobId} failed: ${p.error || 'Unknown error'}.`,
        mission_id: p.missionId,
    }),
    [EVENT_TYPES.INVOICE_CREATED]: (p) => ({
        type: 'INVOICE_CREATED',
        title: 'Invoice Generated',
        message: `Invoice ${p.invoiceNumber || p.invoiceId} was created.`,
        mission_id: p.missionId,
    }),
};

/**
 * Handler: insert notification row for matching events.
 */
async function createNotification({ eventType, payload }) {
    const template = NOTIFICATION_TEMPLATES[eventType];
    if (!template) return; // Not all events need notifications

    const notification = template(payload);

    try {
        await query(
            `INSERT INTO notifications
               (tenant_id, mission_id, type, title, message)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                payload.tenantId   || null,
                notification.mission_id || null,
                notification.type,
                notification.title,
                notification.message,
            ]
        );
    } catch (err) {
        logger.error('[NotificationListener] Failed to create notification', {
            eventType,
            error: err.message,
        });
    }
}

/**
 * Register notification listener for specific event types.
 */
export function registerNotificationListener() {
    Object.keys(NOTIFICATION_TEMPLATES).forEach((eventType) => {
        eventBus.on(eventType, createNotification);
    });
    logger.info('[NotificationListener] Registered for mission, AI, and invoice events');
}
