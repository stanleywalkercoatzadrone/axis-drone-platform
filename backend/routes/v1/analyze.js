/**
 * API v1 - Analysis Routes (Enterprise Audit + Prompt Versioning + Usage Metrics)
 * Endpoints for AI-powered inspection analysis
 *
 * Includes:
 * - Prompt template lookup (ai_prompt_templates)
 * - Immutable decision/audit logging (ai_decisions)
 * - Report-linked analysis storage (ai_analysis_results)
 * - Usage metrics upsert (ai_usage_metrics)
 * - Confidence gating via AUTO_APPROVED vs NEEDS_REVIEW (200 vs 202)
 */

import express from 'express';
import crypto from 'crypto';
import { protect, authorizePerm } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimiter.js';
import { aiService } from '../../services/aiService.js';
import { validate } from '../../services/schemaValidator.js';
import {
    scoreInspectionAnalysis,
    scoreAnomalyDetection,
    scoreMissionReadiness,
} from '../../services/confidenceScorer.js';
import { logger } from '../../services/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { query } from '../../config/database.js';
import { generateDailySummary } from '../../controllers/aiController.js';

const router = express.Router();

/* ----------------------------- helper utils ----------------------------- */

function nowMs() {
    return Date.now();
}

function hashJson(obj) {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

/**
 * Fetch latest active prompt template by name
 */
async function getActivePrompt(name) {
    const r = await query(
        `SELECT name, version, template
     FROM ai_prompt_templates
     WHERE name = $1 AND is_active = TRUE
     ORDER BY created_at DESC
     LIMIT 1`,
        [name]
    );
    if (!r.rowCount) throw new AppError(`No active prompt template: ${name}`, 500);
    return r.rows[0]; // { name, version, template }
}

/**
 * Generate request_id as UUID in Postgres (ensures server-side uniqueness)
 */
async function generateRequestId() {
    const r = await query(`SELECT gen_random_uuid() AS id`);
    return r.rows[0].id;
}

/**
 * Upsert AI usage metrics (per user/day/endpoint)
 */
async function upsertUsageMetrics({ userId, endpoint, tokenCount, processingTimeMs }) {
    await query(
        `INSERT INTO ai_usage_metrics (user_id, date, endpoint, request_count, total_tokens, total_processing_time_ms)
     VALUES ($1, CURRENT_DATE, $2, 1, $3, $4)
     ON CONFLICT (user_id, date, endpoint)
     DO UPDATE SET
       request_count = ai_usage_metrics.request_count + 1,
       total_tokens = ai_usage_metrics.total_tokens + EXCLUDED.total_tokens,
       total_processing_time_ms = ai_usage_metrics.total_processing_time_ms + EXCLUDED.total_processing_time_ms`,
        [userId, endpoint, tokenCount ?? 0, processingTimeMs ?? 0]
    );
}

/**
 * Insert immutable ai_decisions row and return decision_id
 * Assumes aiResult.metadata shape:
 * metadata: { model_version, token_count, provider, latency }
 */
async function insertAiDecision({
    requestId,
    userId,
    endpoint,
    inputData,
    outputData,
    promptName,
    promptVersion,
    confidenceScore,
    processingTimeMs,
    aiMeta,
}) {
    const modelLatencyMs = Number(aiMeta?.latency ?? null);

    const r = await query(
        `INSERT INTO ai_decisions (
      request_id, user_id, endpoint,
      input_data, output_data,
      model_version, prompt_version,
      confidence_score, processing_time_ms, token_count,
      metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id`,
        [
            requestId,
            userId,
            endpoint,
            inputData,
            outputData,
            aiMeta?.model_version || 'unknown',
            promptVersion,
            confidenceScore ?? null,
            processingTimeMs,
            aiMeta?.token_count ?? null,
            {
                provider: aiMeta?.provider || 'unknown',
                latency_ms: modelLatencyMs, // model-only latency
                promptName,
                inputHash: hashJson(inputData),
            },
        ]
    );

    return r.rows[0].id;
}

/* --------------------------------- ROUTES -------------------------------- */

/**
 * POST /api/v1/analyze/report
 * Analyze inspection report data
 */
router.post(
    '/report',
    protect,
    authorizePerm('AI_ANALYZE_REPORT'),
    aiLimiter,
    async (req, res, next) => {
        const t0 = nowMs();
        const endpointKey = '/api/v1/analyze/report';

        try {
            const { reportId, industry, client, images = [], metadata = {} } = req.body;

            if (!reportId) throw new AppError('reportId is required', 400);
            if (!aiService.isAvailable()) throw new AppError('AI service is not available', 503);

            const prompt = await getActivePrompt('inspection_analysis');
            const requestId = await generateRequestId();

            const inputData = {
                reportId,
                industry,
                client,
                imagesCount: images.length,
                images, // consider storing only ids/refs if URLs are signed/sensitive
                metadata,
            };

            logger.info('Starting inspection analysis', {
                reportId,
                industry,
                userId: req.user.id,
                requestId,
            });

            const aiResult = await aiService.analyzeInspection(
                {
                    reportId,
                    industry,
                    client,
                    images,
                    metadata,
                    requestId,
                    promptTemplate: prompt.template,
                    promptVersion: prompt.version,
                },
                req.user.id
            );

            // Validate AI output schema
            const validation = validate('inspectionAnalysis', aiResult.data);
            if (!validation.valid) {
                logger.error('AI output failed schema validation', {
                    errors: validation.errors,
                    reportId,
                    requestId,
                });
                throw new AppError('AI analysis produced invalid output', 500);
            }

            // Confidence scoring
            const confidence = scoreInspectionAnalysis(aiResult.data, aiResult.metadata);
            const status = confidence.meetsMinimum ? 'AUTO_APPROVED' : 'NEEDS_REVIEW';

            const processingTimeMs = nowMs() - t0;

            // Insert immutable decision record
            const decisionId = await insertAiDecision({
                requestId,
                userId: req.user.id,
                endpoint: endpointKey,
                inputData,
                outputData: aiResult.data,
                promptName: prompt.name,
                promptVersion: prompt.version,
                confidenceScore: confidence.overall ?? null,
                processingTimeMs,
                aiMeta: aiResult.metadata, // { model_version, token_count, provider, latency }
            });

            // Insert analysis result linked to decision_id
            const analysisInsert = await query(
                `INSERT INTO ai_analysis_results (
          report_id, decision_id,
          findings, severity, risk_score,
          recommendations, confidence, reasoning,
          metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id`,
                [
                    reportId,
                    decisionId,
                    JSON.stringify(aiResult.data.findings ?? []),
                    aiResult.data.severity ?? null,
                    aiResult.data.riskScore ?? null,
                    JSON.stringify(aiResult.data.recommendations ?? []),
                    JSON.stringify(confidence),
                    JSON.stringify({
                        evidence: aiResult.data.evidence ?? [],
                        assumptions: aiResult.data.assumptions ?? [],
                        policyBasis: aiResult.data.policyBasis ?? [],
                        status,
                    }),
                    JSON.stringify({
                        status,
                        prompt: { name: prompt.name, version: prompt.version },
                    }),
                ]
            );

            // Upsert usage metrics
            await upsertUsageMetrics({
                userId: req.user.id,
                endpoint: endpointKey,
                tokenCount: aiResult.metadata?.token_count ?? 0,
                processingTimeMs,
            });

            res.status(status === 'AUTO_APPROVED' ? 200 : 202).json({
                success: true,
                version: '1.0',
                data: {
                    status,
                    analysisId: analysisInsert.rows[0].id,
                    decisionId,
                    requestId,
                    analysis: aiResult.data,
                    confidence,
                    metadata: aiResult.metadata,
                    prompt: { name: prompt.name, version: prompt.version },
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v1/analyze/image
 * Analyze single image for anomalies
 */
router.post(
    '/image',
    protect,
    authorizePerm('AI_ANALYZE_IMAGE'),
    aiLimiter,
    async (req, res, next) => {
        const t0 = nowMs();
        const endpointKey = '/api/v1/analyze/image';

        try {
            const { imageUrl, industry, context = {} } = req.body;

            if (!imageUrl) throw new AppError('imageUrl is required', 400);
            if (!aiService.isAvailable()) throw new AppError('AI service is not available', 503);

            const prompt = await getActivePrompt('anomaly_detection');
            const requestId = await generateRequestId();

            const inputData = {
                imageUrl, // consider storing only host + hash if signed URLs are used
                industry,
                context,
            };

            logger.info('Starting image analysis', {
                industry,
                userId: req.user.id,
                requestId,
            });

            const aiResult = await aiService.detectAnomalies(
                { url: imageUrl, context, requestId, promptTemplate: prompt.template, promptVersion: prompt.version },
                industry,
                req.user.id
            );

            const validation = validate('anomalyDetection', aiResult.data);
            if (!validation.valid) {
                throw new AppError('AI analysis produced invalid output', 500);
            }

            const confidence = scoreAnomalyDetection(aiResult.data, aiResult.metadata);
            const status = confidence.meetsMinimum ? 'AUTO_APPROVED' : 'NEEDS_REVIEW';

            const processingTimeMs = nowMs() - t0;

            const decisionId = await insertAiDecision({
                requestId,
                userId: req.user.id,
                endpoint: endpointKey,
                inputData,
                outputData: aiResult.data,
                promptName: prompt.name,
                promptVersion: prompt.version,
                confidenceScore: confidence.overall ?? null,
                processingTimeMs,
                aiMeta: aiResult.metadata,
            });

            await upsertUsageMetrics({
                userId: req.user.id,
                endpoint: endpointKey,
                tokenCount: aiResult.metadata?.token_count ?? 0,
                processingTimeMs,
            });

            res.status(status === 'AUTO_APPROVED' ? 200 : 202).json({
                success: true,
                version: '1.0',
                data: {
                    status,
                    decisionId,
                    requestId,
                    detection: aiResult.data,
                    confidence,
                    metadata: aiResult.metadata,
                    prompt: { name: prompt.name, version: prompt.version },
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/v1/analyze/mission
 * Validate mission readiness
 */
router.post(
    '/mission',
    protect,
    authorizePerm('AI_VALIDATE_MISSION'),
    aiLimiter,
    async (req, res, next) => {
        const t0 = nowMs();
        const endpointKey = '/api/v1/analyze/mission';

        try {
            const { deploymentId, assets = [], personnel = [], weather = {}, regulations = {} } = req.body;

            if (!deploymentId) throw new AppError('deploymentId is required', 400);
            if (!aiService.isAvailable()) throw new AppError('AI service is not available', 503);

            const prompt = await getActivePrompt('mission_readiness');
            const requestId = await generateRequestId();

            const inputData = {
                deploymentId,
                assets,
                personnel,
                weather,
                regulations,
            };

            logger.info('Starting mission readiness analysis', {
                deploymentId,
                userId: req.user.id,
                requestId,
            });

            const aiResult = await aiService.validateMissionReadiness(
                { assets, personnel, weather, regulations, requestId, promptTemplate: prompt.template, promptVersion: prompt.version },
                req.user.id
            );

            const validation = validate('missionReadiness', aiResult.data);
            if (!validation.valid) {
                throw new AppError('AI analysis produced invalid output', 500);
            }

            const confidence = scoreMissionReadiness(aiResult.data, aiResult.metadata);
            const status = confidence.meetsMinimum ? 'AUTO_APPROVED' : 'NEEDS_REVIEW';

            const processingTimeMs = nowMs() - t0;

            const decisionId = await insertAiDecision({
                requestId,
                userId: req.user.id,
                endpoint: endpointKey,
                inputData,
                outputData: aiResult.data,
                promptName: prompt.name,
                promptVersion: prompt.version,
                confidenceScore: confidence.overall ?? null,
                processingTimeMs,
                aiMeta: aiResult.metadata,
            });

            await upsertUsageMetrics({
                userId: req.user.id,
                endpoint: endpointKey,
                tokenCount: aiResult.metadata?.token_count ?? 0,
                processingTimeMs,
            });

            res.status(status === 'AUTO_APPROVED' ? 200 : 202).json({
                success: true,
                version: '1.0',
                data: {
                    status,
                    decisionId,
                    requestId,
                    readiness: aiResult.data,
                    confidence,
                    metadata: aiResult.metadata,
                    prompt: { name: prompt.name, version: prompt.version },
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/v1/analyze/daily-summary
 * Generate daily operational summary
 *
 * NOTE: You can later apply the same ai_decisions + ai_usage_metrics pipeline inside generateDailySummary.
 */
router.get(
    '/daily-summary',
    protect,
    authorizePerm('AI_VIEW_SUMMARY'),
    aiLimiter,
    generateDailySummary
);

export default router;
