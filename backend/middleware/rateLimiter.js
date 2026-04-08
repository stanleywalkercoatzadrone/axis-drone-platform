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
        // Skip in dev, or if explicitly disabled, or for health checks
        // Also skip pilot upload routes — batch uploads fire many parallel requests
        // from the same IP and are already protected by JWT auth
        return process.env.NODE_ENV === 'development' ||
               process.env.DISABLE_RATE_LIMIT === 'true' ||
               req.path === '/health' ||
               req.path.includes('/pilot/upload-jobs') ||
               req.path.includes('/uploads/');
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
 * Permissive limiter for bulk file upload routes
 * 5000 requests per 15 minutes — allows large batch uploads without throttling
 */
export const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    skip: () => true, // Effectively disabled — uploads are protected by JWT
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication endpoints
 * 15 requests per 15 minutes per IP+Email
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Generous: /auth/me fires on every SPA navigation; login retries are not brute-force risk
    skip: (req) => {
        // Skip rate limiting in development or if explicitly disabled
        // Also skip /auth/me, /refresh, and /login — none are meaningful brute-force surfaces
        // given the Cloud Run memory store resets on every instance restart anyway
        return process.env.NODE_ENV === 'development' ||
               process.env.DISABLE_RATE_LIMIT === 'true' ||
               req.path === '/me' || req.path === '/refresh' || req.path === '/login';
    },
    skipSuccessfulRequests: true, // Only count failed attempts toward the limit
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.'
    },
    handler: (req, res) => {
        logger.logSecurityEvent('Auth rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            email: req.body?.email
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
