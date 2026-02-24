/**
 * AI Service - Core LLM Integration
 * Provides structured reasoning engine for inspection intelligence
 * 
 * Design Principles:
 * - LLM as reasoning engine, NOT chatbot
 * - Structured outputs only
 * - Schema validation enforced
 * - Confidence scoring required
 * - Full audit trail
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger.js';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL_VERSION = 'gemini-1.5-pro';
const PROMPT_VERSION = '1.0.0';

// Initialize Gemini client
let genAI;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
    logger.warn('GEMINI_API_KEY not set - AI features will be disabled');
}

/**
 * Retry configuration for LLM calls
 */
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
};

/**
 * Sleep utility for retry backoff
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute LLM call with retry logic
 */
async function executeWithRetry(fn, retries = RETRY_CONFIG.maxRetries) {
    let lastError;
    let delay = RETRY_CONFIG.initialDelay;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            if (error.message?.includes('API key') || error.message?.includes('authentication')) {
                throw error;
            }

            if (attempt < retries) {
                logger.warn(`LLM call failed, retrying (${attempt + 1}/${retries})`, {
                    error: error.message,
                    delay
                });
                await sleep(delay);
                delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelay);
            }
        }
    }

    throw lastError;
}

/**
 * Get prompt template from database
 */
async function getPromptTemplate(name, version = null) {
    const versionClause = version ? 'AND version = $2' : 'AND is_active = TRUE ORDER BY created_at DESC LIMIT 1';
    const params = version ? [name, version] : [name];

    const result = await query(
        `SELECT * FROM ai_prompt_templates WHERE name = $1 ${versionClause}`,
        params
    );

    if (result.rows.length === 0) {
        throw new Error(`Prompt template '${name}' not found`);
    }

    return result.rows[0];
}

/**
 * Render prompt template with variables
 */
function renderTemplate(template, variables) {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return rendered;
}

/**
 * Parse and validate JSON response from LLM
 */
function parseStructuredResponse(text) {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    try {
        return JSON.parse(jsonText.trim());
    } catch (error) {
        logger.error('Failed to parse LLM response as JSON', {
            error: error.message,
            response: text.substring(0, 500)
        });
        throw new Error('LLM returned invalid JSON response');
    }
}

/**
 * Log AI decision to audit trail
 */
