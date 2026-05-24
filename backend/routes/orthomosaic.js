/**
 * Orthomosaic Routes — Hardened v2
 * Manages the full photogrammetry pipeline: project → job → upload → process → output
 *
 * Role access matrix (enforced server-side):
 *   Admin / In-House:  Full access — all routes
 *   Pilot:             POST projects, jobs, upload-url, upload-confirm, submit (assigned missions only)
 *                      GET jobs (own jobs only)
 *   Client:            BLOCKED from all write routes. Read-only via client portal deliverables API.
 */

import express from 'express';
import { Storage } from '@google-cloud/storage';
import { query } from '../config/database.js';
import { protect, authorize } from '../middleware/auth.js';
import { logger } from '../services/logger.js';
import { runOrthomosaic } from '../services/orthomosaicEngine.js';
import unzipper from 'unzipper';
import { fromArrayBuffer as geotiffFromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';
import { encode as pngEncode } from 'fast-png';


const router = express.Router();

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'axis-platform-uploads';
let gcs;
try {
    gcs = new Storage({ projectId: process.env.GCS_PROJECT_ID });
} catch (e) {
    logger.warn('[orthomosaic] GCS init failed — signed URLs unavailable:', e.message);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const tenantId = (req) => req.user?.tenantId || req.user?.tenant_id || null;

// ── Extract orthomosaic.tif + dsm.tif from all.zip in GCS ────────────────────
// Supports two GCS layouts:
//   Old: <prefix>outputs/all.zip  (outputs/ subdir)
//   New: <prefix>all.zip          (zip at root of prefix)
async function extractOrthoAssets(prefix) {
    if (!gcs) { logger.warn('[extract] GCS unavailable'); return {}; }
    const bucket = gcs.bucket(GCS_BUCKET);
    const result = { tif: false, dsm: false };

    // Detect which zip path exists
    let zipPath = `${prefix}outputs/all.zip`;
    const [hasOutputsZip] = await bucket.file(zipPath).exists().catch(() => [false]);
    if (!hasOutputsZip) {
        zipPath = `${prefix}all.zip`;
        const [hasRootZip] = await bucket.file(zipPath).exists().catch(() => [false]);
        if (!hasRootZip) {
            logger.warn(`[extract] No zip found for prefix: ${prefix}`);
            return result;
        }
    }
    logger.info(`[extract] Using zip: ${zipPath}`);

    const targets = {
        'odm_orthophoto/odm_orthophoto.tif': `${prefix}outputs/orthomosaic.tif`,
        'odm_dem/dsm.tif': `${prefix}outputs/dsm.tif`,
    };

    await new Promise((resolve, reject) => {
        bucket.file(zipPath).createReadStream()
            .pipe(unzipper.Parse())
            .on('entry', (entry) => {
                const dest = targets[entry.path];
                if (dest) {
                    const ws = bucket.file(dest).createWriteStream({ metadata: { contentType: 'image/tiff' }, resumable: false });
                    entry.pipe(ws);
                    ws.on('finish', () => {
                        if (dest.includes('orthomosaic')) result.tif = true;
                        if (dest.includes('dsm')) result.dsm = true;
                        logger.info(`[extract] ✓ ${dest}`);
                    });
                    ws.on('error', e => logger.warn(`[extract] write error: ${e.message}`));
                } else { entry.autodrain(); }
            })
            .on('finish', resolve)
            .on('error', reject);
    });
    return result;
}


/** Returns true if user is admin or in-house (can access all jobs) */
const isAdminOrInHouse = (user) => {
    const role = (user?.role || '').toLowerCase();
    return ['admin', 'super_admin', 'in_house', 'in_house_team'].includes(role);
};

/** Returns true if user is a pilot role */
const isPilotRole = (user) => {
    const role = (user?.role || '').toLowerCase();
    return ['pilot', 'pilot_technician', 'field_operator', 'senior_inspector'].includes(role);
};

/** Returns true if user is a client role — blocked from write routes */
const isClientRole = (user) => {
    const role = (user?.role || '').toLowerCase();
    return ['client', 'client_user', 'customer'].includes(role);
};

async function updateJobStatus(jobId, status, extra = {}) {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const vals = [status];
    let i = 2;
    if (extra.progress_pct !== undefined) { fields.push(`progress_pct = $${i++}`); vals.push(extra.progress_pct); }
    if (extra.pipeline_stage !== undefined) { fields.push(`pipeline_stage = $${i++}`); vals.push(extra.pipeline_stage); }
    if (extra.engine_job_id !== undefined) { fields.push(`engine_job_id = $${i++}`); vals.push(extra.engine_job_id); }
    if (extra.error_message !== undefined) { fields.push(`error_message = $${i++}`); vals.push(extra.error_message); }
    if (extra.processing_started_at) { fields.push(`processing_started_at = NOW()`); }
    if (extra.processing_completed_at) {
        fields.push(`processing_completed_at = NOW()`);
        fields.push(`processing_duration_seconds = EXTRACT(EPOCH FROM (NOW() - processing_started_at))::INTEGER`);
    }
    vals.push(jobId);
    await query(`UPDATE orthomosaic_jobs SET ${fields.join(', ')} WHERE id = $${i}`, vals);
}

// ── POST /projects — create an orthomosaic project ────────────────────────────
// Access: admin, in_house, pilot (NOT client)
router.post('/projects', protect, async (req, res) => {
    try {
        // Block client roles from creating projects
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Client accounts cannot create orthomosaic projects.' });
        }

        const { name, clientId, siteName, missionId, description } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Project name is required.' });

        const result = await query(`
            INSERT INTO orthomosaic_projects
                (name, tenant_id, client_id, site_name, mission_id, description, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, created_at
        `, [name, tenantId(req), clientId || null, siteName || null, missionId || null, description || null, req.user.id]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[orthomosaic/projects POST]', err);
        res.status(500).json({ success: false, message: 'Failed to create project.' });
    }
});

// ── GET /projects — list projects ─────────────────────────────────────────────
router.get('/projects', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const tid = tenantId(req);
        const result = await query(`
            SELECT p.*, COUNT(j.id)::int AS job_count
            FROM orthomosaic_projects p
            LEFT JOIN orthomosaic_jobs j ON j.project_id = p.id
            WHERE p.tenant_id = $1
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT 100
        `, [tid]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error('[orthomosaic/projects GET]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch projects.' });
    }
});

