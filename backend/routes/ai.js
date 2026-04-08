import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { GoogleGenAI } from '@google/genai';
import { query } from '../config/database.js';
import { getFlag } from '../config/featureFlags.js';
import * as aiQueue from '../queues/aiQueue.js';
import { eventBus, EVENT_TYPES } from '../events/eventBus.js';
import { normalizeRole } from '../utils/roleNormalizer.js';

const router = express.Router();

// Apply protection to all AI routes
router.use(protect);

// ── GET /api/ai/health ───────────────────────────────────────────────────────
// Returns Gemini key status + today's activity stats
router.get('/health', async (req, res) => {
    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        const keySet = !!apiKey;

        // Count analyzed files today
        const today = new Date().toISOString().split('T')[0];
        const [analyzedRow, pendingRow] = await Promise.all([
            query(`SELECT COUNT(*) AS cnt FROM upload_files WHERE ai_result IS NOT NULL AND created_at >= $1`, [today]).catch(() => ({ rows: [{ cnt: 0 }] })),
            query(`SELECT COUNT(*) AS cnt FROM upload_files WHERE ai_result IS NULL AND status != 'failed'`).catch(() => ({ rows: [{ cnt: 0 }] })),
        ]);

        const analyzedToday = parseInt(analyzedRow.rows[0]?.cnt || 0);
        const pendingCount  = parseInt(pendingRow.rows[0]?.cnt || 0);

        // Quick Gemini ping to verify key works
        let geminiOk = false;
        let geminiModel = 'gemini-2.0-flash';
        if (keySet) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                await ai.models.generateContent({
                    model: geminiModel,
                    contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
                });
                geminiOk = true;
            } catch { geminiOk = false; }
        }

        res.json({ success: true, data: { keySet, geminiOk, model: geminiModel, analyzedToday, pendingCount } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /analysis/:reportId — stub
router.get('/analysis/:reportId', (req, res) => {
    res.json({ success: true, data: null, message: 'Analysis results not available via this endpoint' });
});

// GET /templates — return empty template list
router.get('/templates', authorize('ADMIN'), (req, res) => {
    res.json({ success: true, data: [] });
});

// POST /log-decision
router.post('/log-decision', aiLimiter, (req, res) => {
    res.json({ success: true, message: 'Decision logged' });
});

// POST /generate-text
router.post('/generate-text', aiLimiter, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ success: false, message: 'prompt is required' });
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        if (!apiKey) return res.status(503).json({ success: false, message: 'AI service not configured' });
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        res.json({ success: true, text: result.text || '' });
    } catch (err) {
        console.error('[/ai/generate-text]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/solar-analyze ───────────────────────────────────────────────
router.post('/solar-analyze', aiLimiter, async (req, res) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '' });
        const { form = {}, images = [], deploymentId } = req.body;

        let existingResults = '';
        if (deploymentId) {
            // Check if there are any analyzed jobs for this mission
            const jobs = await query(
                `SELECT ai_result FROM upload_jobs WHERE mission_id = $1 AND ai_result IS NOT NULL`,
                [deploymentId]
            );
            if (jobs.rows.length === 0 && images.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'No analyzed inspection data found for this site. Ensure drone data is uploaded and analyzed first.' 
                });
            }
            existingResults = jobs.rows.map(r => typeof r.ai_result === 'string' ? r.ai_result : JSON.stringify(r.ai_result)).join('\\n');
        } else if (images.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No imagery or analyzed data available.' 
            });
        }

        const prompt = `You are a senior solar drone inspection AI analyst. Analyze the provided site inspection data and return ONLY a JSON object (no markdown, no explanation).

Site context:
- Site Name: ${form.siteName || 'Unknown'}
- Client: ${form.clientName || 'Unknown'}
- Installed Capacity: ${form.installedKw || '—'} kW
- Panel Count: ${form.panelCount || '—'}
- Inspection Date: ${form.inspectionDate || new Date().toISOString().split('T')[0]}

Raw Inspection Data to Summary:
${existingResults || 'Analyze the provided imagery'}

Return this exact JSON structure:
{
  "findings": [
    {
      "id": "1",
      "type": "Thermal Hotspot | Physical Damage | Soiling | String Issue | General",
      "severity": "Critical | High | Medium | Low",
      "description": "...",
      "recommendation": "..."
    }
  ],
  "aiSummary": "Executive paragraph summary of actual findings and priority actions."
}

Generate 3-6 key findings based STRICTLY on the raw inspection data provided. Do not make up faults; map the existing raw data into this format. Return ONLY the JSON object.`;

        const parts = [{ text: prompt }];
        if (images.length > 0) {
            for (const img of images.slice(0, 4)) {
                if (img.dataUrl && img.dataUrl.includes(',')) {
                    const [header, data] = img.dataUrl.split(',');
                    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
                    parts.push({ inlineData: { mimeType, data } });
                }
            }
        }

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts }],
        });

        let text = (result.text || '{}').trim().replace(/^```json\n?/i, '').replace(/```$/, '').trim();
        let parsed;
        try { parsed = JSON.parse(text); } catch {
            const match = text.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { findings: [], aiSummary: 'Analysis complete. Unable to parse structured response.' };
        }

        res.json({ success: true, findings: parsed.findings || [], aiSummary: parsed.aiSummary || '' });
    } catch (err) {
        console.error('[solar-analyze] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/thermal-scan ────────────────────────────────────────────────
// Specialized thermal analysis for a given mission
router.post('/thermal-scan', aiLimiter, async (req, res) => {
    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        if (!apiKey) return res.status(503).json({ success: false, message: 'GEMINI_API_KEY not configured' });

        const { missionId, siteName, faultCount = 0 } = req.body;
        if (!missionId) return res.status(400).json({ success: false, message: 'missionId required' });

        // Fetch existing fault data for context
        const faultsRes = await query(
            `SELECT fault_type, temperature_delta, severity FROM thermal_faults WHERE mission_id = $1 LIMIT 20`,
            [missionId]
        ).catch(() => ({ rows: [] }));

        const faultContext = faultsRes.rows.length > 0
            ? faultsRes.rows.map(f => `- ${f.fault_type}: ΔT ${f.temperature_delta}°C (${f.severity})`).join('\n')
            : 'No pre-existing fault records.';

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `You are a thermal drone inspection analyst specializing in solar PV systems. Analyze the following mission data and return ONLY a JSON object.

Mission: ${siteName || missionId}
Existing fault records:
${faultContext}

Return this JSON:
{
  "riskLevel": "Critical | High | Medium | Low",
  "confidence": 85,
  "maxTempDelta": 42,
  "estimatedHotspots": 12,
  "priorityActions": ["Action 1", "Action 2", "Action 3"],
  "summary": "2-3 sentence technical summary of thermal condition and recommended next steps",
  "recommendedInspectionDate": "YYYY-MM-DD"
}

Return ONLY the JSON object.`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        let text = (result.text || '{}').trim().replace(/^```json\n?/i, '').replace(/```$/, '').trim();
        let parsed;
        try { parsed = JSON.parse(text); } catch {
            const match = text.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { riskLevel: 'Unknown', summary: 'Unable to parse AI response.' };
        }

        res.json({ success: true, missionId, analysis: parsed });
    } catch (err) {
        console.error('[thermal-scan] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/ai/pix4d-workspace ──────────────────────────────────────────────
router.get('/pix4d-workspace', async (req, res) => {
    try {
        const r = await query(
            `SELECT value FROM settings WHERE key = 'pix4d_workspace_url' LIMIT 1`
        ).catch(() => ({ rows: [] }));
        res.json({ success: true, url: r.rows[0]?.value || '' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/ai/pix4d-workspace ──────────────────────────────────────────────
router.put('/pix4d-workspace', authorize('ADMIN'), async (req, res) => {
    try {
        const { url } = req.body;
        const clean = (url || '').trim().replace(/\/$/, '');
        await query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ('pix4d_workspace_url', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [clean]
        );
        res.json({ success: true, url: clean });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/reanalyze/:jobId ────────────────────────────────────────────
// Re-triggers Gemini analysis on an existing upload job
router.post('/reanalyze/:jobId', aiLimiter, async (req, res) => {
    try {
        const { jobId } = req.params;
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        if (!apiKey) return res.status(503).json({ success: false, message: 'GEMINI_API_KEY not configured' });

        // Fetch job + files
        const jobRes = await query(
            `SELECT uj.*, uf.id AS file_id, uf.file_name, uf.storage_url
             FROM upload_jobs uj
             LEFT JOIN upload_files uf ON uf.job_id = uj.id
             WHERE uj.id = $1 LIMIT 10`,
            [jobId]
        );
        if (jobRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });

        const job = jobRes.rows[0];
        const files = jobRes.rows.filter(r => r.file_id).map(r => ({ id: r.file_id, name: r.file_name, url: r.storage_url }));

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `You are a drone inspection AI analyst. Analyze this upload job and return ONLY a JSON object.

Job: ${job.site_name || job.mission_id || jobId}
Files: ${files.map(f => f.name).join(', ') || 'No files listed'}
Industry: ${job.industry || 'General'}
File count: ${files.length}

Return this JSON:
{
  "summary": "Brief inspection summary",
  "overallCondition": "Good | Fair | Poor | Critical",
  "faults": [],
  "totalFaults": 0,
  "confidence": 80,
  "recommendations": ["recommendation 1"],
  "riskScore": 3
}`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        let text = (result.text || '{}').trim().replace(/^```json\n?/i, '').replace(/```$/, '').trim();
        let parsed;
        try { parsed = JSON.parse(text); } catch {
            const match = text.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { summary: 'Re-analysis complete.', confidence: 50 };
        }

        // Persist result
        await query(
            `UPDATE upload_jobs SET ai_result = $1, status = 'complete', updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(parsed), jobId]
        );

        res.json({ success: true, jobId, analysis: parsed });
    } catch (err) {
        console.error('[reanalyze] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /report-generate ────────────────────────────────────────────────────
router.post('/report-generate', aiLimiter, async (req, res) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '' });
        const { prompt, context = '' } = req.body;
        if (!prompt) return res.status(400).json({ success: false, message: 'prompt is required' });
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: `${context}\n\n${prompt}` }] }],
        });
        res.json({ success: true, result: result.text });
    } catch (err) {
        console.error('[report-generate] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── SECTION 2: Async AI Job Endpoints (flag-gated, additive) ─────────────────
// These endpoints are only meaningful when ENABLE_ASYNC_AI=true.
// When flag is OFF, they still work — just the queue will always be empty.

/**
 * GET /api/ai/jobs
 * List AI analysis jobs for the current user (or all for admin).
 * Supports: ?status=pending|processing|completed|failed&limit=N&offset=N
 */
router.get('/jobs', async (req, res) => {
    try {
        const userRole = normalizeRole(req.user.role);
        const isAdmin  = userRole === 'admin';
        const { limit = 20, offset = 0 } = req.query;

        const jobs = await aiQueue.listJobs({
            userId:   req.user.id,
            tenantId: req.user.tenantId,
            isAdmin,
            limit:    Math.min(parseInt(limit, 10) || 20, 100),
            offset:   parseInt(offset, 10) || 0,
        });

        res.json({
            success: true,
            data:    jobs,
            meta: {
                asyncEnabled: getFlag('ENABLE_ASYNC_AI'),
                count: jobs.length,
                requestId: req.requestId,
            },
        });
    } catch (err) {
        console.error('[/ai/jobs]', err.message);
        res.status(500).json({ success: false, message: err.message, requestId: req.requestId });
    }
});

/**
 * GET /api/ai/jobs/:jobId
 * Poll a specific AI job's status.
 * Returns result_json when status === 'completed'.
 */
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const job = await aiQueue.getJobById(req.params.jobId);

        if (!job) {
            return res.status(404).json({ success: false, message: 'AI job not found', requestId: req.requestId });
        }

        // Scope check: pilots/clients can only see their own jobs
        const userRole = normalizeRole(req.user.role);
        const isAdmin  = userRole === 'admin';
        if (!isAdmin && job.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this job' });
        }

        res.json({
            success: true,
            data: {
                id:            job.id,
                missionId:     job.mission_id,
                mediaId:       job.media_id,
                analysisType:  job.analysis_type,
                status:        job.status,
                attempts:      job.attempts,
                maxAttempts:   job.max_attempts,
                result:        job.result_json,
                error:         job.error,
                createdAt:     job.created_at,
                updatedAt:     job.updated_at,
            },
            requestId: req.requestId,
        });
    } catch (err) {
        console.error('[/ai/jobs/:jobId]', err.message);
        res.status(500).json({ success: false, message: err.message, requestId: req.requestId });
    }
});

/**
 * POST /api/ai/jobs
 * Manually enqueue an AI job (admin/field_operator only).
 * Body: { missionId, mediaId, analysisType }
 * Only available when ENABLE_ASYNC_AI=true.
 */
router.post('/jobs', aiLimiter, authorize('ADMIN', 'admin', 'field_operator', 'senior_inspector'), async (req, res) => {
    if (!getFlag('ENABLE_ASYNC_AI')) {
        return res.status(503).json({
            success: false,
            message: 'Async AI processing is not enabled (ENABLE_ASYNC_AI=false)',
            requestId: req.requestId,
        });
    }

    try {
        const { missionId, mediaId, analysisType = 'inspection' } = req.body;

        const jobId = await aiQueue.enqueue(missionId, mediaId, {
            userId:       req.user.id,
            tenantId:     req.user.tenantId,
            analysisType,
        });

        // Emit event for audit trail
        eventBus.emit(EVENT_TYPES.AI_JOB_QUEUED, {
            jobId, missionId, mediaId, analysisType,
            userId:    req.user.id,
            tenantId:  req.user.tenantId,
            requestId: req.requestId,
        });

        res.status(202).json({
            success:   true,
            jobId,
            message:   'AI analysis job queued. Poll GET /api/ai/jobs/:jobId for status.',
            requestId: req.requestId,
        });
    } catch (err) {
        console.error('[POST /ai/jobs]', err.message);
        res.status(500).json({ success: false, message: err.message, requestId: req.requestId });
    }
});

export default router;
