/**
 * uploadProcessor.js — Auto-Processing Engine
 *
 * Triggered immediately after a file lands in storage.
 * Pipeline:
 *   1. Gemini Vision AI  → per-image fault/anomaly detection
 *      - GCS URI mode  : uses fileData { fileUri: 'gs://...' } — no size limit
 *      - Inline fallback: uses inlineData base64 for non-GCS files (<20MB)
 *   2. Pix4D Cloud API   → job-complete photogrammetry dispatch for aerial datasets (optional)
 *   3. DB update         → status, ai_result, pix4d_job_id
 *   4. Socket.io emit    → real-time status to connected clients
 *
 * Designed to be called fire-and-forget (never awaited by the HTTP handler).
 */
import { query } from '../config/database.js';
import { logger } from './logger.js';
import AWS from 'aws-sdk';
import fs from 'fs/promises';
import path from 'path';

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
const PIX4D_CLIENT_ID     = process.env.PIX4D_CLIENT_ID;
const PIX4D_CLIENT_SECRET = process.env.PIX4D_CLIENT_SECRET;
const PIX4D_STATIC_TOKEN  = process.env.PIX4D_ACCESS_TOKEN || process.env.PIX4D_API_TOKEN;
const PIX4D_CLOUD_BASE    = (process.env.PIX4D_CLOUD_BASE_URL || 'https://cloud.pix4d.com').replace(/\/$/, '');
const PIX4D_PROJECT_BASE  = `${PIX4D_CLOUD_BASE}/project/api/v3`;
const PIX4D_ENABLED       = !!(PIX4D_STATIC_TOKEN || (PIX4D_CLIENT_ID && PIX4D_CLIENT_SECRET));
const PIX4D_MIN_IMAGES    = Number(process.env.PIX4D_MIN_IMAGES || 3);
const PIX4D_BILLING_MODEL = process.env.PIX4D_BILLING_MODEL;
const PIX4D_PROJECT_TYPE  = process.env.PIX4D_PROJECT_TYPE;
const SOURCE_S3_BUCKET    = process.env.S3_BUCKET_NAME || 'skylens-images';

let pix4dTokenCache = { token: PIX4D_STATIC_TOKEN || null, expiresAt: 0 };

if (PIX4D_ENABLED) logger.info('[uploadProcessor] Pix4D Cloud dispatch enabled');
else logger.info('[uploadProcessor] Pix4D credentials not set — Pix4D dispatch disabled');

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

// ── Pix4D helpers ─────────────────────────────────────────────────────────────
function sanitizePix4DProjectName(value) {
    const clean = String(value || 'Axis Project')
        .replace(/[\/\\]/g, '-')
        .replace(/^\-+/, '')
        .trim()
        .slice(0, 100);
    return clean || 'Axis Project';
}

function safeInputName(row, index) {
    const original = row.file_name || `image-${index + 1}.jpg`;
    const ext = path.extname(original) || '.jpg';
    const base = path.basename(original, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || `image-${index + 1}`;
    return `${String(index + 1).padStart(4, '0')}-${base}${ext}`;
}

function isPix4DImage(row) {
    return ['.jpg', '.jpeg', '.tif', '.tiff', '.png'].includes(path.extname(row.file_name || row.storage_url || '').toLowerCase());
}

async function getPix4DToken() {
    if (PIX4D_STATIC_TOKEN) return PIX4D_STATIC_TOKEN;
    if (pix4dTokenCache.token && pix4dTokenCache.expiresAt > Date.now() + 60_000) {
        return pix4dTokenCache.token;
    }
    if (!PIX4D_CLIENT_ID || !PIX4D_CLIENT_SECRET) {
        throw new Error('PIX4D_CLIENT_ID and PIX4D_CLIENT_SECRET are required');
    }

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        token_format: 'jwt',
        client_id: PIX4D_CLIENT_ID,
        client_secret: PIX4D_CLIENT_SECRET,
    });

    const resp = await fetch(`${PIX4D_CLOUD_BASE}/oauth2/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!resp.ok) {
        throw new Error(`Pix4D OAuth failed ${resp.status}: ${await resp.text()}`);
    }

    const data = await resp.json();
    pix4dTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 300) * 1000,
    };
    return pix4dTokenCache.token;
}

async function pix4dRequest(pathname, options = {}) {
    const token = await getPix4DToken();
    const resp = await fetch(`${PIX4D_PROJECT_BASE}${pathname}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const text = await resp.text();
    const data = text ? JSON.parse(text) : null;
    if (!resp.ok) {
        throw new Error(`Pix4D API ${resp.status}: ${text}`);
    }
    return data;
}