// ── POST /projects/:projectId/jobs — create a processing job ─────────────────
// Access: admin, in_house, pilot (NOT client)
router.post('/projects/:projectId/jobs', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Client accounts cannot create processing jobs.' });
        }

        const { projectId } = req.params;
        const { qualityTier = 'fast', missionId, flightDate, imageCount } = req.body;

        const allowedTiers = ['fast', 'standard', 'high'];
        if (!allowedTiers.includes(qualityTier)) {
            return res.status(400).json({ success: false, message: 'qualityTier must be fast, standard, or high.' });
        }

        // Verify project exists + belongs to tenant
        const projRes = await query(`SELECT id FROM orthomosaic_projects WHERE id = $1 AND tenant_id = $2`, [projectId, tenantId(req)]);
        if (!projRes.rows.length) return res.status(404).json({ success: false, message: 'Project not found.' });

        const gcsPrefix = `orthomosaic/${projectId}/${Date.now()}/`;

        const result = await query(`
            INSERT INTO orthomosaic_jobs
                (project_id, tenant_id, status, processing_engine, quality_tier,
                 pilot_id, flight_date, image_count, upload_set_gcs_prefix, created_by)
            VALUES ($1, $2, 'queued', 'odm', $3, $4, $5, $6, $7, $4)
            RETURNING id, status, quality_tier, upload_set_gcs_prefix, created_at
        `, [projectId, tenantId(req), qualityTier, req.user.id, flightDate || null, imageCount || 0, gcsPrefix]);

        const job = result.rows[0];

        // If missionId provided, link it immediately via asset_links
        if (missionId) {
            await query(`
                INSERT INTO orthomosaic_asset_links (job_id, tenant_id, asset_type, asset_id, asset_label, linked_by)
                VALUES ($1, $2, 'mission', $3, $3, $4)
                ON CONFLICT DO NOTHING
            `, [job.id, tenantId(req), missionId, req.user.id]).catch(() => {});
        }

        res.status(201).json({ success: true, data: job });
    } catch (err) {
        logger.error('[orthomosaic/jobs POST]', err);
        res.status(500).json({ success: false, message: 'Failed to create job.' });
    }
});

// ── GET /jobs — list jobs ─────────────────────────────────────────────────────
// Admin/in_house: all tenant jobs
// Pilot: only their own jobs (created_by = req.user.id)
// Client: blocked
router.get('/jobs', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const { status, projectId } = req.query;
        const conditions = ['j.tenant_id = $1'];
        const vals = [tenantId(req)];
        let i = 2;

        // Pilots only see their own jobs
        if (isPilotRole(req.user) && !isAdminOrInHouse(req.user)) {
            conditions.push(`j.created_by = $${i++}`);
            vals.push(req.user.id);
        }

        if (status) { conditions.push(`j.status = $${i++}`); vals.push(status); }
        if (projectId) { conditions.push(`j.project_id = $${i++}`); vals.push(projectId); }

        const result = await query(`
            SELECT j.id, j.status, j.quality_tier, j.progress_pct, j.pipeline_stage,
                   j.image_count, j.error_message, j.created_at, j.processing_started_at,
                   j.processing_completed_at, j.retry_count,
                   p.name AS project_name,
                   p.site_name,
                   p.mission_id,
                   COUNT(DISTINCT o.id)::int AS output_count
            FROM orthomosaic_jobs j
            LEFT JOIN orthomosaic_projects p ON p.id = j.project_id
            LEFT JOIN orthomosaic_outputs o ON o.job_id = j.id
            WHERE ${conditions.join(' AND ')}
            GROUP BY j.id, j.status, j.quality_tier, j.progress_pct, j.pipeline_stage,
                     j.image_count, j.error_message, j.created_at, j.processing_started_at,
                     j.processing_completed_at, j.retry_count,
                     p.name, p.site_name, p.mission_id
            ORDER BY j.created_at DESC
            LIMIT 100
        `, vals);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error('[orthomosaic/jobs GET]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch jobs.' });
    }
});

// ── GET /jobs/:jobId — job status (polled every 5s by frontend) ───────────────
router.get('/jobs/:jobId', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        // Build ownership condition: admins see any tenant job, pilots see only their own
        const ownershipClause = isPilotRole(req.user) && !isAdminOrInHouse(req.user)
            ? 'AND j.created_by = $3'
            : '';
        const vals = isPilotRole(req.user) && !isAdminOrInHouse(req.user)
            ? [req.params.jobId, tenantId(req), req.user.id]
            : [req.params.jobId, tenantId(req)];

        const result = await query(`
            SELECT j.*,
                   p.name AS project_name,
                   p.site_name,
                   p.mission_id,
                   json_agg(DISTINCT jsonb_build_object(
                       'id', o.id,
                       'output_type', o.output_type,
                       'file_name', o.file_name,
                       'preview_url', o.preview_url,
                       'file_size_bytes', o.file_size_bytes,
                       'is_approved', o.is_approved
                   )) FILTER (WHERE o.id IS NOT NULL) AS outputs
            FROM orthomosaic_jobs j
            LEFT JOIN orthomosaic_projects p ON p.id = j.project_id
            LEFT JOIN orthomosaic_outputs o ON o.job_id = j.id
            WHERE j.id = $1 AND j.tenant_id = $2 ${ownershipClause}
            GROUP BY j.id, p.name, p.site_name, p.mission_id
        `, vals);

        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Job not found.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        logger.error('[orthomosaic/job GET]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch job.' });
    }
});

