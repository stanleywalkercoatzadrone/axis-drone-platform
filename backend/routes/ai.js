import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '../config/database.js';

const router = express.Router();

// Cache Gemini health ping for 5 minutes — stops burning rate limits on every page load
let _ghCache = { ok: false, ts: 0 };
const GH_TTL = 5 * 60 * 1000;

// ── GET /api/ai/health — PUBLIC (no auth required) ───────────────────────────
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

        // Only re-ping Gemini if cache is stale — prevents burning rate limits
        const geminiModel = 'gemini-2.0-flash';
        let geminiOk = _ghCache.ok;
        if (keySet && (Date.now() - _ghCache.ts > GH_TTL)) {
            try {
                const ai = new GoogleGenerativeAI(apiKey);
                const model = ai.getGenerativeModel({ model: geminiModel });
                await model.generateContent('ping');
                geminiOk = true;
            } catch (pErr) {
                console.error('Gemini Health Check Failed:', pErr.message);
                geminiOk = false;
            }
            _ghCache = { ok: geminiOk, ts: Date.now() };
        }

        res.json({ success: true, data: { keySet, geminiOk, model: geminiModel, analyzedToday, pendingCount } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/ai/geocode/search?q= — PUBLIC proxy to Nominatim forward geocode ─
// Avoids browser CSP/CORS issues by making the request server-side
router.get('/geocode/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, message: 'q is required' });
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
        const r = await fetch(url, {
            headers: {
                'User-Agent': 'AxisDronePlatform/1.0 (axisplatform.app)',
                'Referer': 'https://axisplatform.app',
            }
        });
        if (!r.ok) return res.status(502).json({ success: false, message: `Geocode upstream error: ${r.status}` });
        const data = await r.json();
        res.json({ success: true, results: data });
    } catch (err) {
        console.error('[geocode/search]', err.message);
        res.status(502).json({ success: false, message: 'Geocode service unavailable' });
    }
});

// ── GET /api/ai/geocode/reverse?lat=&lon= — PUBLIC proxy to Nominatim reverse ─
router.get('/geocode/reverse', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ success: false, message: 'lat and lon are required' });
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
        const r = await fetch(url, {
            headers: {
                'User-Agent': 'AxisDronePlatform/1.0 (axisplatform.app)',
                'Referer': 'https://axisplatform.app',
            }
        });
        if (!r.ok) return res.status(502).json({ success: false, message: `Reverse geocode upstream error: ${r.status}` });
        const data = await r.json();
        res.json({ success: true, result: data });
    } catch (err) {
        console.error('[geocode/reverse]', err.message);
        res.status(502).json({ success: false, message: 'Geocode service unavailable' });
    }
});

// ── GET /api/ai/weather/ensemble?lat=&lon=&days= — PUBLIC proxy to Open-Meteo Ensemble API ─
// Returns merged (member-averaged) 30-day daily forecast. Bypasses browser CSP.
router.get('/weather/ensemble', async (req, res) => {
    const { lat, lon, days = '30' } = req.query;
    if (!lat || !lon) return res.status(400).json({ success: false, message: 'lat and lon are required' });
    try {
        const dailyVars = [
            'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
            'wind_speed_10m_max', 'uv_index_max',
            'weather_code', 'precipitation_probability_max',
        ];
        const url = `https://ensemble-api.open-meteo.com/v1/ensemble` +
            `?latitude=${lat}&longitude=${lon}` +
            `&models=gfs_seamless` +
            `&daily=${dailyVars.join(',')}` +
            `&temperature_unit=fahrenheit` +
            `&wind_speed_unit=kmh` +
            `&forecast_days=${days}` +
            `&timezone=auto`;

        const r = await fetch(url);
        if (!r.ok) return res.status(502).json({ success: false, message: `Ensemble API error: ${r.status}` });
        const raw = await r.json();

        if (!raw.daily?.time) {
            return res.status(502).json({ success: false, message: 'Ensemble API returned no daily data' });
        }

        // Fields where we use MODE (most common value) — averaging WMO codes produces
        // meaningless floats like 39.4 that don't map to any WMO condition label.
        const modeFields = new Set(['weather_code']);

        // Returns the most frequently occurring integer value in an array
        const mode = (arr) => {
            const freq = {};
            let maxCount = 0, result = Math.round(arr[0]);
            for (const v of arr) {
                const k = Math.round(v);
                freq[k] = (freq[k] || 0) + 1;
                if (freq[k] > maxCount) { maxCount = freq[k]; result = k; }
            }
            return result;
        };

        const merged = { time: raw.daily.time };
        for (const field of dailyVars) {
            const memberKeys = Object.keys(raw.daily).filter(
                k => k === field || k.startsWith(field + '_member')
            );
            if (!memberKeys.length) { merged[field] = []; continue; }

            const len = raw.daily[memberKeys[0]].length;
            merged[field] = Array.from({ length: len }, (_, i) => {
                const vals = memberKeys
                    .map(k => raw.daily[k][i])
                    .filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
                if (!vals.length) return 0;

                if (modeFields.has(field)) {
                    return mode(vals);          // most common WMO code
                }
                // Ensemble mean, rounded to 1 decimal place
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                return Math.round(mean * 10) / 10;
            });
        }

        // Fill sunrise/sunset as empty (not in ensemble model)
        merged.sunrise = raw.daily.time.map(() => '');
        merged.sunset  = raw.daily.time.map(() => '');

        res.json({ success: true, daily: merged });
    } catch (err) {
        console.error('[weather/ensemble]', err.message);
        res.status(502).json({ success: false, message: 'Ensemble forecast unavailable' });
    }
});

