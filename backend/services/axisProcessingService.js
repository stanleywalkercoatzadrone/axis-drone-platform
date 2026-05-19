/**
 * Axis Processing Engine™ Service
 * White-labeled wrapper for the PIX4Dengine Cloud REST API v3.
 *
 * Correct API base (confirmed from official docs):
 *   https://cloud.pix4d.com/project/api/v3
 *
 * Full upload flow:
 *   1. POST   /projects/                            → create project, get id + S3 bucket/path
 *   2. GET    /projects/{id}/s3_credentials/        → get temp AWS credentials
 *   3. AWS S3 putObject (using temp creds)          → upload each image
 *   4. POST   /projects/{id}/inputs/bulk_register/  → register uploaded S3 keys
 *   5. POST   /projects/{id}/start_processing/      → kick off photogrammetry
 *   6. GET    /projects/{id}/                       → poll public_status
 *   7. GET    /projects/{id}/                       → parse outputs on DONE
 */

import { Storage } from '@google-cloud/storage';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// All API calls use this base — confirmed from official Pix4D Engine docs
const PIX4D_BASE_URL = process.env.PIX4D_API_URL || 'https://cloud.pix4d.com';
const PIX4D_API_URL  = `${PIX4D_BASE_URL}/project/api/v3`;

export class AxisProcessingService {
    constructor() {
        this.token          = null;
        this.tokenExpiresAt = null;
        try {
            this.gcs = new Storage();
        } catch (e) {
            console.warn('[AxisProcessingService] GCS not configured:', e.message);
            this.gcs = null;
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    async authenticate() {
        // Re-use token until 60 seconds before expiry
        if (this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60_000) return;

        const clientId     = process.env.PIX4D_CLIENT_ID;
        const clientSecret = process.env.PIX4D_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error('[AxisProcessingEngine] PIX4D_CLIENT_ID / PIX4D_CLIENT_SECRET not set');
        }

        const body = `grant_type=client_credentials&token_format=jwt&client_id=${clientId}&client_secret=${clientSecret}`;
        const res  = await fetch(`${PIX4D_BASE_URL}/oauth2/token/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`[AxisProcessingEngine] Auth failure: ${res.status} — ${txt}`);
        }

        const data = await res.json();
        this.token          = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in || 172800) * 1000;
    }

    async getHeaders() {
        await this.authenticate();
        return {
            Authorization:  `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept:         'application/json',
        };
    }

    // ── Create + Upload + Start ───────────────────────────────────────────────

    async uploadToProcessingEngine(fileUrls = [], metadata = {}, jobId = null) {
        // Demo mode (no images supplied)
        if (!fileUrls || fileUrls.length === 0) {
            const axis_project_id = `axis-demo-${uuidv4().slice(0, 8)}`;
            return { axis_project_id, status: 'uploaded', fileCount: 0, isDemo: true };
        }

        // 1. Create Pix4D project
        const prjRes = await fetch(`${PIX4D_API_URL}/projects/`, {
            method:  'POST',
            headers: await this.getHeaders(),
            body:    JSON.stringify({ name: `axis-job-${uuidv4().slice(0, 8)}` }),
        });
        if (!prjRes.ok) {
            throw new Error(`[AxisProcessingEngine] Create project failed: ${prjRes.status} — ${await prjRes.text()}`);
        }
        const prj        = await prjRes.json();
        const projectId  = prj.id;          // integer
        const s3BasePath = prj.s3_base_path;
        const s3Bucket   = prj.bucket_name;

        console.log(`[AxisProcessingService] Project created: id=${projectId} bucket=${s3Bucket} path=${s3BasePath}`);

        // 2. Get temporary S3 credentials issued by Pix4D
        const credRes = await fetch(`${PIX4D_API_URL}/projects/${projectId}/s3_credentials/`, {
            headers: await this.getHeaders(),
        });
        if (!credRes.ok) {
            throw new Error(`[AxisProcessingEngine] S3 credentials failed: ${credRes.status}`);
        }
        const creds = await credRes.json();

        // 3. Build an AWS S3 client using Pix4D's temp credentials
        const AWS = (await import('aws-sdk')).default;
        const s3  = new AWS.S3({
            accessKeyId:          creds.access_key,
            secretAccessKey:      creds.secret_key,
            sessionToken:         creds.session_token,
            region:               creds.region || 'us-east-1',
            useAccelerateEndpoint: !!creds.is_bucket_accelerated,
        });

        // 4. Upload each GCS image to Pix4D's S3
        const gcsBucket    = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';
        const uploadedKeys = [];

        console.log(`[AxisProcessingService] Upload start: ${fileUrls.length} files, GCS bucket="${gcsBucket}", S3 project=${projectId}`);

        if (!this.gcs) {
            throw new Error('[AxisProcessingEngine] GCS client not initialised — cannot download source images');
        }

        for (let fi = 0; fi < fileUrls.length; fi++) {
            const filePath = fileUrls[fi];
            try {
                const filename = filePath.split('/').pop() || 'image.jpg';
                const s3Key    = `${s3BasePath}/${filename}`;

                const [fileBuffer] = await this.gcs.bucket(gcsBucket).file(filePath).download();

                await s3.putObject({
                    Bucket:      s3Bucket,
                    Key:         s3Key,
                    Body:        fileBuffer,
                    ContentType: 'image/jpeg',
                }).promise();

                uploadedKeys.push(s3Key);
                if (fi === 0 || (fi + 1) % 10 === 0 || fi === fileUrls.length - 1) {
                    console.log(`[AxisProcessingService] Uploaded ${fi + 1}/${fileUrls.length}: ${filename}`);
                }

                // Update progress_pct (0–85% for image transfer; 85–100% for Pix4D processing)
                if (jobId) {
                    const pct = Math.round(((fi + 1) / fileUrls.length) * 85);
                    await query(
                        `UPDATE orthomosaic_jobs SET progress_pct = $1, pipeline_stage = 'Transferring to engine', updated_at = NOW() WHERE id = $2`,
                        [pct, jobId]
                    ).catch(() => {});
                }
            } catch (err) {
                console.warn(`[AxisProcessingService] UPLOAD FAILED ${filePath}: ${err.message}`);
            }
        }

        console.log(`[AxisProcessingService] Upload complete: ${uploadedKeys.length}/${fileUrls.length} succeeded`);

        if (uploadedKeys.length === 0) {
            throw new Error(`[AxisProcessingEngine] 0/${fileUrls.length} images uploaded. Check GCS bucket "${gcsBucket}" and file paths.`);
        }

        // 5. Register the uploaded S3 keys as project inputs
        const regRes  = await fetch(`${PIX4D_API_URL}/projects/${projectId}/inputs/bulk_register/`, {
            method:  'POST',
            headers: await this.getHeaders(),
            body:    JSON.stringify({ input_file_keys: uploadedKeys }),
        });
        const regText = await regRes.text();
        let regData   = {};
        try { regData = JSON.parse(regText); } catch (_) {}
        console.log(`[AxisProcessingService] bulk_register: HTTP ${regRes.status}, registered=${regData.nb_images_registered}, sent=${uploadedKeys.length}`);

        if (!regRes.ok) {
            throw new Error(`[AxisProcessingEngine] bulk_register HTTP ${regRes.status}: ${regText.slice(0, 200)}`);
        }
        if ((regData.nb_images_registered ?? -1) === 0) {
            console.warn(`[AxisProcessingService] WARNING: 0 images registered despite ${uploadedKeys.length} S3 uploads. First key: ${uploadedKeys[0]}`);
        }

        // 6. Start processing
        await this.startProcessing(String(projectId));

        return {
            axis_project_id: String(projectId),
            status:          'processing',
            fileCount:       uploadedKeys.length,
        };
    }

    async startProcessing(axis_project_id) {
        if (axis_project_id.startsWith('axis-demo-')) {
            return { axis_project_id, status: 'processing' };
        }

        const res = await fetch(`${PIX4D_API_URL}/projects/${axis_project_id}/start_processing/`, {
            method:  'POST',
            headers: await this.getHeaders(),
            body:    JSON.stringify({ quality: 2 }),  // quality 1=fast, 2=standard, 3=high
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`[AxisProcessingEngine] Start processing failed: ${res.status} — ${txt}`);
        }
        const result = await res.json().catch(() => ({}));
        console.log(`[AxisProcessingService] Processing started for project ${axis_project_id} — estimated ${result.estimated_time}s`);
        return { axis_project_id, status: 'processing' };
    }

    // ── Status polling ────────────────────────────────────────────────────────

    async pollProcessingStatus(axis_project_id) {
        // Demo mode — simulate progress (no real project, or demo prefix)
        if (!axis_project_id || axis_project_id.startsWith('axis-demo-')) {
            this._demoProgress = Math.min((this._demoProgress || 0) + Math.floor(Math.random() * 20) + 10, 100);
            if (this._demoProgress >= 100) {
                return { axis_project_id, status: 'completed', progress: 100 };
            }
            return { axis_project_id, status: 'processing', progress: this._demoProgress };
        }

        const res = await fetch(`${PIX4D_API_URL}/projects/${axis_project_id}/`, {
            headers: await this.getHeaders(),
        });
        if (!res.ok) {
            throw new Error(`[AxisProcessingEngine] Status poll failed: ${res.status}`);
        }
        const data = await res.json();

        // Pix4D public_status values: PROCESSING, DONE, FAILED, ERROR, WAITING, CANCELED
        const statusMap = {
            PROCESSING: 'processing',
            WAITING:    'queued',
            DONE:       'completed',
            FAILED:     'failed',
            ERROR:      'failed',
            CANCELED:   'canceled',
        };

        return {
            axis_project_id,
            status:   statusMap[data.public_status] || 'processing',
            progress: data.public_status === 'DONE' ? 100 : null,
            detail:   data.display_detailed_status || null,
            error:    data.error_reason || null,
        };
    }

    // ── Output retrieval ──────────────────────────────────────────────────────

    async fetchOutputs(axis_project_id) {
        if (!axis_project_id || axis_project_id.startsWith('axis-demo-')) {
            return [];
        }

        const res = await fetch(`${PIX4D_API_URL}/projects/${axis_project_id}/`, {
            headers: await this.getHeaders(),
        });
        if (!res.ok) {
            throw new Error(`[AxisProcessingEngine] Fetch project failed: ${res.status}`);
        }
        const data = await res.json();

        // Diagnostic log so we can see the real Pix4D response shape
        console.log(`[AxisProcessingService] Project ${axis_project_id} status=${data.public_status} detail_url=${data.detail_url} keys=${Object.keys(data).join(',')}`);
        if (data.outputs) console.log(`[AxisProcessingService] outputs keys: ${Object.keys(data.outputs).join(',')}`);

        if (data.public_status !== 'DONE') {
            console.warn(`[AxisProcessingService] fetchOutputs: project ${axis_project_id} not DONE yet (${data.public_status})`);
            return [];
        }

        const outputs = [];

        // ── Always emit the Pix4D cloud viewer as the primary output ──
        // NOTE: removed — Pix4D viewer URLs require account login.
        // Only real file-level outputs (orthomosaic TIFs etc) are returned.

        // ── Flexibly walk response for downloadable file assets ──
        const bucket  = data.bucket_name || '';
        // toS3Url returns null if bucket is empty — prevents NoSuchBucket presigned URL errors
        const toS3Url = (key) => (key && bucket) ? `https://${bucket}.s3.amazonaws.com/${key}` : null;
        const URL_KEYS = ['s3_key', 'url', 'download_url', 'href', 'file_url', 'signed_url'];

        const walk = (obj, prefix) => {
            if (!obj || typeof obj !== 'object') return;
            const isReady = obj.status === 'processed' || obj.status === 'DONE'
                || obj.available === true || obj.ready === true;
            if (isReady) {
                for (const key of URL_KEYS) {
                    if (obj[key] && typeof obj[key] === 'string') {
                        const url = key === 's3_key' ? toS3Url(obj[key]) : obj[key];
                        // Only push if URL is valid and has a non-empty hostname
                        if (url && url.startsWith('https://') && !url.startsWith('https://.')) {
                            outputs.push({ type: prefix || key, axis_url: url });
                            return;
                        }
                    }
                }
            }
            for (const [k, v] of Object.entries(obj)) {
                if (typeof v === 'object' && v !== null) {
                    walk(v, prefix ? `${prefix}_${k}` : k);
                }
            }
        };

        if (data.outputs) walk(data.outputs, '');
        if (data.files)   walk(data.files,   '');
        if (data.results) walk(data.results, '');

        console.log(`[AxisProcessingService] fetchOutputs resolved ${outputs.length} item(s): ${outputs.map(o => o.type).join(', ')}`);
        return outputs.filter(o => o.axis_url);
    }

    // ── Generate a presigned S3 download URL for a Pix4D output file ──────────

    async generatePresignedDownloadUrl(pix4dProjectId, s3Url, expirySeconds = 3600) {
        // Only valid for numeric Pix4D project IDs
        if (!pix4dProjectId || !/^\d+$/.test(String(pix4dProjectId))) {
            throw new Error('generatePresignedDownloadUrl requires a numeric Pix4D project ID');
        }
        // Parse bucket + key from the S3 URL
        // Format: https://{bucket}.s3.amazonaws.com/{key}
        const url    = new URL(s3Url);
        const bucket = url.hostname.split('.s3.')[0];
        const key    = decodeURIComponent(url.pathname.slice(1));
        if (!bucket || bucket.trim() === '') throw new Error(`Empty bucket in S3 URL — bad URL: ${s3Url}`);
        if (!key) throw new Error(`Cannot extract key from S3 URL: ${s3Url}`);

        // Get fresh Pix4D-issued credentials for this project
        const credRes = await fetch(`${PIX4D_API_URL}/projects/${pix4dProjectId}/s3_credentials/`, {
            headers: await this.getHeaders(),
        });
        if (!credRes.ok) throw new Error(`S3 credentials fetch failed: ${credRes.status}`);
        const creds = await credRes.json();

        const AWS = (await import('aws-sdk')).default;
        const s3  = new AWS.S3({
            accessKeyId:     creds.access_key,
            secretAccessKey: creds.secret_key,
            sessionToken:    creds.session_token,
            region:          creds.region || 'us-east-1',
        });

        return s3.getSignedUrlPromise('getObject', {
            Bucket:  bucket,
            Key:     key,
            Expires: expirySeconds,
        });
    }

    // ── DB helper ─────────────────────────────────────────────────────────────

    async saveToAxisDB(axis_project_id, mission_id, status, asset_urls) {
        await query(
            `INSERT INTO processing_jobs (axis_project_id, mission_id, status, artifacts)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (axis_project_id) DO UPDATE SET status = $3, artifacts = $4`,
            [axis_project_id, mission_id, status, JSON.stringify(asset_urls)]
        );
    }
}

export const processingEngine = new AxisProcessingService();
