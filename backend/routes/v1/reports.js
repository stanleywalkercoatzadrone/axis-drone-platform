/**
 * API v1 - Reports Routes
 * Endpoints for retrieving analysis history and generating reports
 */

import express from 'express';
import { protect, authorizePerm, authorize } from '../../middleware/auth.js';
import { standardLimiter } from '../../middleware/rateLimiter.js';
import { logger } from '../../services/logger.js';
import { generatePDFReport, generateJSONExport, generateComplianceReport } from '../../services/reportGenerator.js';
import { AppError } from '../../middleware/errorHandler.js';
import { query } from '../../config/database.js';

const router = express.Router();

/**
 * GET /api/v1/reports/:id
 * Retrieve analysis history for a report
 */
router.get('/:id', protect, authorizePerm('CREATE_REPORT'), standardLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;

        logger.info('Retrieving analysis history', {
            reportId: id,
            userId: req.user.id
        });

        // Fetch all AI analysis results for this report
        const analysisResult = await query(
            `SELECT ar.*, ad.model_version, ad.prompt_version, ad.processing_time_ms, ad.created_at as decision_timestamp
       FROM ai_analysis_results ar
       LEFT JOIN ai_decisions ad ON ar.decision_id = ad.id
       WHERE ar.report_id = $1
       ORDER BY ar.created_at DESC`,
            [id]
        );

        if (analysisResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                version: '1.0',
                error: 'No analysis history found for this report'
            });
        }

        // Transform to camelCase
        const history = analysisResult.rows.map(row => ({
            id: row.id,
            reportId: row.report_id,
            decisionId: row.decision_id,
            findings: row.findings,
            severity: row.severity,
            riskScore: row.risk_score,
            recommendations: row.recommendations,
            confidence: row.confidence,
            reasoning: row.reasoning,
            humanOverride: row.human_override,
            overrideReason: row.override_reason,
            overrideBy: row.override_by,
            overrideAt: row.override_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata: {
                modelVersion: row.model_version,
                promptVersion: row.prompt_version,
                processingTime: row.processing_time_ms,
                decisionTimestamp: row.decision_timestamp
            }
        }));

        res.status(200).json({
            success: true,
            version: '1.0',
            data: {
                reportId: id,
                analysisCount: history.length,
                history
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/reports/:id/decisions
 * Get AI decision log for a report
 */
router.get('/:id/decisions', protect, authorizePerm('CREATE_REPORT'), standardLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;

        const decisionsResult = await query(
            `SELECT ad.*
       FROM ai_decisions ad
       JOIN ai_analysis_results ar ON ad.id = ar.decision_id
       WHERE ar.report_id = $1
       ORDER BY ad.created_at DESC`,
            [id]
        );

        res.status(200).json({
            success: true,
            version: '1.0',
            data: {
                reportId: id,
                decisions: decisionsResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/reports/:id/export/pdf
 * Generate PDF report
 */
router.post('/:id/export/pdf', protect, authorizePerm('CREATE_REPORT'), standardLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;

        logger.info('Generating PDF report', {
            reportId: id,
            userId: req.user.id
        });

        const pdfData = await generatePDFReport(id, req.user.id);

        res.status(200).json({
            success: true,
            version: '1.0',
            data: pdfData
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/reports/:id/export/json
 * Generate JSON export
 */
router.post('/:id/export/json', protect, authorizePerm('CREATE_REPORT'), standardLimiter, async (req, res, next) => {
    try {
        const { id } = req.params;

        logger.info('Generating JSON export', {
            reportId: id,
            userId: req.user.id
        });

        const jsonData = await generateJSONExport(id, req.user.id);

        res.status(200).json({
            success: true,
            version: '1.0',
            data: jsonData
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/reports/compliance
 * Generate compliance report (Admin only)
 */
router.post('/compliance', protect, authorize('ADMIN'), standardLimiter, async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            throw new AppError('startDate and endDate are required', 400);
        }

        logger.info('Generating compliance report', {
            startDate,
            endDate,
            userId: req.user.id
        });

        const complianceData = await generateComplianceReport(startDate, endDate, req.user.id);

        res.status(200).json({
            success: true,
            version: '1.0',
            data: complianceData
        });
    } catch (error) {
        next(error);
    }
});

export default router;