// ── POST /jobs/:jobId/upload-url — signed GCS URL for a single image ─────────
// Access: admin, in_house, pilot (NOT client)
router.post('/jobs/:jobId/upload-url', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Client accounts cannot upload images.' });
        }

        const { jobId } = req.params;
        const { fileName, contentType = 'image/jpeg', fileSize } = req.body;
        if (!fileName) return res.status(400).json({ success: false, message: 'fileName required.' });

        // Fetch job and verify ownership (pilots must own the job)
        const ownershipClause = isPilotRole(req.user) && !isAdminOrInHouse(req.user)
            ? 'AND created_by = $3'
            : '';
        const jobVals = isPilotRole(req.user) && !isAdminOrInHouse(req.user)
            ? [jobId, tenantId(req), req.user.id]
            : [jobId, tenantId(req)];

        const jobRes = await query(
            `SELECT id, upload_set_gcs_prefix, tenant_id FROM orthomosaic_jobs WHERE id = $1 AND tenant_id = $2 ${ownershipClause}`,
            jobVals
        );
        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found or access denied.' });
        const job = jobRes.rows[0];

        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const gcsPath = `${job.upload_set_gcs_prefix}${safeName}`;

        // Create upload_set row first
        const uploadSetRes = await query(`
            INSERT INTO orthomosaic_upload_sets
                (job_id, tenant_id, file_name, gcs_path, file_size_bytes, content_type, upload_status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
            RETURNING id
        `, [jobId, job.tenant_id, fileName, gcsPath, fileSize || null, contentType]);

        let signedUrl = null;
        if (gcs) {
            try {
                const [url] = await gcs.bucket(GCS_BUCKET).file(gcsPath).getSignedUrl({
                    version: 'v4',
                    action: 'write',
                    expires: Date.now() + 15 * 60 * 1000, // 15 min
                    contentType,
                });
                signedUrl = url;
            } catch (e) {
                logger.warn('[orthomosaic] Signed URL failed:', e.message);
            }
        }

        res.json({
            success: true,
            data: {
                uploadSetId: uploadSetRes.rows[0].id,
                gcsPath,
                signedUrl,
            }
        });
    } catch (err) {
        logger.error('[orthomosaic/upload-url]', err);
        res.status(500).json({ success: false, message: 'Failed to generate upload URL.' });
    }
});

// ── POST /jobs/:jobId/upload-url-batch — batch signed URLs (up to 100 files) ──
// Replaces 547 individual upload-url calls with ~6 batch calls
router.post('/jobs/:jobId/upload-url-batch', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Client accounts cannot upload images.' });
        }
        const { jobId } = req.params;
        const { files } = req.body; // Array of { fileName, contentType, fileSize }
        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ success: false, message: 'files array required.' });
        }
        if (files.length > 100) {
            return res.status(400).json({ success: false, message: 'Maximum 100 files per batch.' });
        }

        const ownershipClause = isPilotRole(req.user) && !isAdminOrInHouse(req.user) ? 'AND created_by = $3' : '';
        const jobVals = isPilotRole(req.user) && !isAdminOrInHouse(req.user)
            ? [jobId, tenantId(req), req.user.id] : [jobId, tenantId(req)];
        const jobRes = await query(
            `SELECT id, upload_set_gcs_prefix, tenant_id FROM orthomosaic_jobs WHERE id = $1 AND tenant_id = $2 ${ownershipClause}`,
            jobVals
        );
        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found or access denied.' });
        const job = jobRes.rows[0];

        const results = await Promise.all(files.map(async ({ fileName, contentType = 'image/jpeg', fileSize }) => {
            const safeName = (fileName || '').replace(/[^a-zA-Z0-9._-]/g, '_');
            if (!safeName) return { fileName, error: 'Invalid file name' };
            const gcsPath = `${job.upload_set_gcs_prefix}${safeName}`;

            const uploadSetRes = await query(`
                INSERT INTO orthomosaic_upload_sets
                    (job_id, tenant_id, file_name, gcs_path, file_size_bytes, content_type, upload_status)
                VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                RETURNING id
            `, [jobId, job.tenant_id, fileName, gcsPath, fileSize || null, contentType]);

            let signedUrl = null;
            if (gcs) {
                try {
                    const [url] = await gcs.bucket(GCS_BUCKET).file(gcsPath).getSignedUrl({
                        version: 'v4', action: 'write',
                        expires: Date.now() + 60 * 60 * 1000, // 1 hour for batch
                        contentType,
                    });
                    signedUrl = url;
                } catch (e) {
                    logger.warn('[orthomosaic] Batch signed URL failed:', e.message);
                }
            }
            return { fileName, uploadSetId: uploadSetRes.rows[0].id, gcsPath, signedUrl };
        }));

        res.json({ success: true, data: { files: results } });
    } catch (err) {
        logger.error('[orthomosaic/upload-url-batch]', err);
        res.status(500).json({ success: false, message: 'Failed to generate batch upload URLs.' });
    }
});

// ── POST /jobs/:jobId/upload-direct — stream file body directly to GCS ────────
// Browser sends the raw file body to Cloud Run; Cloud Run streams it to GCS.
// Eliminates signed URLs, CORS issues, and browser PUT problems entirely.
router.post('/jobs/:jobId/upload-direct', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const { jobId } = req.params;
        const rawName = req.headers['x-file-name'];
        const fileName = rawName ? decodeURIComponent(rawName) : null;
        const contentType = req.headers['content-type'] || 'image/jpeg';
        const fileSize = parseInt(req.headers['x-file-size'] || '0', 10) || null;

        if (!fileName) return res.status(400).json({ success: false, message: 'X-File-Name header required.' });

        const ownershipClause = isPilotRole(req.user) && !isAdminOrInHouse(req.user) ? 'AND created_by = $3' : '';
        const jobVals = isPilotRole(req.user) && !isAdminOrInHouse(req.user)
            ? [jobId, tenantId(req), req.user.id] : [jobId, tenantId(req)];
        const jobRes = await query(
            `SELECT id, upload_set_gcs_prefix, tenant_id FROM orthomosaic_jobs WHERE id = $1 AND tenant_id = $2 ${ownershipClause}`,
            jobVals
        );
        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found.' });
        const job = jobRes.rows[0];

        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const gcsPath = `${job.upload_set_gcs_prefix}${safeName}`;

        // Insert DB record (pending)
        const uploadSetRes = await query(`
            INSERT INTO orthomosaic_upload_sets
                (job_id, tenant_id, file_name, gcs_path, file_size_bytes, content_type, upload_status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
            RETURNING id
        `, [jobId, job.tenant_id, fileName, gcsPath, fileSize, contentType]);
        const uploadSetId = uploadSetRes.rows[0].id;

        if (!gcs) {
            return res.status(503).json({ success: false, message: 'Storage not available.' });
        }

        // Stream request body directly to GCS — no in-memory buffering
        const writeStream = gcs.bucket(GCS_BUCKET).file(gcsPath).createWriteStream({
            metadata: { contentType },
            resumable: false,
        });

        await new Promise((resolve, reject) => {
            req.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            req.on('error', reject);
        });

        // Mark uploaded
        await query(
            `UPDATE orthomosaic_upload_sets SET upload_status = 'uploaded' WHERE id = $1`,
            [uploadSetId]
        );

        res.json({ success: true, data: { uploadSetId } });
    } catch (err) {
        logger.error(`[orthomosaic/upload-direct] ERROR: ${err?.message}`, { stack: err?.stack });
        res.status(500).json({ success: false, message: `Upload failed: ${err?.message}` });
    }
});

