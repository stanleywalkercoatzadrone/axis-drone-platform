import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { aiService } from '../services/aiService.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Get AI analysis results for a specific report
 */
export const getAnalysisResults = async (req, res, next) => {

    try {
        const { reportId } = req.params;

        const result = await query(
            `SELECT aar.*, ad.model_version, ad.confidence_score as decision_confidence
             FROM ai_analysis_results aar
             LEFT JOIN ai_decisions ad ON aar.decision_id = ad.id
             WHERE aar.report_id = $1
             ORDER BY aar.created_at DESC`,
            [reportId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Log a new AI decision (Audit trail)
 */
export const logDecision = async (req, res, next) => {
    try {
        const { requestId, endpoint, inputData, outputData, modelVersion, promptVersion, confidenceScore, processingTimeMs, tokenCount, metadata } = req.body;

        const result = await query(
            `INSERT INTO ai_decisions (
                request_id, user_id, endpoint, input_data, output_data, 
                model_version, prompt_version, confidence_score, 
                processing_time_ms, token_count, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                requestId, req.user.id, endpoint,
                JSON.stringify(inputData), JSON.stringify(outputData),
                modelVersion, promptVersion, confidenceScore,
                processingTimeMs, tokenCount, JSON.stringify(metadata || {})
            ]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get active prompt templates
 */
export const getPromptTemplates = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM ai_prompt_templates WHERE is_active = TRUE ORDER BY name, version DESC'
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Generate daily operational summary
 */
export const generateDailySummary = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) throw new AppError('Date is required', 400);

        // Fetch daily logs and mission data for the prompt
        const logsRes = await query(
            `SELECT dl.*, p.full_name as pilot_name, d.title as mission_title 
             FROM daily_logs dl
             JOIN personnel p ON dl.technician_id = p.id
             JOIN deployments d ON dl.deployment_id = d.id
             WHERE dl.date = $1`,
            [date]
        );

        const summaryData = {
            date,
            dailyLogs: logsRes.rows,
            missionData: logsRes.rows.reduce((acc, log) => {
                if (!acc[log.mission_title]) acc[log.mission_title] = [];
                acc[log.mission_title].push(log);
                return acc;
            }, {}),
            totalCost: logsRes.rows.reduce((sum, log) => sum + Number(log.daily_pay || 0) + Number(log.bonus_pay || 0), 0)
        };

        const result = await aiService.generateDailyOperationalSummary(summaryData, req.user.id);

        res.json({
            success: true,
            data: result.data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Generate text using Gemini — used for report narrative, summaries, etc.
 */
export const generateText = async (req, res, next) => {
    try {
        const { prompt } = req.body;
        if (!prompt) throw new AppError('Prompt is required', 400);

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
        if (!apiKey) throw new AppError('AI not configured: GEMINI_API_KEY missing', 503);

        const ai = new GoogleGenAI({ apiKey });

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        const text = result.text || '{}';
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = { summary: text, recommendations: [] };
        }

        res.json({ success: true, data: parsed });
    } catch (error) {
        next(error);
    }
};

