/**
 * API v1 - Analysis Routes
 * Endpoints for AI-powered inspection analysis
 */

import express from 'express';
import { protect, checkPermission } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimiter.js';
import { aiService } from '../../services/aiService.js';
import { validate } from '../../services/schemaValidator.js';
import { scoreInspectionAnalysis, scoreAnomalyDetection, scoreMissionReadiness } from '../../services/confidenceScorer.js';
import { logger } from '../../services/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { query } from '../../config/database.js';

const router = express.Router();

/**
 * POST /api/v1/analyze/report
 * Analyze inspection report data
 */
router.post('/report', protect, checkPermission('CREATE_REPORT'), aiLimiter, async (req, res, next) => {
    try {
        const { reportId, industry, client, images, metadata } = req.body;

        if (!reportId) {
            throw new AppError('reportId is required', 400);
        }

        // Check if AI service is available
        if (!aiService.isAvailable()) {
            throw new AppError('AI service is not available', 503);
        }

        logger.info('Starting inspection analysis', {
            reportId,
            industry,
            userId: req.user.id
        });

        // Call AI service
        const aiResult = await aiService.analyzeInspection(
            { reportId, industry, client, images, metadata },
            req.user.id
        );

        // Validate output schema
        const validation = validate('inspectionAnalysis', aiResult.data);
        if (!validation.valid) {
            logger.error('AI output failed schema validation', {
                errors: validation.errors,
                reportId
            });
            throw new AppError('AI analysis produced invalid output', 500);
        }

        // Calculate confidence score
        const confidence = scoreInspectionAnalysis(aiResult.data, aiResult.metadata);

        // Check if confidence meets minimum threshold
        if (!confidence.meetsMinimum) {
            logger.warn('AI analysis confidence below minimum threshold', {
                reportId,
                confidence: confidence.overall
            });
            throw new AppError('AI analysis confidence too low - manual review required', 422);
        }

        // Store analysis result
        const analysisResult = await query(
            `INSERT INTO ai_analysis_results (
        report_id, decision_id, findings, severity, risk_score,
        recommendations, confidence, reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
            [
                reportId,
                aiResult.requestId,
                JSON.stringify(aiResult.data.findings),
                aiResult.data.severity,
                aiResult.data.riskScore,
                JSON.stringify(aiResult.data.recommendations),
                JSON.stringify(confidence),
                JSON.stringify({ chain: [], evidence: [], assumptions: [] }) // Placeholder for reasoning
            ]
        );

        res.status(200).json({
            success: true,
            version: '1.0',
            data: {
                analysisId: analysisResult.rows[0].id,
                requestId: aiResult.requestId,
                analysis: aiResult.data,
                confidence,
                metadata: aiResult.metadata
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/analyze/image
 * Analyze single image for anomalies
 */
router.post('/image', protect, checkPermission('CREATE_REPORT'), aiLimiter, async (req, res, next) => {
    try {
        const { imageUrl, industry, context } = req.body;

        if (!imageUrl) {
            throw new AppError('imageUrl is required', 400);
        }

        if (!aiService.isAvailable()) {
            throw new AppError('AI service is not available', 503);
        }

        logger.info('Starting image analysis', {
            imageUrl: imageUrl.substring(0, 100),
            industry,
            userId: req.user.id
        });

        // Call AI service
        const aiResult = await aiService.detectAnomalies(
            { url: imageUrl, context },
            industry,
            req.user.id
        );

        // Validate output
        const validation = validate('anomalyDetection', aiResult.data);
        if (!validation.valid) {
            throw new AppError('AI analysis produced invalid output', 500);
        }

        // Calculate confidence
        const confidence = scoreAnomalyDetection(aiResult.data, aiResult.metadata);

        if (!confidence.meetsMinimum) {
            throw new AppError('AI analysis confidence too low - manual review required', 422);
        }

        res.status(200).json({
            success: true,
            version: '1.0',
            data: {
                requestId: aiResult.requestId,
                detection: aiResult.data,
                confidence,
                metadata: aiResult.metadata
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/analyze/mission
 * Validate mission readiness
 */
router.post('/mission', protect, checkPermission('CREATE_REPORT'), aiLimiter, async (req, res, next) => {
    try {
        const { deploymentId, assets, personnel, weather, regulations } = req.body;

        if (!deploymentId) {
            throw new AppError('deploymentId is required', 400);
        }

        if (!aiService.isAvailable()) {
            throw new AppError('AI service is not available', 503);
        }

        logger.info('Starting mission readiness analysis', {
            deploymentId,
            userId: req.user.id
        });

        // Call AI service
        const aiResult = await aiService.validateMissionReadiness(
            { assets, personnel, weather, regulations },
            req.user.id
        );

        // Validate output
        const validation = validate('missionReadiness', aiResult.data);
        if (!validation.valid) {
            throw new AppError('AI analysis produced invalid output', 500);
        }

        // Calculate confidence
        const confidence = scoreMissionReadiness(aiResult.data, aiResult.metadata);

        if (!confidence.meetsMinimum) {
            throw new AppError('AI analysis confidence too low - manual review required', 422);
        }

        res.status(200).json({
            success: true,
            version: '1.0',
            data: {
                requestId: aiResult.requestId,
                readiness: aiResult.data,
                confidence,
                metadata: aiResult.metadata
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