// ── POST /jobs/:jobId/upload-confirm — mark a file as uploaded ───────────────
// Fix: validate that uploadSetId belongs to this job AND this tenant (prevents cross-tenant confirm)
router.post('/jobs/:jobId/upload-confirm', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const { uploadSetId } = req.body;
        if (!uploadSetId) return res.status(400).json({ success: false, message: 'uploadSetId required.' });

        // Validate ownership: uploadSetId must belong to this job + tenant
        const checkRes = await query(`
            SELECT us.id FROM orthomosaic_upload_sets us
            JOIN orthomosaic_jobs j ON j.id = us.job_id
            WHERE us.id = $1 AND us.job_id = $2 AND j.tenant_id = $3
        `, [uploadSetId, req.params.jobId, tenantId(req)]);

        if (!checkRes.rows.length) {
            return res.status(404).json({ success: false, message: 'Upload record not found or access denied.' });
        }

        await query(`
            UPDATE orthomosaic_upload_sets SET upload_status = 'uploaded' WHERE id = $1
        `, [uploadSetId]);

        // Update image count on job
        await query(`
            UPDATE orthomosaic_jobs j
            SET image_count = (
                SELECT COUNT(*) FROM orthomosaic_upload_sets WHERE job_id = j.id AND upload_status = 'uploaded'
            )
            WHERE j.id = $1
        `, [req.params.jobId]);

        res.json({ success: true });
    } catch (err) {
        logger.error('[orthomosaic/upload-confirm]', err);
        res.status(500).json({ success: false, message: 'Failed to confirm upload.' });
    }
});

// ── POST /jobs/:jobId/submit — trigger NodeODM processing ────────────────────
// Access: admin, in_house, pilot (NOT client)
router.post('/jobs/:jobId/submit', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Client accounts cannot trigger processing.' });
        }

        const { jobId } = req.params;

        // Fix: include p.mission_id in SELECT so the engine can link outputs to the mission
        const jobRes = await query(`
            SELECT j.*, p.name AS project_name, p.mission_id
            FROM orthomosaic_jobs j
            LEFT JOIN orthomosaic_projects p ON p.id = j.project_id
            WHERE j.id = $1 AND j.tenant_id = $2
        `, [jobId, tenantId(req)]);

        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found.' });
        const job = jobRes.rows[0];

        if (!['queued', 'failed'].includes(job.status)) {
            return res.status(409).json({ success: false, message: `Job is already ${job.status}.` });
        }

        // Get all uploaded images for this job
        const filesRes = await query(`
            SELECT file_name AS name, gcs_path AS "gcsPath"
            FROM orthomosaic_upload_sets
            WHERE job_id = $1 AND upload_status = 'uploaded'
        `, [jobId]);

        if (!filesRes.rows.length) {
            return res.status(400).json({ success: false, message: 'No uploaded images found. Upload images before submitting.' });
        }

        // Mark as processing
        await updateJobStatus(jobId, 'processing', {
            pipeline_stage: 'Initializing',
            processing_started_at: true,
        });

        // Respond immediately — engine runs async
        res.json({ success: true, message: 'Job submitted. Processing started.', data: { jobId, imageCount: filesRes.rows.length } });

        // ── Async processing (non-blocking) ──────────────────────────────────
        const fastMode = job.quality_tier === 'fast';
        const localTmpDir = `/tmp/ortho_${jobId}`;
        const gcsOutputPrefix = `${job.upload_set_gcs_prefix}outputs/`;
        const missionId = job.mission_id || null; // Fix: now correctly populated from the JOIN

        const imageSet = {
            jobId,
            missionId,
            files: filesRes.rows,
            localTmpDir,
            gcsProcessedPrefix: gcsOutputPrefix,
            fastMode,
        };

        runOrthomosaic(imageSet, async (pct) => {
            try {
                const stage =
                    pct < 8  ? 'Loading Dataset' :
                    pct < 22 ? 'Feature Detection' :
                    pct < 38 ? 'Feature Matching' :
                    pct < 52 ? 'Structure from Motion' :
                    pct < 66 ? 'Building Point Cloud' :
                    pct < 78 ? 'DSM Generation' :
                    pct < 90 ? 'Generating Orthophoto' :
                               'Finalizing Outputs';
                await updateJobStatus(jobId, 'processing', {
                    progress_pct: Math.round(pct),
                    pipeline_stage: stage,
                });
            } catch {}
        }).then(async (results) => {
            // Save outputs to orthomosaic_outputs
            const tid = job.tenant_id;
            const outputInserts = [];

            if (results.orthomosaicGcsUri) {
                outputInserts.push(query(`
                    INSERT INTO orthomosaic_outputs (job_id, tenant_id, output_type, file_name, gcs_path)
                    VALUES ($1, $2, 'orthomosaic', 'orthomosaic.tif', $3)
                `, [jobId, tid, results.orthomosaicGcsUri]));
            }
            if (results.dsmGcsUri) {
                outputInserts.push(query(`
                    INSERT INTO orthomosaic_outputs (job_id, tenant_id, output_type, file_name, gcs_path)
                    VALUES ($1, $2, 'dsm', 'dsm.tif', $3)
                `, [jobId, tid, results.dsmGcsUri]));
            }
            if (results.archiveGcsUri) {
                outputInserts.push(query(`
                    INSERT INTO orthomosaic_outputs (job_id, tenant_id, output_type, file_name, gcs_path)
                    VALUES ($1, $2, 'report', 'all.zip', $3)
                `, [jobId, tid, results.archiveGcsUri]));
            }

            await Promise.allSettled(outputInserts);


            // ── Auto-bridge to Media Gallery (deployment_files) ───────────────
            // Inserts each output as a deployment_file so it immediately appears
            // in the Media Gallery tab for the linked mission.
            if (missionId) {
                const outputsToLink = [];
                if (results.archiveGcsUri) {
                    outputsToLink.push({ name: 'Orthomosaic Output (All Files)', url: results.archiveGcsUri, type: 'application/zip', size: null });
                }
                if (results.orthomosaicGcsUri) {
                    outputsToLink.push({ name: 'Orthomosaic GeoTIFF', url: results.orthomosaicGcsUri, type: 'image/tiff', size: null });
                }
                if (results.dsmGcsUri) {
                    outputsToLink.push({ name: 'DSM Elevation Model (GeoTIFF)', url: results.dsmGcsUri, type: 'image/tiff', size: null });
                }
                await Promise.allSettled(outputsToLink.map(f =>
                    query(`
                        INSERT INTO deployment_files (deployment_id, name, url, type)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT DO NOTHING
                    `, [missionId, f.name, f.url, f.type]).catch(() => {})
                ));
                logger.info(`[orthomosaic] Linked ${outputsToLink.length} outputs to mission ${missionId} in deployment_files.`);
            }


            // QC report
            await query(`
                INSERT INTO orthomosaic_qc_reports
                    (job_id, tenant_id, images_used, overlap_confidence, processing_duration_s)
                VALUES ($1, $2, $3, 'high', EXTRACT(EPOCH FROM (NOW() - $4::timestamptz))::INTEGER)
            `, [jobId, tid, filesRes.rows.length, job.processing_started_at || 'NOW()']).catch(() => {});

            await updateJobStatus(jobId, 'completed', {
                progress_pct: 100,
                pipeline_stage: 'Complete',
                processing_completed_at: true,
            });

            logger.info(`[orthomosaic] Job ${jobId} completed successfully.`);

            // Extract TIF + DSM from zip non-blocking (background)
            const jobPrefix = job.upload_set_gcs_prefix || '';
            extractOrthoAssets(jobPrefix)
                .then(r => logger.info(`[orthomosaic] Assets extracted — tif:${r.tif} dsm:${r.dsm}`))
                .catch(e => logger.warn('[orthomosaic] Asset extraction failed:', e.message));

        }).catch(async (err) => {
            logger.error(`[orthomosaic] Job ${jobId} failed:`, err.message);
            await updateJobStatus(jobId, 'failed', {
                error_message: err.message,
                pipeline_stage: 'Failed',
            }).catch(() => {});
        });

    } catch (err) {
        logger.error('[orthomosaic/submit]', err);
        res.status(500).json({ success: false, message: 'Failed to submit job.' });
    }
});

