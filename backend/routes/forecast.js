/**
 * forecast.js — Mission Forecasting & Performance Intelligence API Routes
 * Phase 3 – Rate limiting added (5/min per user)
 * Phase 4 – Redis caching added (1 hour TTL)
 *
 * Base: /api/forecast
 * GET  /api/forecast/:missionId         — Get stored forecast windows
 * POST /api/forecast/:missionId/generate — Generate new forecast (admin, rate-limited, cached)
 * GET  /api/forecast/:missionId/performance — Get performance analysis
 * GET  /api/forecast/:missionId/windows  — Get forecast windows (lightweight)
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { analyzeMissionPerformance } from '../services/performanceAnalyzer.js';
import { generateForecast } from '../services/missionForecaster.js';
import { forecastRateLimiter } from '../middleware/forecastRateLimiter.js';
import { setCache, getCache, deleteCache } from '../config/redis.js';
import { query } from '../config/database.js';

const router = express.Router();
const FORECAST_CACHE_TTL = 60 * 60; // 1 hour in seconds

// All forecast routes require authentication
router.use(protect);

// ── GET /api/forecast/:missionId ─────────────────────────────────────────────
// Returns stored forecast windows for a mission
router.get('/:missionId', async (req, res) => {
    try {
        const { missionId } = req.params;

        const [windowsRes, perfRes] = await Promise.all([
            query(
                `SELECT * FROM mission_forecast_windows WHERE mission_id = $1
                 ORDER BY confidence_score DESC LIMIT 10`,
                [missionId]
            ),
            query(
                `SELECT * FROM mission_daily_performance WHERE mission_id = $1
                 ORDER BY date DESC LIMIT 30`,
                [missionId]
            )
        ]);

        res.json({
            success: true,
            missionId,
            windows: windowsRes.rows,
            recentPerformance: perfRes.rows,
            hasData: windowsRes.rows.length > 0,
        });
    } catch (err) {
        console.error('[forecast GET] error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/forecast/:missionId/generate ───────────────────────────────────
// Generates forecast (admin only, rate-limited, Redis-cached)
router.post('/:missionId/generate', authorize('admin'), forecastRateLimiter, async (req, res) => {
    try {
        const { missionId } = req.params;
        const { latitude, longitude } = req.body;
        const cacheKey = `forecast:${missionId}`;

        // Always bust cache before generating
        await deleteCache(cacheKey);

        // Generate fresh forecast — pass lat/lon from browser if provided
        const overrideCoords = (latitude != null && longitude != null)
            ? { lat: parseFloat(latitude), lon: parseFloat(longitude) }
            : null;

        const forecast = await generateForecast(missionId, overrideCoords);

        // Store in Redis for 1 hour
        await setCache(cacheKey, forecast, FORECAST_CACHE_TTL);

        res.json({ success: true, forecast, cached: false });
    } catch (err) {
        console.error('[forecast POST generate] error:', err.message);
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({ success: false, message: err.message });
    }
});

// ── GET /api/forecast/:missionId/performance ─────────────────────────────────
// Returns performance analysis
router.get('/:missionId/performance', async (req, res) => {
    try {
        const { missionId } = req.params;
        const performance = await analyzeMissionPerformance(missionId);
        res.json({ success: true, performance });
    } catch (err) {
        console.error('[forecast GET performance] error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/forecast/:missionId/windows ─────────────────────────────────────
// Returns lightweight window list (for client/pilot views)
router.get('/:missionId/windows', async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await query(
            `SELECT forecast_start_date, forecast_end_date, consecutive_days,
                    predicted_completion_rate, confidence_score, recommended, weather_score,
                    forecast_confidence
             FROM mission_forecast_windows WHERE mission_id = $1
             ORDER BY confidence_score DESC LIMIT 5`,
            [missionId]
        );
        res.json({ success: true, windows: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/forecast/:missionId/cache ────────────────────────────────────
// Admin: bust the cache for a mission (forces fresh generation on next call)
router.delete('/:missionId/cache', authorize('admin'), async (req, res) => {
    try {
        const { missionId } = req.params;
        await deleteCache(`forecast:${missionId}`);
        res.json({ success: true, message: 'Forecast cache cleared' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
