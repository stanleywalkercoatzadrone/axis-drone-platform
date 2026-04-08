/**
 * Analytics Listener — Axis Event Bus
 *
 * Streams system events to BigQuery when ENABLE_ANALYTICS_PIPELINE=true.
 * When flag is OFF (default): this listener is registered but is a no-op.
 * Errors NEVER affect the production request cycle.
 *
 * BigQuery Dataset: axis_analytics
 * Tables: mission_events, ai_results, pilot_performance_log
 */

import { eventBus, EVENT_TYPES } from '../eventBus.js';
import { getFlag } from '../../config/featureFlags.js';
import { logger } from '../../services/logger.js';

// Lazily import analytics service to avoid initialization cost when flag is OFF
let analyticsService = null;

async function getAnalyticsService() {
    if (!analyticsService) {
        const module = await import('../../services/analytics.service.js');
        analyticsService = module.analyticsService;
    }
    return analyticsService;
}

/**
 * Map event types to analytics table targets.
 */
const ANALYTICS_ROUTING = {
    [EVENT_TYPES.MISSION_CREATED]:        'mission_events',
    [EVENT_TYPES.MISSION_UPDATED]:        'mission_events',
    [EVENT_TYPES.MISSION_STATUS_CHANGED]: 'mission_events',
    [EVENT_TYPES.AI_ANALYSIS_COMPLETED]:  'ai_results',
    [EVENT_TYPES.AI_ANALYSIS_FAILED]:     'ai_results',
    [EVENT_TYPES.UPLOAD_COMPLETED]:       'mission_events',
    [EVENT_TYPES.REPORT_GENERATED]:       'mission_events',
    [EVENT_TYPES.INVOICE_CREATED]:        'mission_events',
};

/**
 * Handler: stream event to BigQuery (only when flag is ON).
 */
async function streamToAnalytics({ eventType, payload, emittedAt, eventId }) {
    if (!getFlag('ENABLE_ANALYTICS_PIPELINE')) return; // No-op when flag is OFF

    const table = ANALYTICS_ROUTING[eventType];
    if (!table) return; // Not all events need analytics

    try {
        const service = await getAnalyticsService();
        await service.trackEvent(table, {
            event_id:    eventId,
            event_type:  eventType,
            emitted_at:  emittedAt,
            tenant_id:   payload.tenantId  || null,
            user_id:     payload.userId    || null,
            mission_id:  payload.missionId || null,
            payload:     JSON.stringify(payload),
        });
    } catch (err) {
        // Analytics failure is never fatal
        logger.warn('[AnalyticsListener] BigQuery stream failed', {
            eventType,
            eventId,
            error: err.message,
        });
    }
}

/**
 * Register analytics listener on the wildcard channel.
 * Internally guards with feature flag — safe to always register.
 */
export function registerAnalyticsListener() {
    eventBus.on('*', streamToAnalytics);
    const status = getFlag('ENABLE_ANALYTICS_PIPELINE') ? 'ACTIVE' : 'dormant (flag OFF)';
    logger.info(`[AnalyticsListener] Registered — BigQuery pipeline is ${status}`);
}