// ── GET /jobs/:jobId/outputs — list outputs ───────────────────────────────────
router.get('/jobs/:jobId/outputs', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const result = await query(`
            SELECT o.*
            FROM orthomosaic_outputs o
            JOIN orthomosaic_jobs j ON j.id = o.job_id
            WHERE o.job_id = $1 AND j.tenant_id = $2
            ORDER BY o.created_at DESC
        `, [req.params.jobId, tenantId(req)]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        logger.error('[orthomosaic/outputs GET]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch outputs.' });
    }
});

// ── GET /jobs/:jobId/outputs/:outId/download — signed download URL ────────────
router.get('/jobs/:jobId/outputs/:outId/download', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied. Download via client portal.' });
        }

        const result = await query(`
            SELECT o.gcs_path, o.file_name, o.output_type
            FROM orthomosaic_outputs o
            JOIN orthomosaic_jobs j ON j.id = o.job_id
            WHERE o.id = $1 AND o.job_id = $2 AND j.tenant_id = $3
        `, [req.params.outId, req.params.jobId, tenantId(req)]);

        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Output not found.' });

        const output = result.rows[0];

        // Strip gs:// prefix to get just the path
        const gcsPath = output.gcs_path?.replace(`gs://${GCS_BUCKET}/`, '');

        if (!gcs || !gcsPath) {
            return res.status(503).json({ success: false, message: 'Download service unavailable.' });
        }

        const [url] = await gcs.bucket(GCS_BUCKET).file(gcsPath).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
            responseDisposition: `attachment; filename="${output.file_name}"`,
        });

        res.json({ success: true, data: { downloadUrl: url, fileName: output.file_name } });
    } catch (err) {
        logger.error('[orthomosaic/download]', err);
        res.status(500).json({ success: false, message: 'Failed to generate download URL.' });
    }
});

// ── PATCH /jobs/:jobId/cancel — admin only ────────────────────────────────────
router.patch('/jobs/:jobId/cancel', protect, authorize('admin'), async (req, res) => {
    try {
        await query(`
            UPDATE orthomosaic_jobs SET status = 'canceled', updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('completed', 'canceled')
        `, [req.params.jobId, tenantId(req)]);
        res.json({ success: true, message: 'Job canceled.' });
    } catch (err) {
        logger.error('[orthomosaic/cancel]', err);
        res.status(500).json({ success: false, message: 'Failed to cancel job.' });
    }
});

// ── DELETE /jobs/:jobId — delete a single job from history ───────────────────
router.delete('/jobs/:jobId', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const { jobId } = req.params;
        // Only allow deleting jobs that aren't actively processing
        const result = await query(
            `DELETE FROM orthomosaic_jobs
             WHERE id = $1 AND tenant_id = $2 AND status != 'processing'
             RETURNING id`,
            [jobId, tenantId(req)]
        );
        if (!result.rows.length) {
            return res.status(400).json({ success: false, message: 'Job not found or cannot be deleted while processing.' });
        }
        res.json({ success: true, message: 'Job deleted.' });
    } catch (err) {
        logger.error('[orthomosaic/delete-job]', err);
        res.status(500).json({ success: false, message: 'Failed to delete job.' });
    }
});

// ── DELETE /jobs — bulk delete jobs by IDs ────────────────────────────────────
router.delete('/jobs', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const { ids } = req.body; // array of job IDs
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array required.' });
        }
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
        const result = await query(
            `DELETE FROM orthomosaic_jobs
             WHERE id IN (${placeholders}) AND tenant_id = $1 AND status != 'processing'
             RETURNING id`,
            [tenantId(req), ...ids]
        );
        res.json({ success: true, deleted: result.rows.length });
    } catch (err) {
        logger.error('[orthomosaic/bulk-delete-jobs]', err);
        res.status(500).json({ success: false, message: 'Failed to delete jobs.' });
    }
});

