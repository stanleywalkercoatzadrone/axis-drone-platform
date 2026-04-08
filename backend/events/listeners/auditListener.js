/**
 * Audit Listener — Axis Event Bus
 *
 * Listens to all system events and writes to the audit_logs table.
 * Non-blocking: errors are caught and logged, never propagated.
 * Enriches audit entries with request_id, before/after state where available.
 */

import { eventBus, EVENT_TYPES } from '../eventBus.js';
import { query } from '../../config/database.js';
import { logger } from '../../services/logger.js';

/**
 * Map event types to human-readable audit actions.
 */
const EVENT_TO_ACTION = {
    [EVENT_TYPES.MISSION_CREATED]:        'MISSION_CREATED',
    [EVENT_TYPES.MISSION_UPDATED]:        'MISSION_UPDATED',
    [EVENT_TYPES.MISSION_STATUS_CHANGED]: 'MISSION_STATUS_CHANGED',
    [EVENT_TYPES.MISSION_DELETED]:        'MISSION_DELETED',
    [EVENT_TYPES.MEDIA_UPLOADED]:         'MEDIA_UPLOADED',
    [EVENT_TYPES.UPLOAD_COMPLETED]:       'UPLOAD_COMPLETED',
    [EVENT_TYPES.UPLOAD_FAILED]:          'UPLOAD_FAILED',
    [EVENT_TYPES.AI_JOB_QUEUED]:          'AI_JOB_QUEUED',
    [EVENT_TYPES.AI_ANALYSIS_COMPLETED]:  'AI_ANALYSIS_COMPLETED',
    [EVENT_TYPES.AI_ANALYSIS_FAILED]:     'AI_ANALYSIS_FAILED',
    [EVENT_TYPES.REPORT_GENERATED]:       'REPORT_GENERATED',
    [EVENT_TYPES.REPORT_FINALIZED]:       'REPORT_FINALIZED',
    [EVENT_TYPES.INVOICE_CREATED]:        'INVOICE_CREATED',
    [EVENT_TYPES.INVOICE_PAID]:           'INVOICE_PAID',
    [EVENT_TYPES.PERSONNEL_CREATED]:      'PERSONNEL_CREATED',
    [EVENT_TYPES.PERSONNEL_UPDATED]:      'PERSONNEL_UPDATED',
    [EVENT_TYPES.USER_LOGIN]:             'USER_LOGIN',
    [EVENT_TYPES.USER_LOGOUT]:            'USER_LOGOUT',
    [EVENT_TYPES.USER_CREATED]:           'USER_CREATED',
    [EVENT_TYPES.PASSWORD_RESET]:         'PASSWORD_RESET',
};

/**
 * Handler: write audit log row for any event.
 */
async function writeAuditEntry({ eventType, payload, emittedAt, eventId }) {
    const action = EVENT_TO_ACTION[eventType] || eventType.toUpperCase().replace(/\./g, '_');

    try {
        await query(
            `INSERT INTO audit_logs
               (user_id, action, resource_type, resource_id,
                metadata, request_id, before_state, after_state)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT DO NOTHING`,
            [
                payload.userId     || null,
                action,
                payload.entityType || payload.resourceType || 'system',
                payload.entityId   || payload.resourceId   || null,
                JSON.stringify({ eventId, emittedAt, ...payload.metadata }),
                payload.requestId  || null,
                payload.before     ? JSON.stringify(payload.before) : null,
                payload.after      ? JSON.stringify(payload.after)  : null,
            ]
        );
    } catch (err) {
        // Audit write failure must never crash the app
        logger.error('[AuditListener] Failed to write audit log', {
            eventType,
            eventId,
            error: err.message,
        });
    }
}

/**
 * Register audit listener on the wildcard channel — receives ALL events.
 */
export function registerAuditListener() {
    eventBus.on('*', writeAuditEntry);
    logger.info('[AuditListener] Registered — all events → audit_logs');
}
