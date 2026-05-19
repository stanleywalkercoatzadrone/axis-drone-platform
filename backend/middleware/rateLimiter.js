/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DoS attacks
 * TEMPORARILY USING MEMORY STORE - Redis disabled for Cloud Run deployment
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { logger } from '../services/logger.js';
import { redisClient } from '../config/redis.js';

// Helper to create Redis Store (uses live binding to wait for connection)
const createStore = () => {
    // REDIS ENABLED - falls back to memory if redisClient is not connected
    if (redisClient && redisClient.isOpen) {
        return new RedisStore({
            sendCommand: async (...args) => {
                try {
                    return await redisClient.sendCommand(args);
                } catch (err) {
                    console.error('Redis RateLimit Store Error:', err);
                    return null;
                }
            },
        });
    }
    return undefined; // Memory store fallback
};

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased: SPA makes many parallel requests on each page load
    skip: (req) => {
        // SECURITY: DISABLE_RATE_LIMIT must never bypass limits in production
        const rateLimitDisabled = process.env.NODE_ENV !== 'production' &&
                                  process.env.DISABLE_RATE_LIMIT === 'true';
        return rateLimitDisabled ||
               req.path === '/health' ||
               req.path.includes('/pilot/upload-jobs') ||
               req.path.includes('/orthomosaic/upload-url') ||
               req.path.includes('/orthomosaic/upload-direct') ||
               req.path.includes('/orthomosaic/upload-confirm') ||
               // Axis mapping chunk uploads — many rapid requests per mission, must not be throttled
               req.path.includes('/axis/chunk') ||
               req.path.includes('/axis/init') ||
               req.path.includes('/axis/commit');
    },
    standardHeaders: true,

    legacyHeaders: false,
    store: createStore(),
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    },
    handler: (req, res) => {
        logger.logSecurityEvent('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.'
        });
    }
});

/**
 * Upload rate limiter — 150 requests per 15 minutes per IP
 * Allows batch drone imagery uploads while preventing abuse.
 * All upload routes require JWT auth — this is a secondary DoS guard.
 */
export const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    skip: (req) => process.env.NODE_ENV !== 'production' && process.env.DISABLE_RATE_LIMIT === 'true',
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    handler: (req, res) => {
        logger.logSecurityEvent('Upload rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userId: req.user?.id
        });
        res.status(429).json({ success: false, error: 'Upload rate limit exceeded. Please wait before uploading more files.' });
    }
});

/**
 * Strict rate limiter for authentication endpoints
 * 15 requests per 15 minutes per IP+Email
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // SECURITY: 20 auth attempts per 15 min — stops brute force
    skip: (req) => {
        // SECURITY: DISABLE_RATE_LIMIT must never work in production
        const rateLimitDisabled = process.env.NODE_ENV !== 'production' &&
                                  process.env.DISABLE_RATE_LIMIT === 'true';
        // Only skip non-sensitive paths: /me (profile check) and /refresh (token rotation)
        // /login is NOT skipped — it is the primary brute-force target
        return rateLimitDisabled ||
               req.path === '/me' ||
               req.path === '/refresh';
    },
    // SECURITY: skipSuccessfulRequests removed — count all attempts including successful
    // logins to prevent a slow-credential-stuffing pattern that succeeds every attempt.
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    message: { success: false, error: 'Too many authentication attempts, please try again later.' },
    handler: (req, res) => {
        logger.logSecurityEvent('Auth rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            email: req.body?.email  // intentionally logged for abuse detection
        });
        res.status(429).json({
            success: false,
            error: 'Too many authentication attempts, please try again in 15 minutes.'
        });
    }
});

/**
 * Relaxed rate limiter for AI/analysis endpoints
 * 20 requests per 15 minutes per IP (AI operations are expensive)
 */
export const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    message: {
        success: false,
        error: 'Too many AI requests, please try again later.'
    },
    handler: (req, res) => {
        logger.warn('AI rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userId: req.user?.id
        });
        res.status(429).json({
            success: false,
            error: 'Too many AI analysis requests. Please wait before submitting more.'
        });
    }
});

/**
 * Very strict limiter for sensitive operations
 * 3 requests per hour per IP
 */
export const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    message: {
        success: false,
        error: 'Too many sensitive operation attempts, please try again later.'
    },
    handler: (req, res) => {
        logger.logSecurityEvent('Sensitive operation rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userId: req.user?.id
        });
        res.status(429).json({
            success: false,
            error: 'Too many attempts for this sensitive operation.'
        });
    }
});
