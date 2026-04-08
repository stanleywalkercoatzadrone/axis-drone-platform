/**
 * adminMedia.js — Admin media management
 *
 * GET    /api/admin/media              — List DB-tracked files
 * GET    /api/admin/media/:id/download — Signed URL / redirect for file
 * DELETE /api/admin/media/:id         — Delete from storage + DB
 * GET    /api/admin/media/browse/s3   — List raw S3 bucket objects
 * GET    /api/admin/media/browse/gcs  — List raw GCS bucket objects
 */
import express from 'express';
import AWS from 'aws-sdk';
import { Storage } from '@google-cloud/storage';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getGCSSignedUrl, deleteByDestination, deleteFromS3, deleteFromGCS } from '../services/storageService.js';

const router = express.Router();
router.use(protect);
router.use(authorize('ADMIN', 'MANAGER'));

// ── S3 / GCS clients ──────────────────────────────────────────────────────────
const S3_BUCKET  = process.env.S3_BUCKET_NAME || 'tm-prod-pilot-california';
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';

/** Build an S3 client. Falls back to env vars if header overrides absent. */
function s3Client(req) {
    const keyId  = req.headers['x-s3-key-id']  || process.env.AWS_ACCESS_KEY_ID;
    const secret = req.headers['x-s3-secret']  || process.env.AWS_SECRET_ACCESS_KEY;
    const region = req.headers['x-s3-region']  || process.env.AWS_REGION || 'us-west-1';
    return new AWS.S3({
        accessKeyId:     keyId,
        secretAccessKey: secret,
        region,
        signatureVersion: 'v4',
    });
}

let gcs = null;
try {
    gcs = new Storage(); // uses ADC on Cloud Run
} catch (e) {
    console.warn('[adminMedia] GCS init failed:', e.message);
}