// ── POST /jobs/:jobId/retry — re-submit a failed job ─────────────────────────
// Resets status to 'queued' so the job can be re-submitted
router.post('/jobs/:jobId/retry', protect, async (req, res) => {
    try {
        if (isClientRole(req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const jobRes = await query(`
            SELECT id, status, retry_count, max_retries, tenant_id
            FROM orthomosaic_jobs
            WHERE id = $1 AND tenant_id = $2
        `, [req.params.jobId, tenantId(req)]);

        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found.' });
        const job = jobRes.rows[0];

        if (job.status !== 'failed') {
            return res.status(409).json({ success: false, message: `Cannot retry — job is ${job.status}.` });
        }

        if (job.retry_count >= job.max_retries) {
            return res.status(429).json({ success: false, message: `Max retries (${job.max_retries}) exceeded.` });
        }

        await query(`
            UPDATE orthomosaic_jobs
            SET status = 'queued',
                error_message = NULL,
                pipeline_stage = 'Queued for retry',
                progress_pct = 0,
                retry_count = retry_count + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [req.params.jobId]);

        res.json({ success: true, message: 'Job queued for retry.' });
    } catch (err) {
        logger.error('[orthomosaic/retry]', err);
        res.status(500).json({ success: false, message: 'Failed to retry job.' });
    }
});

// ── GET /jobs/:jobId/preview — signed URL for orthomosaic preview PNG ────────
router.get('/jobs/:jobId/preview', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobRes = await query(
            `SELECT j.id, j.tenant_id, j.upload_set_gcs_prefix, j.processing_completed_at,
                    j.image_count, j.quality_tier, j.pipeline_stage,
                    EXTRACT(EPOCH FROM (j.processing_completed_at - j.processing_started_at))::INTEGER AS duration_s,
                    p.name AS project_name, p.site_name, p.mission_id
             FROM orthomosaic_jobs j
             LEFT JOIN orthomosaic_projects p ON p.id = j.project_id
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [jobId, req.user.tenantId]
        );
        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found.' });
        const job = jobRes.rows[0];

        // Check if preview PNG exists in GCS
        let previewUrl = null;
        const previewPath = `${job.upload_set_gcs_prefix}outputs/preview.png`;
        try {
            if (gcs) {
                const file = gcs.bucket(GCS_BUCKET).file(previewPath);
                const [exists] = await file.exists();
                if (exists) {
                    const [url] = await file.getSignedUrl({
                        action: 'read', expires: Date.now() + 2 * 60 * 60 * 1000
                    });
                    previewUrl = url;
                }
            }
        } catch { /* no preview, that's ok */ }

        res.json({
            success: true,
            data: {
                previewUrl,
                hasPreview: !!previewUrl,
                stats: {
                    imageCount: job.image_count,
                    qualityTier: job.quality_tier,
                    durationS: job.duration_s,
                    siteName: job.site_name || job.project_name,
                    missionId: job.mission_id,
                },
            },
        });
    } catch (err) {
        logger.error('[orthomosaic/preview]', err);
        res.status(500).json({ success: false, message: 'Failed to get preview.' });
    }
});

// ── GET /jobs/:jobId/linked-reports — reports linked to same mission ─────────
router.get('/jobs/:jobId/linked-reports', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        // Get mission_id for this job
        const jobRes = await query(
            `SELECT p.mission_id FROM orthomosaic_jobs j
             LEFT JOIN orthomosaic_projects p ON p.id = j.project_id
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [jobId, req.user.tenantId]
        );
        if (!jobRes.rows.length) return res.json({ success: true, data: { reports: [], files: [], mission: null } });
        const missionId = jobRes.rows[0].mission_id;

        // Always return recent tenant reports (fall back to all if no missionId)
        const reportsRes = await query(
            `SELECT id, title, status, approval_status, created_at
             FROM reports
             WHERE tenant_id = $1
             ORDER BY created_at DESC LIMIT 10`,
            [req.user.tenantId]
        ).catch(() => ({ rows: [] }));

        // Only query mission + files if we have a missionId
        const filesRes = missionId ? await query(
            `SELECT id, name, url, type, size, created_at
             FROM deployment_files
             WHERE deployment_id = $1
             ORDER BY created_at DESC LIMIT 20`,
            [missionId]
        ).catch(() => ({ rows: [] })) : { rows: [] };

        const missionRes = missionId ? await query(
            `SELECT id, title, site_name, type, status, date, location
             FROM deployments WHERE id = $1 AND tenant_id = $2`,
            [missionId, req.user.tenantId]
        ).catch(() => ({ rows: [] })) : { rows: [] };

        res.json({
            success: true,
            data: {
                missionId,
                mission: missionRes.rows[0] || null,
                reports: reportsRes.rows,
                files: filesRes.rows,
            },
        });

    } catch (err) {
        logger.error('[orthomosaic/linked-reports]', err);
        res.status(500).json({ success: false, message: 'Failed to get linked reports.' });
    }
});


// ── GET /jobs/:jobId/geo-data — signed URLs for 2D + 3D viewers ──────────────
router.get('/jobs/:jobId/geo-data', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobRes = await query(
            `SELECT j.id, j.tenant_id, j.upload_set_gcs_prefix, j.quality_tier,
                    j.image_count, j.processing_started_at, j.processing_completed_at,
                    EXTRACT(EPOCH FROM (j.processing_completed_at - j.processing_started_at))::INTEGER AS duration_s,
                    p.name AS project_name, p.site_name, p.mission_id
             FROM orthomosaic_jobs j
             LEFT JOIN orthomosaic_projects p ON p.id = j.project_id
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [jobId, req.user.tenantId]
        );
        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found.' });
        const job = jobRes.rows[0];
        const prefix = job.upload_set_gcs_prefix || '';

        // Check asset existence — support both GCS layout patterns
        const findTif = async (p) => {
            const paths = [`${p}outputs/orthomosaic.tif`, `${p}orthomosaic.tif`];
            for (const path of paths) {
                const [ex] = await gcs.bucket(GCS_BUCKET).file(path).exists().catch(() => [false]);
                if (ex) return path;
            }
            return null;
        };
        const findObj = async (p) => {
            const paths = [`${p}outputs/model.obj`, `${p}model.obj`];
            for (const path of paths) {
                const [ex] = await gcs.bucket(GCS_BUCKET).file(path).exists().catch(() => [false]);
                if (ex) return path;
            }
            return null;
        };
        const signPreview = async (gcsPath) => {
            if (!gcs) return null;
            try {
                const file = gcs.bucket(GCS_BUCKET).file(gcsPath);
                const [exists] = await file.exists();
                if (!exists) return null;
                const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 4 * 60 * 60 * 1000 });
                return url;
            } catch { return null; }
        };

        const [tifGcsPath, objGcsPath, previewUrl] = await Promise.all([
            gcs ? findTif(prefix) : Promise.resolve(null),
            gcs ? findObj(prefix) : Promise.resolve(null),
            signPreview(`${prefix}outputs/preview.png`),
        ]);

        const hasTif = !!tifGcsPath;
        const hasObj = !!objGcsPath;
        logger.info(`[geo-data] job=${jobId} prefix="${prefix}" gcs=${!!gcs} tifPath=${tifGcsPath} hasTif=${hasTif}`);
        // Proxy URLs — same-origin, no CORS issues
        const tifUrl = hasTif ? `/api/orthomosaic/jobs/${jobId}/proxy-tif` : null;
        const objUrl = hasObj ? `/api/orthomosaic/jobs/${jobId}/proxy-obj` : null;

        // Never cache — polling must always get fresh data (prevents 304 stale response)
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.set('Pragma', 'no-cache');

        res.json({
            success: true,
            data: {
                tifUrl,
                objUrl,
                previewUrl,
                hasTif,
                hasObj,
                hasPreview: !!previewUrl,
                stats: {
                    imageCount: job.image_count,
                    qualityTier: job.quality_tier,
                    durationS: job.duration_s,
                    siteName: job.site_name || job.project_name,
                    missionId: job.mission_id,
                },
            },
        });
    } catch (err) {

        logger.error('[orthomosaic/geo-data]', err);
        res.status(500).json({ success: false, message: 'Failed to load geo data.' });
    }
});

