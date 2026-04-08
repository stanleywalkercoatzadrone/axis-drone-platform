/**
 * Feature Flags — Axis Enterprise Hardening
 *
 * All flags default to FALSE. Enable in .env or Cloud Run env vars.
 * No flag defaults to true — this guarantees zero behavior change on deploy.
 *
 * Usage:
 *   import { getFlag } from '../config/featureFlags.js';
 *   if (getFlag('ENABLE_ASYNC_AI')) { ... }
 */

export const flags = {
    /**
     * Routes AI analysis requests through the async job queue instead of inline Gemini calls.
     * When ON: POST /api/ai/* returns 202 { jobId } — client must poll GET /api/ai/jobs/:jobId
     * When OFF (default): existing inline synchronous behavior preserved entirely.
     */
    ENABLE_ASYNC_AI: process.env.ENABLE_ASYNC_AI === 'true',

    /**
     * Reserved for future microservices extraction.
     * Currently: no behavior change regardless of value.
     * Future: routes traffic to isolated AI / Upload / Billing services.
     */
    ENABLE_MICROSERVICES: process.env.ENABLE_MICROSERVICES === 'true',

    /**
     * Streams system events to BigQuery for analytics and forecasting.
     * Requires: BigQuery dataset 'axis_analytics' + service account with write access.
     * When OFF (default): events are only handled by local listeners (audit, notify).
     */
    ENABLE_ANALYTICS_PIPELINE: process.env.ENABLE_ANALYTICS_PIPELINE === 'true',

    /**
     * Activates chunked / resumable upload endpoints:
     *   POST /api/uploads/init
     *   PUT  /api/uploads/:id/chunk/:n
     *   POST /api/uploads/:id/complete
     * When OFF (default): only existing single-file pilot upload endpoints are active.
     */
    ENABLE_RESUMABLE_UPLOADS: process.env.ENABLE_RESUMABLE_UPLOADS === 'true',

    /**
     * Enables offline-first support in the Pilot V2 mobile app.
     * Adds: IndexedDB cache, upload queue, offline banner, auto-sync on reconnect.
     * When OFF (default): Pilot V2 behaves exactly as before.
     */
    ENABLE_OFFLINE_PILOT: process.env.ENABLE_OFFLINE_PILOT === 'true',
};

/**
 * Get the current value of a feature flag.
 * Returns false for unknown flags — never throws.
 * @param {string} name - Flag name (e.g. 'ENABLE_ASYNC_AI')
 * @returns {boolean}
 */
export const getFlag = (name) => flags[name] ?? false;

/**
 * Returns a sanitized summary of all flag states for the health/flags endpoint.
 * Safe to expose to authenticated admins (no secrets).
 * @returns {object}
 */
export const getFlagSummary = () => ({
    flags: { ...flags },
    evaluatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
});

// Log flag state on startup for ops visibility
const enabledFlags = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k);

if (enabledFlags.length > 0) {
    console.log(`🚀 Feature Flags ENABLED: ${enabledFlags.join(', ')}`);
} else {
    console.log('🔒 Feature Flags: all OFF (default safe state)');
}
