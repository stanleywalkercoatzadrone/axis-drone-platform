/**
 * aiPipeline.js — Gemini AI Analysis hook for processed orthomosaic outputs.
 *
 * Called after ODM completes. Sends the output GCS URI to Gemini Vision
 * for defect detection, solar panel analysis, or general inspection.
 */
import { logger } from './logger.js';
import { saveAIResults } from './uploadStatus.js';
import { uploadJSONToGCS } from './storage.js';
import { query } from '../config/database.js';

let genAI = null;

// Lazy-init Gemini client
async function getGenAI() {
    if (genAI) return genAI;
    try {
        const { GoogleGenAI } = await import('@google/genai');
        const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!key) { logger.warn('[AI] No Gemini API key set'); return null; }
        genAI = new GoogleGenAI({ apiKey: key });
        return genAI;
    } catch (e) {
        logger.error(`[AI] Gemini init failed: ${e.message}`);
        return null;
    }
}

/**
 * Run AI analysis on processed outputs.
 * @param {string} jobId         — pipeline_jobs.id
 * @param {string} datasetId     — mission_datasets.id
 * @param {object} processedResult  — { orthomosaicGcsUri, gcsAIPrefix, … }
 */
export async function triggerAIAnalysis(jobId, datasetId, processedResult) {
    logger.info(`[AI] Starting analysis for job ${jobId}`);

    try {
        const ai = await getGenAI();

        if (!ai || !processedResult.orthomosaicGcsUri) {
            // Fallback: mock analysis when Gemini is unavailable
            logger.warn('[AI] Using mock analysis (no Gemini client or no output URI)');
            return await runMockAnalysis(jobId, datasetId, processedResult);
        }

        return await runGeminiAnalysis(ai, jobId, datasetId, processedResult);

    } catch (err) {
        logger.error(`[AI] Analysis failed: ${err.message}`);
        // Non-fatal — store partial result
        const fallback = { error: err.message, defects_detected: 0, severity: 'unknown', notes: 'AI analysis failed' };
        await saveAIResults(jobId, datasetId, fallback);
        return fallback;
    }
}

/**
 * Gemini Vision analysis on the orthomosaic GCS URI.
 */
async function runGeminiAnalysis(ai, jobId, datasetId, processedResult) {
    // Get mission context for the prompt
    const dsRes = await query(
        `SELECT md.mission_id, d.title as mission_title, d.location
         FROM mission_datasets md
         JOIN deployments d ON d.id = md.mission_id
         WHERE md.id = $1`,
        [datasetId]
    );
    const ctx = dsRes.rows[0] || {};

    const prompt = `You are an expert aerial drone inspection AI specializing in solar farm analysis.
Analyze this orthomosaic image from mission: "${ctx.mission_title || 'Unknown'}" at ${ctx.location || 'unknown location'}.

Provide a structured JSON response with:
{
  "defects_detected": <number>,
  "severity": "low|medium|high|critical",
  "coverage_quality": "poor|fair|good|excellent",
  "notes": "<brief summary>",
  "issues": [{"type": "<type>", "severity": "<level>", "location": "<description>", "confidence": 0.0-1.0}],
  "recommendations": ["<action>"],
  "estimated_gsd_cm": <number or null>,
  "cloud_coverage_pct": <number or null>
}

Focus on: panel damage, soiling, shadows, hotspots, structural issues, coverage gaps.
Return ONLY valid JSON, no markdown.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
            role: 'user',
            parts: [
                { fileData: { fileUri: processedResult.orthomosaicGcsUri, mimeType: 'image/tiff' } },
                { text: prompt },
            ]
        }]
    });

    let analysis;
    try {
        const raw = response.text?.trim() || '{}';
        analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
        analysis = { defects_detected: 0, severity: 'unknown', notes: response.text?.slice(0, 500) || 'Parse error' };
    }

    // Store AI JSON result to GCS ai/ prefix
    const aiJsonPath = `${processedResult.gcsAIPrefix || `missions/unknown/ai/${datasetId}/`}analysis.json`;
    const aiGcsUri = await uploadJSONToGCS(analysis, aiJsonPath);

    // Update dataset with AI analysis path
    await query(
        `UPDATE mission_datasets SET ai_analysis_path = $2, updated_at = NOW() WHERE id = $1`,
        [datasetId, aiGcsUri]
    );

    await saveAIResults(jobId, datasetId, analysis);
    logger.info(`[AI] Gemini analysis complete for job ${jobId}: ${analysis.defects_detected} defects, severity=${analysis.severity}`);
    return analysis;
}

/**
 * Mock analysis — used when Gemini unavailable or in dev.
 */
async function runMockAnalysis(jobId, datasetId, processedResult) {
    await new Promise(r => setTimeout(r, 800)); // simulate latency
    const analysis = {
        defects_detected: Math.floor(Math.random() * 20),
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        coverage_quality: 'good',
        notes: 'Mock AI analysis — Gemini not configured or running in dev mode.',
        issues: [],
        recommendations: ['Configure GEMINI_API_KEY for live AI analysis'],
        estimated_gsd_cm: 2.0,
        engine: 'mock',
    };
    await saveAIResults(jobId, datasetId, analysis);
    return analysis;
}
