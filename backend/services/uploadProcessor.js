/**
 * uploadProcessor.js — Auto-Processing Engine
 *
 * Triggered immediately after a file lands in storage.
 * Pipeline:
 *   1. Gemini Vision AI  → per-image fault/anomaly detection
 *      - GCS URI mode  : uses fileData { fileUri: 'gs://...' } — no size limit
 *      - Inline fallback: uses inlineData base64 for non-GCS files (<20MB)
 *   2. Pix4D Cloud API   → photogrammetry dispatch for aerial datasets (optional)
 *   3. DB update         → status, ai_result, pix4d_job_id
 *   4. Socket.io emit    → real-time status to connected clients
 *
 * Designed to be called fire-and-forget (never awaited by the HTTP handler).
 */
import { query } from '../config/database.js';
import { logger } from './logger.js';

// ── Gemini Vision client ──────────────────────────────────────────────────────
// Uses @google/genai (newer SDK) which supports the fileData/GCS URI part type.
let genAI = null;
let GoogleGenAI = null;

try {
    const mod = await import('@google/genai');
    GoogleGenAI = mod.GoogleGenAI;
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (key) {
        genAI = new GoogleGenAI({ apiKey: key });
        logger.info('[uploadProcessor] Gemini AI initialized (GCS URI + inline fallback)');
    } else {
        logger.warn('[uploadProcessor] No GEMINI_API_KEY — AI analysis disabled');
    }
} catch (e) {
    // Fallback to legacy SDK
    try {
        const mod2 = await import('@google/generative-ai');
        const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (key && mod2.GoogleGenerativeAI) {
            genAI = { _legacy: new mod2.GoogleGenerativeAI(key) };
            logger.info('[uploadProcessor] Gemini AI initialized (legacy SDK, inline only)');
        }
    } catch (e2) {
        logger.warn('[uploadProcessor] Gemini import failed:', e2.message);
    }
}

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';
const INLINE_LIMIT_BYTES = 20 * 1024 * 1024; // 20 MB

// ── Pix4D Cloud API (optional) ────────────────────────────────────────────────
const PIX4D_TOKEN   = process.env.PIX4D_API_TOKEN;
const PIX4D_BASE    = 'https://api.pix4d.com/v2';
const PIX4D_ENABLED = !!PIX4D_TOKEN;

if (PIX4D_ENABLED) logger.info('[uploadProcessor] Pix4D auto-dispatch enabled');
else logger.info('[uploadProcessor] PIX4D_API_TOKEN not set — Pix4D dispatch disabled');

// ── Build prompt per analysis/upload type ────────────────────────────────────
function buildPrompt(uploadType, analysisType) {
    // analysisType takes priority if set
    const at = analysisType || uploadType;
    if (at === 'thermal_fault' || at === 'thermal') {
        return `You are a thermal inspection AI. Analyze this thermal/IR drone image and return ONLY valid JSON (no markdown fences):
{ "faults": [{"type": string, "tempDelta": number, "location": string, "severity": "low|medium|high|critical", "confidence": number}],
  "totalFaults": number, "maxTempDelta": number, "overallCondition": "good|degraded|critical",
  "recommendations": [string], "summary": string }`;
    }
    if (at === 'lbd_defect' || at === 'lbd') {
        return `You are an LBD (Laser/Beam/Defect) scan expert. Analyze this scan image and return ONLY valid JSON (no markdown fences):
{ "defects": [{"type": string, "severity": "low|medium|high|critical", "location": string, "confidence": number}],
  "totalDefects": number, "overallSeverity": "low|medium|high|critical",
  "recommendations": [string], "summary": string }`;
    }
    if (at === 'solar_panel') {
        return `You are a solar panel inspection AI. Analyze this drone image for PV cell faults and soiling and return ONLY valid JSON (no markdown fences):
{ "faults": [{"type": string, "severity": "low|medium|high|critical", "location": string, "confidence": number}],
  "totalFaults": number, "overallCondition": "good|degraded|critical",
  "soilingPercent": number, "recommendations": [string], "summary": string }`;
    }
    if (at === 'full_inspection') {
        return `You are a comprehensive aerial inspection AI. Analyze this drone image for ALL fault types and return ONLY valid JSON (no markdown fences):
{ "faults": [{"type": string, "severity": "low|medium|high|critical", "location": string, "confidence": number}],
  "anomalies": [{"type": string, "severity": "low|medium|high", "confidence": number, "location": string}],
  "totalFaults": number, "maxTempDelta": number, "overallCondition": "good|degraded|critical",
  "imageQuality": "poor|fair|good|excellent", "recommendations": [string], "summary": string }`;
    }
    // Default: rgb_anomaly / images
    return `You are a drone inspection AI. Analyze this aerial image and return ONLY valid JSON (no markdown fences):
{ "anomalies": [{"type": string, "severity": "low|medium|high", "confidence": number, "location": string}],
  "imageQuality": "poor|fair|good|excellent", "overallCondition": "normal|review|critical",
  "recommendations": [string], "summary": string }`;
}