function buildPix4DS3Client(creds) {
    return new AWS.S3({
        accessKeyId: creds.access_key,
        secretAccessKey: creds.secret_key,
        sessionToken: creds.session_token,
        region: creds.region || 'us-east-1',
        useAccelerateEndpoint: Boolean(creds.is_bucket_accelerated),
        ...(creds.endpoint_override && { endpoint: `https://${creds.endpoint_override}` }),
    });
}

function sourceS3KeyFromUrl(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        const host = u.hostname;
        if (host === 's3.amazonaws.com' || host.startsWith('s3.')) {
            const parts = u.pathname.replace(/^\/+/, '').split('/');
            if (parts[0] === SOURCE_S3_BUCKET) return decodeURIComponent(parts.slice(1).join('/'));
        }
        if (host.startsWith(`${SOURCE_S3_BUCKET}.`)) {
            return decodeURIComponent(u.pathname.replace(/^\/+/, ''));
        }
    } catch { /* not a URL */ }
    return null;
}

async function loadUploadFileBuffer(row) {
    const localPath = row.file_path || (row.storage_url?.startsWith('/uploads/') ? row.storage_url.slice(1) : null);
    if (localPath && !localPath.startsWith('http') && !localPath.startsWith('gs://')) {
        try {
            return await fs.readFile(path.resolve(process.cwd(), localPath));
        } catch { /* try cloud/http fallbacks */ }
    }

    const s3Key = row.file_path && !row.file_path.startsWith('uploads/') ? row.file_path : sourceS3KeyFromUrl(row.storage_url);
    if (s3Key && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        try {
            const sourceS3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION || 'us-east-1',
            });
            const obj = await sourceS3.getObject({ Bucket: SOURCE_S3_BUCKET, Key: s3Key }).promise();
            return Buffer.isBuffer(obj.Body) ? obj.Body : Buffer.from(obj.Body);
        } catch { /* try public URL fallback */ }
    }

    if (row.storage_url?.startsWith('http')) {
        const resp = await fetch(row.storage_url);
        if (!resp.ok) throw new Error(`fetch ${resp.status}`);
        return Buffer.from(await resp.arrayBuffer());
    }

    throw new Error(`No readable source for ${row.file_name}`);
}

async function uploadPix4DInputs(projectId, rows) {
    const creds = await pix4dRequest(`/projects/${projectId}/s3_credentials/`);
    const pix4dS3 = buildPix4DS3Client(creds);
    const uploadedKeys = [];

    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const body = await loadUploadFileBuffer(row);
        const key = `${creds.key.replace(/\/$/, '')}/${safeInputName(row, i)}`;
        await pix4dS3.upload({
            Bucket: creds.bucket,
            Key: key,
            Body: body,
            ContentType: row.mime_type || 'image/jpeg',
        }).promise();
        uploadedKeys.push(key);
    }

    return uploadedKeys;
}