// ── GET /api/admin/media ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { missionId, uploadType } = req.query;
        const limit  = Math.min(Number(req.query.limit)  || 200, 1000);
        const offset = Number(req.query.offset) || 0;

        let countSql = `SELECT COUNT(*) FROM deployment_files df LEFT JOIN upload_jobs uj
            ON uj.mission_id = df.deployment_id AND uj.created_at <= df.created_at
            AND uj.created_at >= df.created_at - INTERVAL '1 hour' WHERE 1=1`;

        let sql = `
            SELECT
                df.id,
                df.name,
                df.url,
                df.type,
                df.size,
                df.created_at,
                d.title       AS mission_title,
                d.id          AS mission_id,
                uj.upload_type,
                uj.storage_destination
            FROM deployment_files df
            LEFT JOIN deployments d  ON d.id  = df.deployment_id
            LEFT JOIN upload_jobs uj
                ON uj.mission_id   = df.deployment_id
                AND uj.created_at <= df.created_at
                AND uj.created_at >= df.created_at - INTERVAL '1 hour'
            WHERE 1=1
        `;
        const params = [];

        if (missionId)  { params.push(missionId);  sql += ` AND df.deployment_id = $${params.length}`;  countSql += ` AND df.deployment_id = $${params.length}`; }
        if (uploadType) { params.push(uploadType);  sql += ` AND uj.upload_type   = $${params.length}`; countSql += ` AND uj.upload_type   = $${params.length}`; }

        // Get total count
        const countRes = await query(countSql, params);
        const totalCount = parseInt(countRes.rows[0]?.count || '0', 10);

        params.push(limit, offset);
        sql += ` ORDER BY df.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await query(sql, params);
        res.json({
            success: true,
            data: result.rows,
            total: result.rows.length,
            totalCount,
            hasMore: offset + result.rows.length < totalCount,
            nextOffset: offset + result.rows.length,
        });
    } catch (err) {
        console.error('[adminMedia] list error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/admin/media/bulk — Delete ALL matching files at once ──────────
// MUST be declared before DELETE /:id so Express doesn't match 'bulk' as a UUID
// Body (all optional): { missionId, uploadType }
router.delete('/bulk', async (req, res) => {
    try {
        const { missionId, uploadType } = req.body || {};

        // 1. Fetch ALL matching IDs + URLs (no LIMIT)
        let sql = `
            SELECT df.id, df.url
            FROM deployment_files df
            LEFT JOIN upload_jobs uj
                ON uj.mission_id = df.deployment_id
                AND uj.created_at <= df.created_at
                AND uj.created_at >= df.created_at - INTERVAL '1 hour'
            WHERE 1=1
        `;
        const params = [];
        if (missionId)  { params.push(missionId);  sql += ` AND df.deployment_id = $${params.length}`; }
        if (uploadType) { params.push(uploadType);  sql += ` AND uj.upload_type = $${params.length}`; }
        sql += ' ORDER BY df.created_at DESC';

        const result = await query(sql, params);
        const files  = result.rows;
        if (!files.length) return res.json({ success: true, deleted: 0, message: 'Nothing to delete' });

        // 2. Delete from storage in parallel batches of 10
        const BATCH = 10;
        let storageDeleted = 0;
        for (let i = 0; i < files.length; i += BATCH) {
            await Promise.allSettled(files.slice(i, i + BATCH).map(async f => {
                try {
                    if (!f.url) return;
                    const dest = f.url.includes('amazonaws.com') ? 's3' : 'gcs';
                    if (dest === 's3') {
                        await deleteFromS3(f.url).catch(() => {});
                    } else {
                        await deleteFromGCS(f.url).catch(() => {});
                    }
                    storageDeleted++;
                } catch { /* non-fatal */ }
            }));
        }

        // 3. Bulk delete from DB in one query
        const ids = files.map(f => f.id);
        await query(`DELETE FROM deployment_files WHERE id = ANY($1::uuid[])`, [ids]);

        console.log(`[adminMedia] bulk delete: ${ids.length} files removed (${storageDeleted} from storage)`);
        res.json({ success: true, deleted: ids.length, storageDeleted });
    } catch (err) {
        console.error('[adminMedia] bulk delete error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/admin/media/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const result = await query(
            `SELECT df.*, uj.upload_type, uj.id AS job_id
             FROM deployment_files df
             LEFT JOIN upload_jobs uj
                ON uj.mission_id   = df.deployment_id
                AND uj.created_at <= df.created_at
                AND uj.created_at >= df.created_at - INTERVAL '1 hour'
             WHERE df.id = $1 LIMIT 1`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = result.rows[0];
        const url  = file.url || '';

        // ── Determine destination ──────────────────────────────────────────────
        let destination = file.storage_destination;
        if (!destination) {
            if (url.startsWith('gs://') ||
                url.includes('storage.googleapis.com') ||
                url.includes('storage.cloud.google.com')) {
                destination = 'gcs';
            } else if (url.includes('amazonaws.com') || url.includes('s3.')) {
                destination = 's3';
            } else {
                destination = 'gcs'; // default for this platform
            }
        }

        // ── Derive storage key from ANY URL format ─────────────────────────────
        let key = url;
        try {
            if (url.startsWith('gs://')) {
                key = url.replace(/^gs:\/\/[^\/]+\//, '');
            } else if (url.includes('storage.googleapis.com/')) {
                const u = new URL(url);
                let p = u.pathname;
                p = p.replace(/^\/[^\/]+\//, '');
                if (p.startsWith('download/storage/v1/b/')) {
                    const m = p.match(/\/o\/(.+)$/);
                    p = m ? decodeURIComponent(m[1]) : p;
                }
                key = decodeURIComponent(p);
            } else if (url.includes('storage.cloud.google.com/')) {
                const u = new URL(url);
                key = decodeURIComponent(u.pathname.replace(/^\/[^\/]+\//, ''));
            } else if (url.includes('amazonaws.com')) {
                const u = new URL(url);
                if (u.hostname.includes('.s3.')) {
                    key = decodeURIComponent(u.pathname.replace(/^\//, ''));
                } else {
                    key = decodeURIComponent(u.pathname.replace(/^\/[^\/]+\//, ''));
                }
            }
        } catch (parseErr) {
            console.warn('[adminMedia] URL parse failed, using raw url as key:', parseErr.message);
            key = url;
        }

        console.log(`[adminMedia] delete → destination=${destination} key=${key}`);

        // ── Delete from cloud storage ──────────────────────────────────────────
        let storageDeleted = false;
        try {
            await deleteByDestination(key, destination);
            storageDeleted = true;
            console.log(`[adminMedia] storage delete OK: ${destination}/${key}`);
        } catch (storageErr) {
            console.warn('[adminMedia] storage delete failed (still removing DB record):', storageErr.message);
        }

        // ── Remove DB records ──────────────────────────────────────────────────
        await query(`DELETE FROM deployment_files WHERE id = $1`, [req.params.id]);

        if (file.job_id) {
            await query(
                `UPDATE upload_jobs SET file_count = GREATEST(0, file_count - 1) WHERE id = $1`,
                [file.job_id]
            ).catch(() => {});
        }

        res.json({
            success: true,
            message: `File deleted${storageDeleted ? '' : ' (DB only — storage removal failed, check server logs)'}`,
            id: req.params.id,
            storageDeleted,
        });
    } catch (err) {
        console.error('[adminMedia] delete error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/admin/media/:id/download ────────────────────────────────────────
router.get('/:id/download', async (req, res) => {
    try {
        const result = await query(`SELECT * FROM deployment_files WHERE id = $1`, [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'File not found' });

        const file = result.rows[0];

        if (file.url?.startsWith('gs://')) {
            const key = file.url.replace(/^gs:\/\/[^\/]+\//, '');
            const signedUrl = await getGCSSignedUrl(key, 3600);
            if (!signedUrl) return res.status(500).json({ success: false, message: 'Could not generate signed URL' });
            return res.redirect(signedUrl);
        }

        res.redirect(file.url);
    } catch (err) {
        console.error('[adminMedia] download error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/admin/media/browse/s3?prefix= ───────────────────────────────────
router.get('/browse/s3', async (req, res) => {
    try {
        const prefix     = req.query.prefix || '';
        const maxKeys    = Math.min(Number(req.query.limit) || 500, 1000);
        const delimiter  = req.query.flat === 'true' ? undefined : '/';
        const ct         = req.query.continuationToken || undefined;

        const params = {
            Bucket:            S3_BUCKET,
            Prefix:            prefix,
            MaxKeys:           maxKeys,
            Delimiter:         delimiter,
            ContinuationToken: ct,
        };

        const data = await s3Client(req).listObjectsV2(params).promise();

        const objects = (data.Contents || []).map(o => ({
            key:          o.Key,
            name:         o.Key.split('/').pop(),
            size:         o.Size,
            lastModified: o.LastModified,
            storageClass: o.StorageClass,
            url:          `https://${S3_BUCKET}.s3.amazonaws.com/${o.Key}`,
        }));

        const prefixes = (data.CommonPrefixes || []).map(p => ({
            prefix: p.Prefix,
            name:   p.Prefix.replace(prefix, '').replace('/', ''),
        }));

        res.json({
            success: true,
            bucket:  S3_BUCKET,
            prefix,
            objects,
            prefixes,
            truncated:         data.IsTruncated,
            nextContinuationToken: data.NextContinuationToken || null,
            totalKeys: data.KeyCount,
        });
    } catch (err) {
        console.error('[adminMedia] s3 browse error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/admin/media/browse/gcs?prefix= ──────────────────────────────────
router.get('/browse/gcs', async (req, res) => {
    try {
        if (!gcs) return res.status(503).json({ success: false, message: 'GCS not initialized' });

        const prefix    = req.query.prefix || '';
        const delimiter = req.query.flat === 'true' ? undefined : '/';
        const maxFiles  = Math.min(Number(req.query.limit) || 500, 1000);

        const [files, , apiResponse] = await gcs.bucket(GCS_BUCKET).getFiles({
            prefix,
            delimiter,
            maxResults: maxFiles,
            autoPaginate: false,
        });

        const objects = files.map(f => ({
            key:          f.name,
            name:         f.name.split('/').pop(),
            size:         Number(f.metadata?.size || 0),
            lastModified: f.metadata?.updated,
            contentType:  f.metadata?.contentType,
            url:          `gs://${GCS_BUCKET}/${f.name}`,
        }));

        const prefixes = (apiResponse?.prefixes || []).map(p => ({
            prefix: p,
            name:   p.replace(prefix, '').replace('/', ''),
        }));

        res.json({
            success: true,
            bucket: GCS_BUCKET,
            prefix,
            objects,
            prefixes,
            nextPageToken: apiResponse?.nextPageToken || null,
        });
    } catch (err) {
        console.error('[adminMedia] gcs browse error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/admin/media/browse/s3 — Delete a raw S3 key ──────────────────
router.delete('/browse/s3', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ success: false, message: 'key required' });
        await s3Client(req).deleteObject({ Bucket: S3_BUCKET, Key: key }).promise();
        await query(`DELETE FROM deployment_files WHERE url LIKE $1`, [`%${key}%`]).catch(() => {});
        res.json({ success: true, message: `Deleted s3://${S3_BUCKET}/${key}` });
    } catch (err) {
        console.error('[adminMedia] s3 delete error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/admin/media/browse/gcs — Delete a raw GCS key ────────────────
router.delete('/browse/gcs', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ success: false, message: 'key required' });
        await deleteFromGCS(key);
        await query(`DELETE FROM deployment_files WHERE url LIKE $1`, [`%${key}%`]).catch(() => {});
        res.json({ success: true, message: `Deleted gs://${GCS_BUCKET}/${key}` });
    } catch (err) {
        console.error('[adminMedia] gcs delete error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/admin/media/:id/send-to-ai ──────────────────────────────────────
// Runs a direct Gemini AI inspection analysis on the file and saves the report
// to deployment_files as a JSON report record. Does NOT depend on thermal_images.
router.post('/:id/send-to-ai', async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;

        // Fetch the file record
        const fileRes = await query(
            `SELECT df.*, d.id AS deployment_id, d.title AS mission_title,
                    d.site_name, d.type AS mission_type
             FROM deployment_files df
             LEFT JOIN deployments d ON d.id = df.deployment_id
             WHERE df.id = $1`,
            [id]
        );
        if (!fileRes.rows.length) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        const file = fileRes.rows[0];

        // ── Run AI analysis via Gemini ────────────────────────────────────────
        let reportText = null;
        let analysisResult = null;
        const isImage = /\.(jpg|jpeg|png|webp|tif|tiff|dng|raw)$/i.test(file.name || '');
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

        if (GEMINI_API_KEY) {
            const prompt = [
                `You are an expert drone inspection analyst. Analyze the following file metadata and generate a structured inspection report.`,
                ``,
                `File: ${file.name}`,
                `Mission: ${file.mission_title || 'Not specified'}`,
                `Site: ${file.site_name || 'Not specified'}`,
                `Industry Type: ${file.mission_type || 'Solar / Utility'}`,
                `File Size: ${Math.round((file.size || 0) / 1024)} KB`,
                `Upload Type: ${file.upload_type || 'Unknown'}`,
                `Image Type: ${isImage ? 'Aerial image' : 'Data file'}`,
                ``,
                `Generate a concise AI Inspection Report with these sections:`,
                `1. SUMMARY: One-paragraph overview`,
                `2. POTENTIAL FINDINGS: 3-5 likely observations`,
                `3. RECOMMENDED ACTIONS: 2-3 follow-up actions`,
                `4. RISK LEVEL: LOW / MEDIUM / HIGH with 1-sentence justification`,
                ``,
                `Be concise. Do not fabricate measurements.`,
            ].join('\n');

            // Exponential backoff retry — handles 429 rate limits gracefully
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const RETRY_DELAYS = [0, 10000, 20000, 30000]; // 0s, 10s, 20s, 30s
            const MODEL = 'gemini-2.0-flash'; // highest free-tier RPM (30 RPM)
            let lastAiErr = null;

            for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
                if (RETRY_DELAYS[attempt] > 0) {
                    console.log(`[adminMedia] Waiting ${RETRY_DELAYS[attempt]/1000}s before retry ${attempt}…`);
                    await sleep(RETRY_DELAYS[attempt]);
                }
                try {
                    const { GoogleGenerativeAI } = await import('@google/generative-ai');
                    const model = new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: MODEL });
                    const result = await Promise.race([
                        model.generateContent(prompt),
                        new Promise((_, r) => setTimeout(() => r(new Error('AI timeout')), 25000)),
                    ]);
                    reportText = result.response.text();
                    console.log(`[adminMedia] AI success (attempt ${attempt + 1})`);
                    break;
                } catch (aiErr) {
                    lastAiErr = aiErr;
                    const is429 = aiErr.message?.includes('429') || aiErr.status === 429;
                    console.warn(`[adminMedia] attempt ${attempt + 1} failed (429=${is429}): ${aiErr.message}`);
                    if (!is429) break; // don't retry non-rate-limit errors
                }
            }
            if (!reportText && lastAiErr) {
                const is429 = lastAiErr.message?.includes('429') || lastAiErr.status === 429;
                reportText = is429
                    ? `⚠️ Gemini API rate limit reached after retrying.\n\nThe free tier allows 30 requests/minute. If you are using Analyse All on many images, please wait a minute and try individual images, or use the Analyse All button slowly.\n\nFor production use, upgrade to a paid Gemini API key at console.cloud.google.com.`
                    : `⚠️ AI analysis failed: ${lastAiErr.message}`;
            }
        }

        // ── Build analysis result object ──────────────────────────────────────
        const analysedAt = new Date().toISOString();
        analysisResult = {
            fileId:       id,
            fileName:     file.name,
            missionTitle: file.mission_title || null,
            siteName:     file.site_name || null,
            analysedAt,
            aiReport:     reportText || 'AI analysis unavailable — GEMINI_API_KEY not configured or quota exceeded.',
            status:       reportText ? 'complete' : 'no_ai',
        };

        // ── Save report as a deployment_files record (type = ai_report) ───────
        const reportName = `AI_Report_${(file.name || 'file').replace(/\.[^.]+$/, '')}_${Date.now()}.json`;
        const reportContent = JSON.stringify(analysisResult, null, 2);

        let reportFileId = null;
        try {
            const ins = await query(
                `INSERT INTO deployment_files
                    (deployment_id, name, url, type, size, created_at)
                 VALUES ($1, $2, $3, 'ai_report', $4, NOW())
                 RETURNING id`,
                [
                    file.deployment_id || null,
                    reportName,
                    `data:application/json;base64,${Buffer.from(reportContent).toString('base64')}`,
                    Buffer.byteLength(reportContent),
                ]
            );
            reportFileId = ins.rows[0]?.id;
        } catch (saveErr) {
            console.warn('[adminMedia] report save failed (non-fatal):', saveErr.message);
        }

        res.json({
            success:      true,
            message:      reportText ? 'AI analysis complete — report generated' : 'Analysis queued (no AI key configured)',
            fileId:       id,
            reportFileId,
            analysis:     analysisResult,
        });
    } catch (err) {
        console.error('[adminMedia] send-to-ai error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