// ── Parse Gemini response safely ──────────────────────────────────────────────
function parseGeminiJSON(text) {
    const clean = text.trim().replace(/^```(?:json)?\n?/i, '').replace(/```$/m, '').trim();
    try { return JSON.parse(clean); } catch {
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error('No valid JSON in Gemini response');
    }
}

// ── Detect GCS URI ────────────────────────────────────────────────────────────
function toGCSUri(storageUrl) {
    if (!storageUrl) return null;
    // Already a gs:// URI
    if (storageUrl.startsWith('gs://')) return storageUrl;
    // Public HTTPS: https://storage.googleapis.com/BUCKET/PATH
    const m = storageUrl.match(/storage\.googleapis\.com\/([^/]+)\/(.+)/);
    if (m) return `gs://${m[1]}/${m[2]}`;
    return null;
}

// ── Gemini: analyse one image ─────────────────────────────────────────────────
/**
 * @param {string|null} storageUrl  - GCS URL (preferred: avoids base64, no size limit)
 * @param {Buffer|null} fileBuffer  - inline fallback for non-GCS files
 * @param {string}      mimeType
 * @param {string}      uploadType
 */
async function analyzeWithGemini(storageUrl, fileBuffer, mimeType, uploadType, analysisType) {
    if (!genAI) return null;
    const prompt = buildPrompt(uploadType, analysisType);
    const model  = 'gemini-2.0-flash';
    const gcsUri = toGCSUri(storageUrl);

    try {
        let result;

        // ── Path A: GCS URI — fastest, no size limit ──────────────────────────
        if (gcsUri && !genAI._legacy) {
            logger.info(`[uploadProcessor] Gemini GCS URI analysis: ${gcsUri}`);
            result = await genAI.models.generateContent({
                model,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { fileData: { mimeType: mimeType || 'image/jpeg', fileUri: gcsUri } },
                    ],
                }],
            });
            return parseGeminiJSON(result.text || '{}');
        }

        // ── Path B: Inline base64 (local files / legacy SDK / small files) ────
        if (fileBuffer) {
            const effective = fileBuffer.length > INLINE_LIMIT_BYTES
                ? fileBuffer.slice(0, INLINE_LIMIT_BYTES)   // trim if over limit
                : fileBuffer;

            if (effective.length < fileBuffer.length) {
                logger.warn(`[uploadProcessor] File >20MB (${Math.round(fileBuffer.length/1024/1024)}MB), trimmed for inline analysis. Consider using GCS.`);
            }

            logger.info(`[uploadProcessor] Gemini inline analysis: ${Math.round(effective.length/1024)}KB`);

            if (genAI._legacy) {
                // Legacy @google/generative-ai SDK
                const m = genAI._legacy.getGenerativeModel({ model });
                const r = await m.generateContent([
                    { text: prompt },
                    { inlineData: { mimeType: mimeType || 'image/jpeg', data: effective.toString('base64') } },
                ]);
                return parseGeminiJSON(r.response.text());
            } else {
                // New @google/genai SDK
                result = await genAI.models.generateContent({
                    model,
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: mimeType || 'image/jpeg', data: effective.toString('base64') } },
                        ],
                    }],
                });
                return parseGeminiJSON(result.text || '{}');
            }
        }

        logger.warn('[uploadProcessor] No GCS URI and no file buffer — cannot analyze');
        return null;

    } catch (e) {
        logger.warn('[uploadProcessor] Gemini analysis failed:', e.message);
        return { error: e.message, summary: 'AI analysis failed — please review manually.' };
    }
}

// ── Pix4D: dispatch a photogrammetry job ──────────────────────────────────────
async function dispatchToPix4D(jobId, missionTitle, fileUrls) {
    if (!PIX4D_ENABLED || fileUrls.length === 0) return null;
    try {
        const resp = await fetch(`${PIX4D_BASE}/projects`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PIX4D_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `Axis-${missionTitle}-Job-${jobId.slice(0, 8)}`,
                images: fileUrls.map(url => ({ url })),
                processingOptions: { initialProcessing: true, pointCloud: true, mesh: false, dsm: true, orthomosaic: true },
            }),
        });
        if (!resp.ok) {
            logger.warn(`[uploadProcessor] Pix4D API error ${resp.status}: ${await resp.text()}`);
            return null;
        }
        const data = await resp.json();
        logger.info(`[uploadProcessor] Pix4D job created: ${data.id}`);
        return data.id;
    } catch (e) {
        logger.warn('[uploadProcessor] Pix4D dispatch failed:', e.message);
        return null;
    }
}

// ── Main entry point ───────────────────────────────────────────────────────────
/**
 * processUpload — fire-and-forget after a file is stored.
 *
 * @param {object} opts
 * @param {string}  opts.jobId        - upload_jobs row id
 * @param {string}  opts.uploadFileId - upload_files row id (optional)
 * @param {string}  opts.missionId
 * @param {string}  opts.uploadType   - 'images'|'thermal'|'lbd'|'kml'|...
 * @param {string}  opts.storageUrl   - GCS URI (gs://...) or HTTPS public URL
 * @param {Buffer}  opts.fileBuffer   - raw file buffer (inline fallback)
 * @param {string}  opts.mimeType
 * @param {string}  opts.fileName
 * @param {object}  opts.io           - Socket.io server instance
 * @param {string}  opts.userId       - pilotId (for scoped socket emit)
 */
