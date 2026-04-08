/**
 * Analytics Service — Axis Enterprise Platform
 *
 * Streams operational events to Google BigQuery for advanced analytics,
 * forecasting, and business intelligence. Completely flag-gated behind
 * ENABLE_ANALYTICS_PIPELINE=true. When OFF, all operations are no-ops.
 *
 * BigQuery Dataset: axis_analytics (auto-created if missing)
 * Tables:
 *   - mission_events      (mission lifecycle + uploads + reports + invoices)
 *   - ai_results          (AI analysis outcomes + latency + confidence)
 *   - pilot_performance_log (per-pilot session KPIs)
 *   - weather_log         (weather service calls + conditions)
 */

import { getFlag } from '../config/featureFlags.js';
import { logger } from './logger.js';

const GCP_PROJECT_ID  = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'axis-platform-484701';
const BQ_DATASET      = process.env.BIGQUERY_DATASET || 'axis_analytics';

// Table schemas (for auto-create if needed)
const TABLE_SCHEMAS = {
    mission_events: [
        { name: 'event_id',    type: 'STRING',    mode: 'REQUIRED' },
        { name: 'event_type',  type: 'STRING',    mode: 'REQUIRED' },
        { name: 'emitted_at',  type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'tenant_id',   type: 'STRING',    mode: 'NULLABLE' },
        { name: 'user_id',     type: 'STRING',    mode: 'NULLABLE' },
        { name: 'mission_id',  type: 'STRING',    mode: 'NULLABLE' },
        { name: 'payload',     type: 'STRING',    mode: 'NULLABLE' }, // JSON string
        { name: 'inserted_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
    ai_results: [
        { name: 'event_id',       type: 'STRING',    mode: 'REQUIRED' },
        { name: 'event_type',     type: 'STRING',    mode: 'REQUIRED' },
        { name: 'emitted_at',     type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'tenant_id',      type: 'STRING',    mode: 'NULLABLE' },
        { name: 'user_id',        type: 'STRING',    mode: 'NULLABLE' },
        { name: 'mission_id',     type: 'STRING',    mode: 'NULLABLE' },
        { name: 'payload',        type: 'STRING',    mode: 'NULLABLE' },
        { name: 'inserted_at',    type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
    pilot_performance_log: [
        { name: 'event_id',   type: 'STRING',    mode: 'REQUIRED' },
        { name: 'event_type', type: 'STRING',    mode: 'REQUIRED' },
        { name: 'emitted_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'tenant_id',  type: 'STRING',    mode: 'NULLABLE' },
        { name: 'user_id',    type: 'STRING',    mode: 'NULLABLE' },
        { name: 'mission_id', type: 'STRING',    mode: 'NULLABLE' },
        { name: 'payload',    type: 'STRING',    mode: 'NULLABLE' },
        { name: 'inserted_at',type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
    weather_log: [
        { name: 'event_id',   type: 'STRING',    mode: 'REQUIRED' },
        { name: 'event_type', type: 'STRING',    mode: 'REQUIRED' },
        { name: 'emitted_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'tenant_id',  type: 'STRING',    mode: 'NULLABLE' },
        { name: 'user_id',    type: 'STRING',    mode: 'NULLABLE' },
        { name: 'mission_id', type: 'STRING',    mode: 'NULLABLE' },
        { name: 'payload',    type: 'STRING',    mode: 'NULLABLE' },
        { name: 'inserted_at',type: 'TIMESTAMP', mode: 'REQUIRED' },
    ],
};

class AnalyticsService {
    constructor() {
        this._bq = null;
        this._initialized = false;
        this._dataset = null;
    }

    /**
     * Lazily initialize BigQuery client.
     * Only runs if ENABLE_ANALYTICS_PIPELINE=true.
     */
    async _init() {
        if (this._initialized) return;
        this._initialized = true;

        try {
            const { BigQuery } = await import('@google-cloud/bigquery');
            this._bq = new BigQuery({ projectId: GCP_PROJECT_ID });
            this._dataset = this._bq.dataset(BQ_DATASET);

            // Ensure dataset exists
            const [exists] = await this._dataset.exists();
            if (!exists) {
                await this._dataset.create({ location: 'US' });
                logger.info(`[Analytics] Created BigQuery dataset: ${BQ_DATASET}`);
            }

            logger.info(`[Analytics] BigQuery connected: ${GCP_PROJECT_ID}.${BQ_DATASET}`);
        } catch (err) {
            logger.error('[Analytics] BigQuery initialization failed', { error: err.message });
            this._bq = null; // Prevent further attempts
        }
    }

    /**
     * Ensure a table exists in the dataset. Creates with schema if missing.
     */
    async _ensureTable(tableName) {
        if (!this._dataset) return null;
        const schema = TABLE_SCHEMAS[tableName];
        if (!schema) return this._dataset.table(tableName);

        const table = this._dataset.table(tableName);
        const [exists] = await table.exists();
        if (!exists) {
            await table.create({ schema });
            logger.info(`[Analytics] Created BigQuery table: ${tableName}`);
        }
        return table;
    }

    /**
     * Track an event by streaming a row to the specified BigQuery table.
     * NOOP if flag is OFF or BigQuery is unavailable.
     *
     * @param {string} tableName - One of: mission_events, ai_results, pilot_performance_log, weather_log
     * @param {object} row - Row data matching the table schema
     */
    async trackEvent(tableName, row) {
        if (!getFlag('ENABLE_ANALYTICS_PIPELINE')) return;

        await this._init();
        if (!this._bq) return; // BigQuery unavailable (init failed)

        try {
            const table = await this._ensureTable(tableName);
            if (!table) return;

            // Add server-side timestamp
            const enrichedRow = {
                ...row,
                inserted_at: new Date().toISOString(),
            };

            await table.insert([enrichedRow]);
        } catch (err) {
            // BigQuery errors must NEVER affect production flow
            logger.warn('[Analytics] Failed to stream event to BigQuery', {
                tableName,
                error: err.message,
            });
        }
    }

    /**
     * Diagnostic: check if BigQuery is reachable.
     * Returns { available: boolean, dataset: string }
     */
    async healthCheck() {
        if (!getFlag('ENABLE_ANALYTICS_PIPELINE')) {
            return { available: false, reason: 'ENABLE_ANALYTICS_PIPELINE flag is OFF' };
        }
        await this._init();
        return {
            available: this._bq !== null,
            dataset: `${GCP_PROJECT_ID}.${BQ_DATASET}`,
        };
    }
}

// Singleton instance
const analyticsService = new AnalyticsService();

export { analyticsService, AnalyticsService };
