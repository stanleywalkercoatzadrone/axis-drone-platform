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
    max: 100, // Limit each IP to 100 requests per windowMs
    skip: (req) => {
        return process.env.NODE_ENV === 'development' || process.env.DISABLE_RATE_LIMIT === 'true';
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
 * Strict rate limiter for authentication endpoints
 * 15 requests per 15 minutes per IP+Email
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    skip: (req) => {
        // Skip rate limiting in development or if explicitly disabled
        return process.env.NODE_ENV === 'development' || process.env.DISABLE_RATE_LIMIT === 'true';
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    // keyGenerator removed to prevent IPv6 ValidationError crash
    // TODO: Re-implement credential stuffing protection with proper IPv6 handling
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.'
    },
    skipSuccessfulRequests: false, // Do count successful attempts to prevent enumeration? keeping false is safer for brute force
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