export async function processUpload({
    jobId, uploadFileId, missionId, uploadType, analysisType, storageUrl,
    fileBuffer, mimeType, fileName, io, userId,
}) {
    const canAnalyze = ['images', 'thermal', 'lbd'].includes(uploadType);
    const gcsUri     = toGCSUri(storageUrl);

    // Record processing start
    await query(
        `UPDATE upload_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [jobId]
    ).catch(() => {});

    emit(io, userId, 'upload:processing', { jobId, missionId, fileName, uploadType });

    let aiResult   = null;
    let pix4dJobId = null;

    // ── 1. Gemini AI analysis ─────────────────────────────────────────────────
    const hasData = Boolean(gcsUri || fileBuffer);
    logger.info(`[uploadProcessor] ${fileName} | type=${uploadType} canAnalyze=${canAnalyze} gcsUri=${gcsUri || 'none'} hasBuffer=${!!fileBuffer} hasGenAI=${!!genAI}`);

    if (canAnalyze && hasData && genAI) {
        try {
            aiResult = await analyzeWithGemini(storageUrl, fileBuffer, mimeType, uploadType, analysisType);
            logger.info(`[uploadProcessor] Gemini done for ${fileName} — ${JSON.stringify(aiResult)?.slice(0, 80)}`);

            if (uploadFileId) {
                await query(
                    `UPDATE upload_files SET ai_result = $1, status = 'complete', updated_at = NOW() WHERE id = $2`,
                    [JSON.stringify(aiResult), uploadFileId]
                ).catch(e => logger.warn('[uploadProcessor] upload_files update failed:', e.message));
            }
        } catch (e) {
            logger.error('[uploadProcessor] Gemini step failed:', e.message);
            if (uploadFileId) {
                await query(
                    `UPDATE upload_files SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
                    [e.message, uploadFileId]
                ).catch(() => {});
            }
        }
    } else if (uploadFileId && !canAnalyze) {
        // Non-analyzable file (kml, spreadsheet) — just mark complete
        await query(
            `UPDATE upload_files SET status = 'complete', updated_at = NOW() WHERE id = $1`,
            [uploadFileId]
        ).catch(() => {});
    }

    // ── 2. Pix4D dispatch (aerial images only) ────────────────────────────────
    if (PIX4D_ENABLED && ['images', 'thermal', 'orthomosaic'].includes(uploadType)) {
        try {
            const missionRes = await query(
                `SELECT d.title FROM deployments d WHERE d.id = $1`,
                [missionId]
            );
            const missionTitle = missionRes.rows[0]?.title || 'Mission';

            const filesRes = await query(
                `SELECT storage_url FROM upload_files WHERE job_id = $1 ORDER BY created_at DESC LIMIT 200`,
                [jobId]
            );
            // For Pix4D, convert gs:// back to https or use public URLs
            const fileUrls = filesRes.rows
                .map(r => r.storage_url)
                .filter(u => u?.startsWith('http'));

            if (fileUrls.length >= 3) {
                pix4dJobId = await dispatchToPix4D(jobId, missionTitle, fileUrls);
                if (pix4dJobId) {
                    await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS pix4d_job_id TEXT`).catch(() => {});
                    await query(`UPDATE upload_jobs SET pix4d_job_id = $1 WHERE id = $2`, [pix4dJobId, jobId]).catch(() => {});
                }
            }
        } catch (e) {
            logger.warn('[uploadProcessor] Pix4D step failed:', e.message);
        }
    }

    // ── 3. Persist AI result & mark complete ──────────────────────────────────
    try {
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS ai_result JSONB`).catch(() => {});
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ`).catch(() => {});

        await query(
            `UPDATE upload_jobs
             SET status          = 'complete',
                 ai_result       = $1,
                 processed_at    = NOW(),
                 processed_count = processed_count + 1,
                 updated_at      = NOW()
             WHERE id = $2`,
            [aiResult ? JSON.stringify(aiResult) : null, jobId]
        );
    } catch (e) {
        logger.warn('[uploadProcessor] DB update failed:', e.message);
        await query(`UPDATE upload_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`, [jobId]).catch(() => {});
    }

    // ── 4. Real-time emit ─────────────────────────────────────────────────────
    emit(io, userId, 'upload:complete', {
        jobId, missionId, fileName, uploadType,
        aiResult, pix4dJobId,
        processedAt: new Date().toISOString(),
    });

    logger.info(`[uploadProcessor] ✅ ${fileName} processing complete — jobId=${jobId}`);
}

function emit(io, userId, event, payload) {
    try {
        if (!io) return;
        io.emit(event, payload);
        if (userId) io.to(`user:${userId}`).emit(event, payload);
    } catch (e) {
        logger.warn('[uploadProcessor] socket emit failed:', e.message);
    }
}