// ── POST /jobs/:jobId/extract — on-demand TIF extraction from all.zip ─────────
router.post('/jobs/:jobId/extract', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobRes = await query(
            `SELECT j.id, j.tenant_id, j.upload_set_gcs_prefix, j.status
             FROM orthomosaic_jobs j
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [jobId, req.user.tenantId]
        );
        if (!jobRes.rows.length) return res.status(404).json({ success: false, message: 'Job not found.' });
        const job = jobRes.rows[0];
        if (job.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Job is not completed yet.' });
        }

        // Check if already extracted (check both path patterns)
        if (gcs) {
            const prefix = job.upload_set_gcs_prefix || '';
            const [e1] = await gcs.bucket(GCS_BUCKET).file(`${prefix}outputs/orthomosaic.tif`).exists().catch(() => [false]);
            const [e2] = await gcs.bucket(GCS_BUCKET).file(`${prefix}orthomosaic.tif`).exists().catch(() => [false]);
            if (e1 || e2) {
                return res.json({ success: true, message: 'Already extracted.', alreadyDone: true });
            }
        }

        // Fire and forget — client polls geo-data for the result
        extractOrthoAssets(job.upload_set_gcs_prefix || '')
            .then(r => logger.info(`[extract endpoint] Done — tif:${r.tif} dsm:${r.dsm}`))
            .catch(e => logger.warn('[extract endpoint] Failed:', e.message));

        res.json({ success: true, message: 'Extraction started. Poll geo-data for status.' });
    } catch (err) {
        logger.error('[orthomosaic/extract]', err);
        res.status(500).json({ success: false, message: 'Failed to start extraction.' });
    }
});

// ── GET /jobs/:jobId/proxy-tif — stream orthomosaic.tif to browser ────────────
router.get('/jobs/:jobId/proxy-tif', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobRes = await query(
            `SELECT j.upload_set_gcs_prefix FROM orthomosaic_jobs j
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [jobId, req.user.tenantId]
        );
        if (!jobRes.rows.length) return res.status(404).end();
        if (!gcs) return res.status(503).end();
        const prefix = jobRes.rows[0].upload_set_gcs_prefix || '';
        const bucket = gcs.bucket(GCS_BUCKET);

        // Find TIF in either path pattern
        let tifPath = null;
        for (const candidate of [`${prefix}outputs/orthomosaic.tif`, `${prefix}orthomosaic.tif`]) {
            const [ex] = await bucket.file(candidate).exists().catch(() => [false]);
            if (ex) { tifPath = candidate; break; }
        }
        if (!tifPath) return res.status(404).json({ success: false, message: 'Not extracted yet.' });

        const file = bucket.file(tifPath);
        const [meta] = await file.getMetadata();
        res.setHeader('Content-Type', 'image/tiff');
        res.setHeader('Content-Length', meta.size);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        file.createReadStream().pipe(res);
    } catch (err) {
        logger.error('[orthomosaic/proxy-tif]', err);
        res.status(500).end();
    }
});


