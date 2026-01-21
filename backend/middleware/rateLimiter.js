/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DoS attacks
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../services/logger.js';

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: (req, res) => {
        logger.logSecurityEvent('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        res.status(429).json({
            success: false,
            error: 'Too many requests from this IP, please try again later.'
        });
    }
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.'
    },
    skipSuccessfulRequests: true, // Don't count successful requests
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