async function logDecision(userId, endpoint, input, output, metadata = {}) {
    const requestId = uuidv4();
    const processingTime = metadata.processingTime || 0;
    const tokenCount = metadata.tokenCount || null;
    const confidenceScore = metadata.confidenceScore || null;

    try {
        await query(
            `INSERT INTO ai_decisions (
        request_id, user_id, endpoint, input_data, output_data,
        model_version, prompt_version, confidence_score,
        processing_time_ms, token_count, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                requestId,
                userId,
                endpoint,
                JSON.stringify(input),
                JSON.stringify(output),
                MODEL_VERSION,
                PROMPT_VERSION,
                confidenceScore,
                processingTime,
                tokenCount,
                JSON.stringify(metadata)
            ]
        );

        logger.logAIOperation(endpoint, input, output, {
            requestId,
            userId,
            processingTime,
            confidenceScore
        });

        return requestId;
    } catch (error) {
        logger.error('Failed to log AI decision', { error: error.message });
        // Don't throw - logging failure shouldn't break the operation
        return null;
    }
}

/**
 * Update usage metrics
 */
async function updateUsageMetrics(userId, endpoint, tokenCount, processingTime) {
    try {
        await query(
            `INSERT INTO ai_usage_metrics (user_id, date, endpoint, request_count, total_tokens, total_processing_time_ms)
       VALUES ($1, CURRENT_DATE, $2, 1, $3, $4)
       ON CONFLICT (user_id, date, endpoint)
       DO UPDATE SET
         request_count = ai_usage_metrics.request_count + 1,
         total_tokens = ai_usage_metrics.total_tokens + $3,
         total_processing_time_ms = ai_usage_metrics.total_processing_time_ms + $4`,
            [userId, endpoint, tokenCount || 0, processingTime]
        );
    } catch (error) {
        logger.error('Failed to update usage metrics', { error: error.message });
    }
}

/**
 * Main AI Service Class
 */
class AIService {
    constructor() {
        this.model = genAI ? genAI.getGenerativeModel({ model: MODEL_VERSION }) : null;
    }

    /**
     * Check if AI service is available
     */
    isAvailable() {
        return this.model !== null;
    }

    /**
     * Generate structured response from LLM
     */
    async generateStructured(promptName, variables, userId, endpoint) {
        if (!this.isAvailable()) {
            throw new Error('AI service is not available - GEMINI_API_KEY not configured');
        }

        const startTime = Date.now();

        try {
            // Get prompt template
            const template = await getPromptTemplate(promptName);
            const prompt = renderTemplate(template.template, variables);

            logger.debug('Executing AI request', {
                promptName,
                promptVersion: template.version,
                userId,
                endpoint
            });

            // Execute LLM call with retry
            const { text, usage } = await executeWithRetry(async () => {
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                return {
                    text: response.text(),
                    usage: response.usageMetadata
                };
            });

            // Parse structured response
            const structured = parseStructuredResponse(text);

            const processingTime = Date.now() - startTime;
            const tokenCount = usage?.totalTokenCount || 0;

            // Log decision
            const requestId = await logDecision(
                userId,
                endpoint,
                { promptName, variables },
                structured,
                {
                    processingTime,
                    tokenCount,
                    promptVersion: template.version,
                    modelVersion: MODEL_VERSION
                }
            );

            // Update usage metrics
            await updateUsageMetrics(userId, endpoint, tokenCount, processingTime);

            return {
                requestId,
                data: structured,
                metadata: {
                    model_version: MODEL_VERSION,
                    token_count: tokenCount,
                    provider: 'Google Gemini',
                    latency: processingTime
                }
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;

            logger.error('AI generation failed', {
                error: error.message,
                promptName,
                userId,
                endpoint,
                processingTime
            });

            throw error;
        }
    }

    /**
     * Analyze inspection data
     */
    async analyzeInspection(data, userId) {
        const variables = {
            industry: data.industry || 'General',
            client: data.client || 'Unknown',
            image_count: data.images?.length || 0,
            metadata: JSON.stringify(data.metadata || {})
        };

        return this.generateStructured(
            'inspection_analysis',
            variables,
            userId,
            '/api/v1/analyze/report'
        );
    }

    /**
     * Detect anomalies in image
     */
    async detectAnomalies(imageData, industry, userId) {
        const variables = {
            industry: industry || 'General',
            image_url: imageData.url || '',
            context: JSON.stringify(imageData.context || {})
        };

        return this.generateStructured(
            'anomaly_detection',
            variables,
            userId,
            '/api/v1/analyze/image'
        );
    }

    /**
     * Validate mission readiness
     */
    async validateMissionReadiness(missionData, userId) {
        const variables = {
            assets: JSON.stringify(missionData.assets || []),
            personnel: JSON.stringify(missionData.personnel || []),
            weather: JSON.stringify(missionData.weather || {}),
            regulations: JSON.stringify(missionData.regulations || [])
        };

        return this.generateStructured(
            'mission_readiness',
            variables,
            userId,
            '/api/v1/analyze/mission'
        );
    }

    /**
     * Generate daily operational summary
     */
    async generateDailyOperationalSummary(summaryData, userId) {
        const variables = {
            date: summaryData.date,
            mission_data: JSON.stringify(summaryData.missionData || {}),
            daily_logs: JSON.stringify(summaryData.dailyLogs || []),
            total_cost: summaryData.totalCost || 0
        };

        return this.generateStructured(
            'daily_operational_summary',
            variables,
            userId,
            '/api/v1/analyze/daily-summary'
        );
    }
}

// Export singleton instance
const aiService = new AIService();

export { aiService, AIService };
