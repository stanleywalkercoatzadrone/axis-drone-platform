/**
 * Error Tracker Middleware — Axis Enterprise Platform
 *
 * Enriches errors with request context before passing to the error handler.
 * Provides structured error logging with requestId, userId, tenantId.
 *
 * Placement in app.js: mount AFTER routes, BEFORE errorHandler.
 * Order: routes → errorTracker → errorHandler → notFound
 */

import { logger } from '../services/logger.js';

/**
 * Error enrichment middleware.
 * Adds request context to errors and logs them structurally.
 * Never swallows errors — always calls next(err).
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const errorTracker = (err, req, res, next) => {
    // Enrich error with request context
    err.requestId  = req.requestId  || 'unknown';
    err.userId     = req.user?.id   || 'unauthenticated';
    err.tenantId   = req.tenantId   || req.user?.tenantId || 'unknown';
    err.path       = req.originalUrl;
    err.method     = req.method;

    const isClientError = err.statusCode >= 400 && err.statusCode < 500;
    const isServerError = !err.statusCode || err.statusCode >= 500;

    // Log server errors (5xx) with full stack trace
    if (isServerError) {
        logger.error('Unhandled server error', {
            requestId:  err.requestId,
            userId:     err.userId,
            tenantId:   err.tenantId,
            path:       err.path,
            method:     err.method,
            error:      err.message,
            stack:      err.stack,
            statusCode: err.statusCode || 500,
        });
    } else if (!isClientError) {
        // Log unexpected status codes
        logger.warn('Unexpected error status', {
            requestId:  err.requestId,
            statusCode: err.statusCode,
            error:      err.message,
        });
    }
    // 4xx errors: already logged at route level typically — skip to avoid noise

    next(err);
};