// Apply protection to all remaining AI routes
router.use(protect);

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
        
        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text() || '';
        res.json({ success: true, text });
    } catch (err) {
        console.error('[/ai/generate-text]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/solar-analyze ───────────────────────────────────────────────
router.post('/solar-analyze', aiLimiter, async (req, res) => {
    try {
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

        const prompt = `You are a Senior Solar PV Inspector and AI Analyst. Analyze the provided site inspection data and imagery to identify technical defects. 

Site context:
- Site Name: ${form.siteName || 'Unknown'}
- Client: ${form.clientName || 'Unknown'}
- Installed Capacity: ${form.installedKw || '—'} kW
- Panel Count: ${form.panelCount || '—'}
- Panel Model: ${form.panelMake || '—'}
- Inspection Date: ${form.inspectionDate || new Date().toISOString().split('T')[0]}

Analysis Guidelines:
1. **Defect Recognition**: 
   - Look for 'Thermal Hotspots' (individual cell overheating).
   - Identify 'Bypass Diode Failures' (typically visible as 1/3 rectangular block of the panel being warmer).
   - Identify 'String Failures' (entire rows of panels showing uniform elevated temperature).
   - Distinguish 'Soiling/Shading' from internal electrical faults.
2. **Prioritization**:
   - CRITICAL: Safety risks or >10% string power loss.
   - HIGH: Major hotspots or diode failures in high-yield areas.
   - MEDIUM/LOW: Minor soiling or tracking issues.
3. **Data Synthesis**: Use the raw inspection results below to generate specific finding records.

Raw Inspection Context:
${existingResults || 'Analyze the provided imagery for anomalies.'}

Return ONLY a JSON object with this structure:
{
  "findings": [
    {
      "id": "UX_ID",
      "type": "Thermal Hotspot | Diode Failure | String Outage | Physical Damage | Soiling",
      "severity": "Critical | High | Medium | Low",
      "location": "Specify row/block if possible",
      "description": "Technical observation of the anomaly.",
      "recommendation": "Corrective action (e.g., bypass diode replacement, panel cleaning, electrical testing)",
      "estimatedKwhLoss": 12.5,
      "estimatedCostMin": 150
    }
  ],
  "aiSummary": "Executive summary of plant health and highest-impact issues."
}

Return ONLY the raw JSON object. Do not include markdown or explanations.`;

        const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '');
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        
        const parts = [{ text: prompt }];
        if (images.length > 0) {
            for (const img of images.slice(0, 20)) {
                if (img.dataUrl && img.dataUrl.includes(',')) {
                    const [header, data] = img.dataUrl.split(',');
                    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
                    parts.push({ inlineData: { mimeType, data } });
                }
            }
        }

        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const rawText = result.response.text() || '{}';
        let text = rawText.trim().replace(/^```json\n?/i, '').replace(/```$/, '').trim();
        
        let parsed;
        try { 
            parsed = JSON.parse(text); 
        } catch {
            const match = text.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { findings: [], aiSummary: 'Analysis complete. Unable to parse structured response.' };
        }

        res.json({ success: true, findings: parsed.findings || [], aiSummary: parsed.aiSummary || parsed.summary || '' });
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

        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const rawText = result.response.text() || '{}';
        let text = rawText.trim().replace(/^```json\n?/i, '').replace(/```$/, '').trim();
        
        let parsed;
        try { 
            parsed = JSON.parse(text); 
        } catch {
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

        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const rawText = result.response.text() || '{}';
        let text = rawText.trim().replace(/^```json\n?/i, '').replace(/```$/, '').trim();
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
        const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '');
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const { prompt, context = '' } = req.body;
        if (!prompt) return res.status(400).json({ success: false, message: 'prompt is required' });
        const result = await model.generateContent(`${context}\n\n${prompt}`);
        res.json({ success: true, result: result.response.text() });
    } catch (err) {
        console.error('[report-generate] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/reports/save ────────────────────────────────────────────────
// Persists a generated AI report to the mission database
router.post('/reports/save', aiLimiter, async (req, res) => {
    try {
        const { 
            missionId, 
            industry, 
            reportType, 
            reportData, 
            title, 
            filename 
        } = req.body;
        
        if (!missionId) return res.status(400).json({ success: false, message: 'missionId is required' });

        const result = await query(
            `INSERT INTO ai_reports (deployment_id, industry, report_type, report_data, generated_by, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING id, created_at`,
            [
                missionId, 
                industry, 
                reportType || 'Standard', 
                JSON.stringify({ ...reportData, title, filename }), 
                req.user?.id
            ]
        );

        res.json({ 
            success: true, 
            data: result.rows[0],
            message: 'Report saved to mission archive' 
        });
    } catch (err) {
        console.error('[/reports/save] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/ai/reports ────────────────────────────────────────────────────────
// Fetches all AI reports across all missions for the global archive hub
router.get('/reports', async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                r.id, 
                r.industry, 
                r.report_type, 
                r.report_data, 
                r.created_at,
                d.title as mission_title,
                d.site_name,
                d.id as mission_id,
                c.name as client_name
             FROM ai_reports r
             JOIN deployments d ON r.deployment_id = d.id
             LEFT JOIN clients c ON d.client_id = c.id
             ORDER BY r.created_at DESC
             LIMIT 100`
        );
        
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[/api/ai/reports] Global Fetch Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch global reports' });
    }
});

// ── GET /api/ai/reports/mission/:missionId ────────────────────────────────────
// Fetches all reports linked to a specific mission
router.get('/reports/mission/:missionId', async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await query(
            `SELECT id, industry, report_type, report_data, created_at
             FROM ai_reports 
             WHERE deployment_id = $1 
             ORDER BY created_at DESC`,
            [missionId]
        );
        
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[/reports/mission] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/social-post ─────────────────────────────────────────────────
// Generates a social media post via Groq (Llama 3.3 70B) — 14,400 free req/day
router.post('/social-post', aiLimiter, async (req, res) => {
    try {
        const { brief, post_type = 'manual', tone = 'professional', platforms = [], company = 'CoatzaDrone' } = req.body;
        if (!brief) return res.status(400).json({ success: false, message: 'brief is required' });

        const groqKey = process.env.GROQ_API_KEY || '';
        const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        if (!groqKey && !geminiKey) return res.status(503).json({ success: false, message: 'AI service not configured. Add GROQ_API_KEY to environment.' });

        const twitterNote = platforms.includes('twitter') ? ' Keep under 280 characters if possible.' : '';
        const typeContext = {
            job_opening: 'a job opening / hiring announcement for a drone operations company',
            company_news: 'a company news update / milestone announcement for a drone operations company',
            manual: 'a marketing post for a drone operations company',
        }[post_type] || 'a marketing post';

        const toneMap = {
            professional: 'professional, authoritative, and confidence-inspiring',
            casual: 'friendly, approachable, and conversational',
            exciting: 'energetic, exciting, and inspiring with emojis',
        };

        const prompt = `You are an expert social media marketing copywriter for ${company}, a professional drone inspection and aerial services company.

Write ${typeContext} based on this brief:
"${brief}"

Requirements:
- Tone: ${toneMap[tone] || toneMap.professional}
- Include relevant emojis sparingly for engagement
- Add 3-5 relevant hashtags at the end
- Make it compelling and action-oriented
- Keep it concise and impactful${twitterNote}
- Do NOT use placeholder text like [Company Name] — use "${company}" directly

Return ONLY the post text, nothing else. No quotes, no explanation.`;

        let text = '';

        if (groqKey) {
            // Primary: Groq — Llama 3.3 70B, 14,400 free req/day
            const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 512,
                    temperature: 0.7,
                })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error?.message || 'Groq error');
            text = (d.choices?.[0]?.message?.content || '').trim();
        } else {
            // Fallback: Gemini
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const ai = new GoogleGenerativeAI(geminiKey);
            const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const result = await model.generateContent(prompt);
            text = (result.response.text() || '').trim();
        }

        res.json({ success: true, text });
    } catch (err) {
        console.error('[/ai/social-post]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/social-image ─────────────────────────────────────────────────
// Primary: HuggingFace FLUX.1-schnell (HUGGING_FACE_TOKEN) — 1000 free/day, no watermarks
// Fallback: Pollinations.ai (no key, but may be slow under load)
router.post('/social-image', aiLimiter, async (req, res) => {
    try {
        const { prompt: userPrompt, post_type = 'manual', style = 'professional' } = req.body;
        if (!userPrompt) return res.status(400).json({ success: false, message: 'prompt is required' });

        const hfToken = process.env.HUGGING_FACE_TOKEN || '';

        const styleMap = {
            professional: 'professional corporate drone photography, clean polished lighting, photorealistic, 4K',
            cinematic: 'cinematic aerial drone photography, dramatic golden hour lighting, wide angle lens, epic',
            minimal: 'minimalist clean composition, soft natural light, modern and sleek, simple background',
        };

        const fullPrompt = `Drone inspection company social media image: ${userPrompt}. ${styleMap[style] || styleMap.professional}. No text, no watermarks, high quality.`;

        if (hfToken) {
            // Primary: HuggingFace Inference API — FLUX.1-schnell, 1000 free images/day
            const hfRes = await fetch(
                'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${hfToken}`,
                        'Content-Type': 'application/json',
                        'X-Wait-For-Model': 'true',
                    },
                    body: JSON.stringify({ inputs: fullPrompt }),
                }
            );
            if (hfRes.ok) {
                const buffer = await hfRes.arrayBuffer();
                const b64 = Buffer.from(buffer).toString('base64');
                return res.json({ success: true, image: `data:image/jpeg;base64,${b64}` });
            }
            const errText = await hfRes.text().catch(() => '');
            console.error('[/ai/social-image] HF error:', hfRes.status, errText.slice(0, 200));
        }

        // Fallback: Pollinations.ai (no key required)
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1280&height=720&model=flux&nologo=true&enhance=true&seed=${Date.now()}`;
        const imgRes = await fetch(pollinationsUrl, {
            headers: { 'User-Agent': 'AxisDronePlatform/1.0 (axisplatform.app)' }
        });

        if (!imgRes.ok) {
            return res.status(502).json({ success: false, message: 'Image generation unavailable. Add HUGGING_FACE_TOKEN env var for reliable images.' });
        }

        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const buffer = await imgRes.arrayBuffer();
        const b64 = Buffer.from(buffer).toString('base64');
        res.json({ success: true, image: `data:${contentType};base64,${b64}` });
    } catch (err) {
        console.error('[/ai/social-image]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/ai/social-video ────────────────────────────────────────────────
// Generates a full video script via Groq (Llama 3.3 70B)
router.post('/social-video', aiLimiter, async (req, res) => {
    try {
        const { brief, post_type = 'manual', tone = 'professional', duration = '60', company = 'CoatzaDrone' } = req.body;
        if (!brief) return res.status(400).json({ success: false, message: 'brief is required' });

        const groqKey = process.env.GROQ_API_KEY || '';
        const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        if (!groqKey && !geminiKey) return res.status(503).json({ success: false, message: 'AI service not configured. Add GROQ_API_KEY to environment.' });

        const toneMap = {
            professional: 'professional, authoritative, and polished',
            casual: 'friendly, conversational, and relatable',
            exciting: 'high-energy, cinematic, and inspiring',
        };
        const typeContext = {
            job_opening: 'a recruitment video for a drone operations company',
            company_news: 'a company milestone/news announcement video',
            manual: 'a marketing/brand video for a drone operations company',
        }[post_type] || 'a marketing video';

        const wordCount = Math.round(parseInt(duration) * 2.5);
        const prompt = `You are an expert video scriptwriter for ${company}, a professional drone inspection and aerial services company.

Create a complete ${duration}-second video script for ${typeContext}:
"${brief}"

Tone: ${toneMap[tone] || toneMap.professional}

Return ONLY valid JSON, no markdown:
{
  "title": "Short punchy title",
  "hook": "Opening line (first 3 seconds, grab attention)",
  "narration": "Full voice-over script (~${wordCount} words)",
  "shots": [
    { "timestamp": "0:00-0:05", "shot": "What is on screen", "caption": "On-screen text" }
  ],
  "cta": "Call to action for last 5 seconds",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "music_suggestion": "Background music style",
  "platform_tips": { "linkedin": "tip", "instagram": "tip", "twitter": "tip" }
}

Include 6-8 shots. Return ONLY the raw JSON.`;

        let rawText = '';

        if (groqKey) {
            const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 2048,
                    temperature: 0.7,
                    response_format: { type: 'json_object' },
                })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error?.message || 'Groq error');
            rawText = d.choices?.[0]?.message?.content || '{}';
        } else {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const ai = new GoogleGenerativeAI(geminiKey);
            const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const result = await model.generateContent(prompt);
            rawText = result.response.text() || '{}';
        }

        const cleaned = rawText.trim().replace(/^```json\n?/i, '').replace(/^```\n?/, '').replace(/```$/, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); }
        catch { const m = cleaned.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }

        if (!parsed) return res.status(500).json({ success: false, message: 'Could not parse AI response. Try again.' });
        res.json({ success: true, script: parsed });
    } catch (err) {
        console.error('[/ai/social-video]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
