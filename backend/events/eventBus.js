/**
 * Internal Event Bus — Axis Enterprise Platform
 *
 * Lightweight synchronous EventEmitter-based event system.
 * Provides decoupled, typed event communication between system components.
 *
 * Design Principles:
 * - All events are NON-BLOCKING — listeners run async and errors are swallowed
 * - Zero external dependencies (Node.js native EventEmitter)
 * - All events are typed via EVENT_TYPES constant
 * - Full event payload logging for audit trail
 *
 * Usage:
 *   import { eventBus, EVENT_TYPES } from '../events/eventBus.js';
 *   eventBus.emit(EVENT_TYPES.MISSION_CREATED, { missionId, userId });
 *   eventBus.on(EVENT_TYPES.MISSION_CREATED, async (payload) => { ... });
 */

import { EventEmitter } from 'events';

/**
 * Typed event names — all system events must use these constants.
 * Adding a new event? Add it here first.
 */
export const EVENT_TYPES = {
    // Mission lifecycle
    MISSION_CREATED:         'mission.created',
    MISSION_UPDATED:         'mission.updated',
    MISSION_STATUS_CHANGED:  'mission.status_changed',
    MISSION_DELETED:         'mission.deleted',

    // Media & Uploads
    MEDIA_UPLOADED:          'media.uploaded',
    UPLOAD_COMPLETED:        'upload.completed',
    UPLOAD_FAILED:           'upload.failed',

    // AI Processing
    AI_JOB_QUEUED:           'ai.job_queued',
    AI_ANALYSIS_COMPLETED:   'ai.analysis.completed',
    AI_ANALYSIS_FAILED:      'ai.analysis.failed',

    // Reports
    REPORT_GENERATED:        'report.generated',
    REPORT_FINALIZED:        'report.finalized',

    // Finance
    INVOICE_CREATED:         'invoice.created',
    INVOICE_PAID:            'invoice.paid',

    // Personnel
    PERSONNEL_CREATED:       'personnel.created',
    PERSONNEL_UPDATED:       'personnel.updated',

    // Auth / Security
    USER_LOGIN:              'user.login',
    USER_LOGOUT:             'user.logout',
    USER_CREATED:            'user.created',
    PASSWORD_RESET:          'user.password_reset',
};

class AxisEventBus extends EventEmitter {
    constructor() {
        super();
        // Increase limit to support many listeners (audit, analytics, notifications, etc.)
        this.setMaxListeners(50);
        this._emitCount = 0;
    }

    /**
     * Emit a typed event with payload.
     * All listeners are called asynchronously — errors in listeners NEVER propagate.
     *
     * @param {string} eventType - Use EVENT_TYPES constants
     * @param {object} payload - Event data
     */
    emit(eventType, payload = {}) {
        this._emitCount++;

        const envelope = {
            eventType,
            payload,
            emittedAt: new Date().toISOString(),
            eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        };

        // Emit to all listeners — wrapped in setImmediate for non-blocking behavior
        setImmediate(() => {
            try {
                super.emit(eventType, envelope);
                super.emit('*', envelope); // Wildcard listeners (e.g., analytics)
            } catch (err) {
                // Never let event bus errors propagate to the request cycle
                console.error(`[EventBus] Uncaught error in listener for ${eventType}:`, err.message);
            }
        });

        return true;
    }

    /**
     * Register an async listener for a typed event.
     * Errors in async listeners are caught and logged — never rethrown.
     *
     * @param {string} eventType - Event to listen to (or '*' for all)
     * @param {Function} handler - Async function(envelope) => void
     */
    on(eventType, handler) {
        const safeHandler = async (envelope) => {
            try {
                await handler(envelope);
            } catch (err) {
                console.error(`[EventBus] Listener error on '${eventType}':`, err.message);
            }
        };
        super.on(eventType, safeHandler);
        return this;
    }

    /**
     * Returns diagnostic info about the event bus.
     */
    stats() {
        return {
            totalEmitted: this._emitCount,
            listenerCounts: this.eventNames().reduce((acc, name) => {
                acc[name] = this.listenerCount(name);
                return acc;
            }, {}),
        };
    }
}

// Singleton event bus instance
const eventBus = new AxisEventBus();

export { eventBus };