export async function dispatchPix4DForJob(jobId, { io = null, userId = null } = {}) {
    if (!PIX4D_ENABLED) {
        return { dispatched: false, reason: 'Pix4D credentials are not configured' };
    }

    await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS pix4d_job_id TEXT`).catch(() => {});
    await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS pix4d_project_url TEXT`).catch(() => {});
    await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS pix4d_status TEXT`).catch(() => {});
    await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS pix4d_error TEXT`).catch(() => {});
    await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS pix4d_dispatched_at TIMESTAMPTZ`).catch(() => {});

    const lock = await query(
        `UPDATE upload_jobs
         SET pix4d_status = 'dispatching', pix4d_error = NULL, updated_at = NOW()
         WHERE id = $1
           AND upload_type IN ('images', 'thermal', 'orthomosaic')
           AND pix4d_job_id IS NULL
           AND COALESCE(pix4d_status, 'pending') NOT IN ('dispatching', 'processing', 'done')
         RETURNING id, mission_id, upload_type, file_count`,
        [jobId]
    );

    if (lock.rows.length === 0) {
        return { dispatched: false, reason: 'Job is not eligible or already dispatched' };
    }

    const job = lock.rows[0];
    try {
        const missionRes = await query(`SELECT title, site_name FROM deployments WHERE id = $1`, [job.mission_id]);
        const mission = missionRes.rows[0] || {};
        const filesRes = await query(
            `SELECT id, file_name, file_path, storage_url
             FROM upload_files
             WHERE job_id = $1
             ORDER BY created_at ASC
             LIMIT 1000`,
            [jobId]
        );
        const files = filesRes.rows.filter(isPix4DImage);
        if (files.length < PIX4D_MIN_IMAGES) {
            throw new Error(`Pix4D requires at least ${PIX4D_MIN_IMAGES} supported image files; found ${files.length}`);
        }

        const projectBody = {
            name: sanitizePix4DProjectName(`Axis-${mission.site_name || mission.title || 'Mission'}-${jobId.slice(0, 8)}`),
            ...(PIX4D_BILLING_MODEL && { billing_model: PIX4D_BILLING_MODEL }),
            ...(PIX4D_PROJECT_TYPE && { project_type: PIX4D_PROJECT_TYPE }),
        };

        const project = await pix4dRequest('/projects/', {
            method: 'POST',
            body: JSON.stringify(projectBody),
        });
        const projectId = project.id;
        const inputKeys = await uploadPix4DInputs(projectId, files);

        await pix4dRequest(`/projects/${projectId}/inputs/bulk_register/`, {
            method: 'POST',
            body: JSON.stringify({ input_file_keys: inputKeys }),
        });

        await pix4dRequest(`/projects/${projectId}/start_processing/`, { method: 'POST' });

        const projectUrl = project.detail_url || `${PIX4D_CLOUD_BASE}/project/api/v3/projects/${projectId}/`;
        await query(
            `UPDATE upload_jobs
             SET pix4d_job_id = $1,
                 pix4d_project_url = $2,
                 pix4d_status = 'processing',
                 pix4d_dispatched_at = NOW(),
                 updated_at = NOW()
             WHERE id = $3`,
            [String(projectId), projectUrl, jobId]
        );

        emit(io, userId, 'pix4d:dispatched', { jobId, pix4dJobId: String(projectId), pix4dProjectUrl: projectUrl });
        logger.info(`[uploadProcessor] Pix4D project ${projectId} started for job ${jobId}`);
        return { dispatched: true, pix4dJobId: String(projectId), pix4dProjectUrl: projectUrl };
    } catch (e) {
        await query(
            `UPDATE upload_jobs
             SET pix4d_status = 'failed', pix4d_error = $1, updated_at = NOW()
             WHERE id = $2`,
            [e.message, jobId]
        ).catch(() => {});
        logger.warn(`[uploadProcessor] Pix4D dispatch failed for job ${jobId}: ${e.message}`);
        emit(io, userId, 'pix4d:failed', { jobId, error: e.message });
        return { dispatched: false, reason: e.message };
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

    // Pix4D dispatch runs from the upload job completion endpoint so the full
    // image set is uploaded exactly once.

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
