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
                await updateJobStatus(jobId, 'processing', {
                    progress_pct: Math.round(pct),
                    pipeline_stage: pct < 30 ? 'Feature Detection' : pct < 70 ? 'Point Cloud' : 'Generating Tiles',
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

            // ── Deliverables wiring (future) ──────────────────────────────────
            // The legacy `deliverables` table (migration 087) references `projects.id` (NOT
            // `orthomosaic_projects.id`) and has no mission_id or tenant_id columns, making a
            // direct INSERT incompatible without a schema migration.
            //
            // TODO: Create migration 026_orthomosaic_deliverables_bridge.sql that either:
            //   a) Adds a `orthomosaic_job_id` FK column to `deliverables`, or
            //   b) Creates a new `client_deliverables` view joining orthomosaic_outputs + missions
            //
            // Outputs ARE persisted in `orthomosaic_outputs` and accessible via:
            //   GET /api/orthomosaic/jobs/:jobId/outputs/:outId/download (admin/pilot)
            // Client access pending above schema migration.
            if (missionId && results.orthomosaicGcsUri) {
                logger.info(`[orthomosaic] Output ready for mission ${missionId}: ${results.orthomosaicGcsUri} — client deliverable wiring pending schema migration.`);
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

export default router;
