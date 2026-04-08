/**
 * securityLogger.js
 * Phase 12 – Security Event Logging
 *
 * Writes to security_events table. Non-blocking — errors are swallowed
 * so logging never interrupts the main request flow.
 */
import { query } from '../config/database.js';

/**
 * Log a security event to the security_events table.
 * @param {Object} params
 * @param {string|null} params.userId
 * @param {string} params.eventType  — e.g. 'UNAUTHORIZED_MISSION_ACCESS', 'AUTH_FAILURE', 'PERMISSION_DENIED'
 * @param {string|null} params.resource — e.g. '/api/pilot/secure/missions/123'
 * @param {string|null} params.ipAddress
 * @param {Object} params.metadata   — any additional context
 */
export async function logSecurityEvent({ userId = null, eventType, resource = null, ipAddress = null, metadata = {} }) {
    try {
        await query(
            `INSERT INTO security_events (user_id, event_type, resource, ip_address, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, eventType, resource, ipAddress, JSON.stringify(metadata)]
        );
    } catch (err) {
        // Never let logging failures propagate
        console.warn('[securityLogger] Failed to write security event:', err.message);
    }
}

export const SECURITY_EVENTS = {
    UNAUTHORIZED_MISSION_ACCESS: 'UNAUTHORIZED_MISSION_ACCESS',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    AUTH_FAILURE: 'AUTH_FAILURE',
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    AUTH_VERSION_MISMATCH: 'AUTH_VERSION_MISMATCH',
    INVALID_TOKEN: 'INVALID_TOKEN',
    FORECAST_NO_COORDINATES: 'FORECAST_NO_COORDINATES',
    CLIENT_DATA_BOUNDARY_VIOLATION: 'CLIENT_DATA_BOUNDARY_VIOLATION',
};
