/**
 * API v1 - Main Router
 * Versioned API for AI intelligence layer
 */

import express from 'express';
import analyzeRoutes from './analyze.js';
import reportsRoutes from './reports.js';
import onboardingRoutes from './onboarding.js';
import { logger } from '../../services/logger.js';
import { aiService } from '../../services/aiService.js';

const router = express.Router();

// API version middleware
router.use((req, res, next) => {
    res.setHeader('X-API-Version', '1.0');
    logger.debug('API v1 request', {
        method: req.method,
        path: req.path,
        userId: req.user?.id
    });
    next();
});

// Health check for AI layer
router.get('/health', (req, res) => {
    res.json({
        success: true,
        version: '1.0',
        data: {
            status: 'ok',
            aiAvailable: aiService?.isAvailable ? aiService.isAvailable() : false,
            timestamp: new Date().toISOString()
        }
    });
});

// Mount sub-routers
router.use('/analyze', analyzeRoutes);
router.use('/reports', reportsRoutes);
router.use('/onboarding', onboardingRoutes);

// 404 handler for unknown v1 endpoints
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        version: '1.0',
        error: 'Endpoint not found'
    });
});

export default router;