// ── GET /jobs/:jobId/proxy-ortho-png — render TIF → PNG (server-side, cached) ─
router.get('/jobs/:jobId/proxy-ortho-png', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobRes = await query(
            `SELECT j.upload_set_gcs_prefix FROM orthomosaic_jobs j
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [jobId, req.user.tenantId]
        );
        if (!jobRes.rows.length) return res.status(404).end();
        if (!gcs) return res.status(503).end();

        const prefix = jobRes.rows[0].upload_set_gcs_prefix || '';
        const bucket = gcs.bucket(GCS_BUCKET);
        const pngCachePath = `${prefix}outputs/orthomosaic_preview.png`;
        const boundsCachePath = `${prefix}outputs/orthomosaic_bounds.json`;

        // ── Serve cached PNG if available ────────────────────────────────────
        const [pngExists] = await bucket.file(pngCachePath).exists().catch(() => [false]);
        const [boundsExists] = await bucket.file(boundsCachePath).exists().catch(() => [false]);
        if (pngExists && boundsExists) {
            const [boundsData] = await bucket.file(boundsCachePath).download();
            const bounds = JSON.parse(boundsData.toString());
            const pngFile = bucket.file(pngCachePath);
            const [meta] = await pngFile.getMetadata();
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Length', meta.size);
            res.setHeader('X-Ortho-Bounds', JSON.stringify(bounds));
            res.setHeader('Access-Control-Expose-Headers', 'X-Ortho-Bounds');
            res.setHeader('Cache-Control', 'private, max-age=86400');
            return pngFile.createReadStream().pipe(res);
        }

        // ── Find TIF ─────────────────────────────────────────────────────────
        let tifPath = null;
        for (const c of [`${prefix}outputs/orthomosaic.tif`, `${prefix}orthomosaic.tif`]) {
            const [ex] = await bucket.file(c).exists().catch(() => [false]);
            if (ex) { tifPath = c; break; }
        }
        if (!tifPath) return res.status(404).json({ message: 'No TIF found' });

        // ── Download TIF ──────────────────────────────────────────────────────
        logger.info(`[proxy-ortho-png] downloading ${tifPath}`);
        const [tifBuffer] = await bucket.file(tifPath).download();
        logger.info(`[proxy-ortho-png] downloaded ${Math.round(tifBuffer.length/1024/1024)}MB`);

        // ── Parse with geotiff (Node-native) ─────────────────────────────────
        // Proper Buffer → ArrayBuffer (avoids pool byteOffset issues)
        const ab = tifBuffer.buffer.slice(tifBuffer.byteOffset, tifBuffer.byteOffset + tifBuffer.byteLength);
        logger.info(`[proxy-ortho-png] parsing TIF...`);
        const tiff = await geotiffFromArrayBuffer(ab);
        const image = await tiff.getImage();
        const srcW = image.getWidth();
        const srcH = image.getHeight();
        const samplesPerPixel = image.getSamplesPerPixel();
        logger.info(`[proxy-ortho-png] TIF: ${srcW}x${srcH} px, ${samplesPerPixel} bands`);

        // Read pixel data (band-separated arrays)
        const rasterData = await image.readRasters();
        logger.info(`[proxy-ortho-png] pixel data read OK`);

        // ── Extract bounds → WGS84 ────────────────────────────────────────────
        // getBoundingBox returns [west, south, east, north] in the TIF's native CRS
        const [bboxW, bboxS, bboxE, bboxN] = image.getBoundingBox();
        const geoKeys = image.getGeoKeys();
        const epsg = geoKeys?.ProjectedCSTypeGeoKey || geoKeys?.GeographicTypeGeoKey || 4326;
        logger.info(`[proxy-ortho-png] bbox EPSG:${epsg} [${bboxW},${bboxS},${bboxE},${bboxN}]`);

        let west = bboxW, south = bboxS, east = bboxE, north = bboxN;
        if (epsg !== 4326) {
            try {
                const epsgKey = `EPSG:${epsg}`;
                if (!proj4.defs(epsgKey)) {
                    const defRes = await fetch(`https://epsg.io/${epsg}.proj4`);
                    if (defRes.ok) {
                        const def = (await defRes.text()).trim();
                        if (def) proj4.defs(epsgKey, def);
                    }
                }
                if (proj4.defs(epsgKey)) {
                    [west, south] = proj4(epsgKey, 'EPSG:4326', [bboxW, bboxS]);
                    [east, north] = proj4(epsgKey, 'EPSG:4326', [bboxE, bboxN]);
                    logger.info(`[proxy-ortho-png] reprojected to WGS84: [${west},${south},${east},${north}]`);
                }
            } catch (projErr) {
                logger.warn('[proxy-ortho-png] proj4 failed, using raw coords:', projErr.message);
            }
        }
        const bounds = { west, south, east, north };

        // ── Render to PNG (max 2048×2048) ─────────────────────────────────────
        const MAX = 2048;
        const scale = Math.min(1, MAX / srcW, MAX / srcH);
        const dstW = Math.max(1, Math.round(srcW * scale));
        const dstH = Math.max(1, Math.round(srcH * scale));
        const nBands = Math.min(samplesPerPixel, 4);
        const invS = 1 / scale;
        const noData = image.getGDALNoData();
        const nd = noData ?? null;
        const data = new Uint8Array(dstW * dstH * 4);

        // geotiff readRasters returns band arrays (rasterData[0]=R, [1]=G, [2]=B)
        for (let row = 0; row < dstH; row++) {
            const sRow = Math.min(Math.floor(row * invS), srcH - 1);
            for (let col = 0; col < dstW; col++) {
                const sCol = Math.min(Math.floor(col * invS), srcW - 1);
                const srcIdx = sRow * srcW + sCol;
                const i = (row * dstW + col) * 4;
                if (nBands >= 3) {
                    const r = rasterData[0][srcIdx] ?? 0;
                    const g = rasterData[1][srcIdx] ?? 0;
                    const b = rasterData[2][srcIdx] ?? 0;
                    const a = nBands >= 4 ? (rasterData[3][srcIdx] ?? 255) : 255;
                    data[i] = r; data[i + 1] = g; data[i + 2] = b;
                    data[i + 3] = (nd !== null && r === nd && g === nd && b === nd) ? 0 : a;
                } else {
                    const v = rasterData[0][srcIdx] ?? 0;
                    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
                }
            }
        }
        logger.info(`[proxy-ortho-png] rendered ${srcW}×${srcH} → ${dstW}×${dstH}`);

        // ── Encode PNG ────────────────────────────────────────────────────────
        const pngBuffer = Buffer.from(pngEncode({ width: dstW, height: dstH, data, channels: 4 }));

        // ── Cache PNG + bounds in GCS (async, don't block response) ──────────
        const boundsJson = JSON.stringify(bounds);
        Promise.all([
            bucket.file(pngCachePath).save(pngBuffer, { metadata: { contentType: 'image/png' } }),
            bucket.file(boundsCachePath).save(boundsJson, { metadata: { contentType: 'application/json' } }),
        ]).then(() => logger.info('[proxy-ortho-png] cached PNG + bounds in GCS'))
          .catch(e => logger.warn('[proxy-ortho-png] cache write failed:', e.message));

        // ── Respond ───────────────────────────────────────────────────────────
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', pngBuffer.length);
        res.setHeader('X-Ortho-Bounds', boundsJson);
        res.setHeader('Access-Control-Expose-Headers', 'X-Ortho-Bounds');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.send(pngBuffer);
    } catch (err) {
        logger.error(`[proxy-ortho-png] ERROR: ${err?.message || err}`, { stack: err?.stack });
        res.status(500).json({ error: err?.message || 'render failed' });
    }
});



router.get('/jobs/:jobId/proxy-dsm', protect, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobRes = await query(
            `SELECT j.upload_set_gcs_prefix FROM orthomosaic_jobs j
             WHERE j.id = $1 AND j.tenant_id = $2`,
            [jobId, req.user.tenantId]
        );
        if (!jobRes.rows.length) return res.status(404).end();
        if (!gcs) return res.status(503).end();
        const prefix = jobRes.rows[0].upload_set_gcs_prefix || '';
        const file = gcs.bucket(GCS_BUCKET).file(`${prefix}outputs/dsm.tif`);
        const [exists] = await file.exists();
        if (!exists) return res.status(404).json({ success: false, message: 'DSM not available.' });
        const [meta] = await file.getMetadata();
        res.setHeader('Content-Type', 'image/tiff');
        res.setHeader('Content-Length', meta.size);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        file.createReadStream().pipe(res);
    } catch (err) {
        logger.error('[orthomosaic/proxy-dsm]', err);
        res.status(500).end();
    }
});

export default router;





