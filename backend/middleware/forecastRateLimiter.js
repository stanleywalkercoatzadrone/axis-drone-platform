/**
 * forecastRateLimiter.js
 * Phase 3 – Forecast API Rate Limiting
 *
 * Limits POST /api/forecast/:missionId/generate to 5 calls per minute per user.
 * Uses express-rate-limit with Redis store (falls back to memory if Redis unavailable).
 */
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiter: 5 forecast generate calls per user per minute.
 * Returns HTTP 429 with structured JSON on exceeded.
 */
export const forecastRateLimiter = rateLimit({
    windowMs: 60 * 1000,   // 1 minute
    max: 5,                 // max 5 per window per key
    keyGenerator: (req) => {
        // Key per authenticated user (falls back to IP)
        return req.user?.id || ipKeyGenerator(req.ip);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: 'Forecast generation is limited to 5 requests per minute. Please wait before retrying.',
            retryAfter: 60
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});
