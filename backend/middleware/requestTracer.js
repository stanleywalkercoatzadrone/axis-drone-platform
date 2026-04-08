/**
 * Request Tracer Middleware — Axis Enterprise Platform
 *
 * Generates a unique requestId (UUID) for every incoming request.
 * Attaches to req.requestId and injects into response headers.
 * Measures request duration and logs structured completion entry.
 *
 * Placement in app.js: mount EARLY, after cookieParser, before routes.
 *
 * Usage in controllers/services:
 *   const requestId = req.requestId; // always present after this middleware
 *
 * Response Headers Added:
 *   X-Request-ID: <uuid>
 *   X-Response-Time: <ms>ms
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/logger.js';

/**
 * Request tracer middleware.
 * Non-blocking, non-mutating — only adds properties, never removes.
 */
export const requestTracer = (req, res, next) => {
    const requestId = uuidv4();
    const startTime = process.hrtime.bigint();

    // Attach to request object for downstream use
    req.requestId = requestId;
    req.startTime = startTime;

    // Inject request ID into response headers immediately
    res.setHeader('X-Request-ID', requestId);

    // Hook into response finish to log duration
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000; // nanoseconds → ms
        const durationFormatted = `${durationMs.toFixed(2)}ms`;

        res.setHeader('X-Response-Time', durationFormatted);

        logger.logRequest(req, res, durationMs);
    });

    next();
};

/**
 * Utility: extract requestId from req safely (returns 'unknown' if middleware not mounted).
 */
export const getRequestId = (req) => req?.requestId ?? 'unknown';
