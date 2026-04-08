/**
 * pilotUpload.js — Pilot Data Upload Pipeline
 *
 * Two-phase workflow:
 *   1. POST /api/pilot/upload-jobs              — Create a job (returns storage destination)
 *   2. POST /api/pilot/upload-jobs/:id/files    — Upload files into the job
 *
 * Storage split:
 *   Aerial images (images/thermal/orthomosaic) → AWS S3  (tm-prod-pilot-california)
 *   Ground data   (lbd/kml/sensor_log/sheet)   → GCS     (axis-platform-uploads)
 */
import express from 'express';
import path from 'path';
import { protect } from '../middleware/auth.js';
import { isAdmin } from '../utils/roleUtils.js';
import { uploadSingle } from '../utils/fileUpload.js';
import { query } from '../config/database.js';
import { uploadByDestination, uploadLBDToGCS, uploadAerialImage } from '../services/storageService.js';
import { processUpload } from '../services/uploadProcessor.js';

let io = null;
export function setIo(socketIoInstance) { io = socketIoInstance; }

const router = express.Router();
router.use(protect);

// ── Routing table ─────────────────────────────────────────────────────────────
const UPLOAD_DESTINATION = {
    images:      's3',   // aerial RGB photos
    thermal:     's3',   // aerial IR/thermal images
    orthomosaic: 's3',   // aerial orthomosaic GeoTIFFs
    lbd:         'gcs',  // LiDAR/LBD ground scan data
    kml:         'gcs',  // KML/KMZ flight path files
    sensor_log:  'gcs',  // raw sensor logs
    spreadsheet: 'gcs',  // field data spreadsheets
};

const FOLDER_MAP = {
    images:      'images',
    thermal:     'thermal',
    orthomosaic: 'orthomosaic',
    lbd:         'lbd',
    kml:         'kml',
    sensor_log:  'sensor-logs',
    spreadsheet: 'spreadsheets',
};

const validTypes = Object.keys(UPLOAD_DESTINATION);

// ── POST /api/pilot/upload-jobs — Create a job ────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { missionId, uploadType, analysisType, notes, lbdBlock, missionFolder } = req.body;
        const pilotId = req.user.id;

        if (!missionId || !uploadType) {
            return res.status(400).json({ success: false, message: 'missionId and uploadType are required' });
        }
        if (!validTypes.includes(uploadType)) {
            return res.status(400).json({
                success: false,
                message: `uploadType must be one of: ${validTypes.join(', ')}`
            });
        }
        if (uploadType === 'lbd' && !lbdBlock) {
            return res.status(400).json({ success: false, message: 'lbdBlock is required for LBD uploads' });
        }
        const destination = UPLOAD_DESTINATION[uploadType];
        if (destination === 's3' && !missionFolder) {
            return res.status(400).json({ success: false, message: 'missionFolder is required for aerial (S3) uploads — e.g. M14 or Flight-3' });
        }

        // Ensure table exists with storage_destination column
        await query(`
            CREATE TABLE IF NOT EXISTS upload_jobs (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id          UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
                pilot_id            UUID NOT NULL,
                upload_type         TEXT NOT NULL,
                storage_destination TEXT DEFAULT 'local',
                lbd_block           TEXT,
                status              TEXT DEFAULT 'pending',
                notes               TEXT,
                file_count          INTEGER DEFAULT 0,
                processed_count     INTEGER DEFAULT 0,
                error_count         INTEGER DEFAULT 0,
                created_at          TIMESTAMPTZ DEFAULT NOW(),
                updated_at          TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Add columns if table already exists
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS storage_destination TEXT DEFAULT 'local'`).catch(() => {});
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS lbd_block TEXT`).catch(() => {});
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS mission_folder TEXT`).catch(() => {});
        await query(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS analysis_type TEXT DEFAULT 'thermal_fault'`).catch(() => {});

        const result = await query(
            `INSERT INTO upload_jobs (mission_id, pilot_id, upload_type, analysis_type, storage_destination, lbd_block, mission_folder, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [missionId, pilotId, uploadType, analysisType || 'thermal_fault', destination, lbdBlock || null, missionFolder || null, notes || null]
        );

        res.status(201).json({
            success: true,
            data: { ...result.rows[0], storage: destination },
            message: `Upload job created → ${destination.toUpperCase()} storage`
        });
    } catch (err) {
        console.error('[pilotUpload] create job error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pilot/upload-jobs — List jobs for this pilot ─────────────────────
router.get('/', async (req, res) => {
    try {
        const pilotId = req.user.id;
        const result = await query(
            `SELECT uj.*, d.title as mission_title
             FROM upload_jobs uj
             JOIN deployments d ON d.id = uj.mission_id
             WHERE uj.pilot_id = $1
             ORDER BY uj.created_at DESC
             LIMIT 50`,
            [pilotId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/pilot/upload-jobs/:jobId/files — Upload a file into a job ───────
router.post('/:jobId/files', uploadSingle, async (req, res) => {
    try {
        const { jobId } = req.params;
        const pilotId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }

        // Verify job belongs to this pilot
        const jobCheck = await query(
            `SELECT * FROM upload_jobs WHERE id = $1 AND pilot_id = $2`,
            [jobId, pilotId]
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Upload job not found' });
        }
        const job = jobCheck.rows[0];

        const folder = FOLDER_MAP[job.upload_type] || 'uploads';
        const destination = job.storage_destination || UPLOAD_DESTINATION[job.upload_type] || 'local';

        // Upload to S3 or GCS based on job destination
        let uploadResult;
        try {
            if (job.upload_type === 'lbd' && destination === 'gcs') {
                // LBD → structured GCS: {project}/{pilot}/{block}/{uuid}{ext}
                const ctx = await query(
                    `SELECT d.title AS project, u.full_name AS pilot
                     FROM deployments d
                     JOIN users u ON u.id = $2
                     WHERE d.id = $1`,
                    [job.mission_id, job.pilot_id]
                );
                const projectName = ctx.rows[0]?.project || 'Project';
                const pilotName   = ctx.rows[0]?.pilot   || 'Pilot';
                const lbdBlock    = job.lbd_block         || 'Block';
                uploadResult = await uploadLBDToGCS(file, projectName, pilotName, lbdBlock);

            } else if (destination === 's3') {
                // Aerial images → S3: {SiteName}/{MissionFolder}/IR|RGB/{uuid}{ext}
                // missionFolder is what the pilot typed in (e.g. M14, Flight-3, Block-A-Day2)
                const siteRes = await query(
                    `SELECT d.site_name FROM deployments d WHERE d.id = $1`,
                    [job.mission_id]
                );
                const siteName    = siteRes.rows[0]?.site_name || 'Site';
                const folderLabel = job.mission_folder || 'Mission';

                // S3 key: {SiteName}/{pilot-supplied folder}/IR|RGB/{uuid}{ext}
                uploadResult = await uploadAerialImage(
                    file,
                    job.mission_id,
                    null,                        // auto-classify via EXIF
                    `${siteName}/${folderLabel}` // e.g. "Coatza Solar/M14"
                );
            } else {
                // GCS (kml, sensor_log, spreadsheet) → flat folder
                uploadResult = await uploadByDestination(file, folder, destination);
            }
            console.log(`[pilotUpload] ${job.upload_type} → ${destination.toUpperCase()}: ${uploadResult.key}`);
        } catch (storageErr) {
            console.warn('[pilotUpload] Cloud upload failed, falling back to local:', storageErr.message);
            const { writeFile, mkdir } = await import('fs/promises');
            const uploadDir = path.resolve('uploads', folder);
            await mkdir(uploadDir, { recursive: true });
            const safeFilename = `${jobId}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            await writeFile(path.join(uploadDir, safeFilename), file.buffer);
            uploadResult = {
                url: `/uploads/${folder}/${safeFilename}`,
                key: `uploads/${folder}/${safeFilename}`
            };
        }

        // Record file in upload_files (job-scoped, supports per-file ai_result)
        const fileRecord = await query(
            `INSERT INTO upload_files (job_id, file_name, file_size, storage_url, status)
             VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
            [jobId, file.originalname, file.size, uploadResult.url]
        );
        const uploadFileId = fileRecord.rows[0].id;

        // Also mirror into deployment_files for legacy queries
        await query(
            `INSERT INTO deployment_files (deployment_id, name, url, type, size)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [job.mission_id, file.originalname, uploadResult.url, file.mimetype, file.size]
        ).catch(() => {});

        await query(
            `UPDATE upload_jobs SET file_count = file_count + 1, updated_at = NOW() WHERE id = $1`,
            [jobId]
        );

        res.status(201).json({
            success: true,
            message: `File uploaded to ${destination.toUpperCase()} — AI processing started`,
            data: {
                jobId,
                fileUrl:    uploadResult.url,
                fileKey:    uploadResult.key,
                fileName:   file.originalname,
                uploadType: job.upload_type,
                storage:    destination
            }
        });

        // ── Fire-and-forget auto-processing (Gemini + Pix4D) ─────────────────
        processUpload({
            jobId,
            uploadFileId,
            missionId:    job.mission_id,
            uploadType:   job.upload_type,
            analysisType: job.analysis_type,
            storageUrl:   uploadResult.url,
            fileBuffer:   file.buffer,
            mimeType:     file.mimetype,
            fileName:     file.originalname,
            io,
            userId:       pilotId,
        }).catch(e => console.error('[pilotUpload] processUpload error:', e.message));
    } catch (err) {
        console.error('[pilotUpload] file upload error:', err.message);
        await query(
            `UPDATE upload_jobs SET error_count = error_count + 1, updated_at = NOW() WHERE id = $1`,
            [req.params.jobId]
        ).catch(() => {});
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pilot/upload-jobs/admin/all — All jobs (admin view) ──────────────
router.get('/admin/all', async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }
        const result = await query(
            `SELECT uj.id, uj.mission_id, uj.upload_type, uj.analysis_type,
                    uj.status, uj.ai_result, uj.file_count,
                    uj.mission_folder, uj.lbd_block, uj.report_url,
                    uj.created_at, uj.updated_at,
                    d.title                                 AS mission_title,
                    d.site_name                             AS site_name,
                    u.email                                 AS pilot_email,
                    COALESCE(u.full_name, u.email)          AS pilot_name
             FROM upload_jobs uj
             LEFT JOIN deployments d ON d.id = uj.mission_id
             LEFT JOIN users u       ON u.id = uj.pilot_id
             ORDER BY uj.created_at DESC
             LIMIT 100`,
            []
        );


        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pilot/upload-jobs/:jobId/files — List files for a job ────────────
router.get('/:jobId/files', async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobCheck = await query(
            `SELECT * FROM upload_jobs WHERE id = $1 AND (pilot_id = $2 OR $3)`,
            [jobId, req.user.id, isAdmin(req.user)]
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }
        // Query upload_files (job-scoped) for per-file AI results
        const result = await query(
            `SELECT id, file_name, storage_url, file_size, ai_result, status, created_at
             FROM upload_files
             WHERE job_id = $1
             ORDER BY created_at DESC
             LIMIT 200`,
            [jobId]
        );
        // Fallback: if upload_files is empty (old jobs), use deployment_files
        if (result.rows.length === 0) {
            const job = jobCheck.rows[0];
            const legacy = await query(
                `SELECT id, name AS file_name, url AS storage_url, type AS mime_type, size AS file_size, created_at
                 FROM deployment_files WHERE deployment_id = $1 ORDER BY created_at DESC LIMIT 200`,
                [job.mission_id]
            );
            return res.json({ success: true, data: legacy.rows });
        }
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/pilot/upload-jobs/:jobId/report — Generate report ───────────────
router.post('/:jobId/report', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await query(
            `SELECT uj.*, d.title AS mission_title, d.site_name,
                    d.industry_key AS industry,
                    u.full_name AS pilot_name, u.email AS pilot_email
             FROM upload_jobs uj
             LEFT JOIN deployments d ON d.id = uj.mission_id
             LEFT JOIN users u       ON u.id = uj.pilot_id
             WHERE uj.id = $1 AND (uj.pilot_id = $2 OR $3)`,
            [jobId, req.user.id, isAdmin(req.user)]
        );
        if (job.rows.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
        const j = job.rows[0];
        const aiResult = j.ai_result;

        // ── Build structured report_data ───────────────────────────────────────
        const faults    = aiResult?.faults    ?? [];
        const defects   = aiResult?.defects   ?? [];
        const anomalies = aiResult?.anomalies ?? [];
        const allIssues = [...faults, ...defects, ...anomalies];
        const totalIssues = aiResult?.totalFaults ?? aiResult?.totalDefects ?? allIssues.length ?? 0;

        // Risk score: 0-100 based on severity
        const severityWeight = { critical: 30, high: 15, medium: 5, low: 1 };
        const rawScore = allIssues.reduce((s, i) => s + (severityWeight[i.severity] ?? 1), 0);
        const riskScore = Math.min(100, rawScore);
        const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 10 ? 'medium' : 'low';

        const reportData = {
            jobId,
            missionId: j.mission_id,
            missionTitle: j.mission_title,
            siteName: j.site_name,
            pilotName: j.pilot_name || j.pilot_email,
            uploadType: j.upload_type,
            analysisType: j.analysis_type,
            generatedAt: new Date().toISOString(),
            riskScore,
            riskLevel,
            summary: aiResult?.summary ?? 'AI analysis complete.',
            totalIssues,
            overallCondition: aiResult?.overallCondition ?? aiResult?.overallSeverity ?? 'unknown',
            maxTempDelta: aiResult?.maxTempDelta ?? null,
            imageQuality: aiResult?.imageQuality ?? null,
            issues: allIssues,
            recommendations: aiResult?.recommendations ?? [],
            rawAiResult: aiResult,
        };

        // ── Save to ai_reports table ───────────────────────────────────────────
        const rpt = await query(
            `INSERT INTO ai_reports (deployment_id, industry, report_type, report_data, generated_by)
             VALUES ($1, $2, 'ai_inspection', $3, $4)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [j.mission_id, j.industry || 'solar', JSON.stringify(reportData), req.user.id]
        ).catch(() => ({ rows: [] }));

        const reportId = rpt.rows[0]?.id;
        const reportUrl = `/api/pilot/upload-jobs/${jobId}/report`;

        await query(
            `UPDATE upload_jobs SET report_url = $1, updated_at = NOW() WHERE id = $2`,
            [reportUrl, jobId]
        ).catch(() => {});

        // ── Emit socket so client dashboard auto-refreshes ─────────────────────
        if (io) {
            io.emit('report:ready', {
                jobId, reportId, reportUrl,
                missionId: j.mission_id,
                siteName: j.site_name,
                riskScore, riskLevel, totalIssues,
                generatedAt: reportData.generatedAt,
            });
        }

        res.json({ success: true, reportUrl, reportData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pilot/upload-jobs/:jobId/report — View report data ───────────────
router.get('/:jobId/report', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await query(
            `SELECT uj.*, d.title AS mission_title, d.site_name,
                    u.full_name AS pilot_name, u.email AS pilot_email
             FROM upload_jobs uj
             LEFT JOIN deployments d ON d.id = uj.mission_id
             LEFT JOIN users u       ON u.id = uj.pilot_id
             WHERE uj.id = $1 AND (uj.pilot_id = $2 OR $3)`,
            [jobId, req.user.id, isAdmin(req.user)]
        );
        if (job.rows.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
        const j = job.rows[0];
        const aiResult = j.ai_result;

        // Try to fetch from ai_reports first, scoped to this job where possible
        const stored = await query(
            `SELECT * FROM ai_reports
             WHERE deployment_id = $1
               AND report_type = 'ai_inspection'
               AND (report_data->>'jobId' = $2 OR report_data->>'jobId' IS NULL)
             ORDER BY created_at DESC LIMIT 1`,
            [j.mission_id, jobId]
        );

        if (stored.rows.length > 0 && stored.rows[0].report_data) {
            return res.json({ success: true, data: stored.rows[0].report_data });
        }

        // Fallback: build inline from ai_result (may be null if analysis not yet run)
        const faults    = aiResult?.faults    ?? [];
        const defects   = aiResult?.defects   ?? [];
        const anomalies = aiResult?.anomalies ?? [];
        const allIssues = [...faults, ...defects, ...anomalies];
        const totalIssues = aiResult?.totalFaults ?? aiResult?.totalDefects ?? allIssues.length ?? 0;
        const severityWeight = { critical: 30, high: 15, medium: 5, low: 1 };
        const rawScore = allIssues.reduce((s, i) => s + (severityWeight[i.severity] ?? 1), 0);
        const riskScore = Math.min(100, rawScore);
        const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 10 ? 'medium' : 'low';

        res.json({ success: true, data: {
            jobId, missionId: j.mission_id, missionTitle: j.mission_title, siteName: j.site_name,
            pilotName: j.pilot_name || j.pilot_email, uploadType: j.upload_type,
            analysisType: j.analysis_type, generatedAt: j.updated_at,
            riskScore, riskLevel,
            summary: aiResult?.summary ?? (aiResult ? '' : 'AI analysis has not been run yet for this job.'),
            totalIssues, overallCondition: aiResult?.overallCondition ?? aiResult?.overallSeverity ?? 'pending',
            maxTempDelta: aiResult?.maxTempDelta ?? null, imageQuality: aiResult?.imageQuality ?? null,
            issues: allIssues, recommendations: aiResult?.recommendations ?? [],
        }});
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pilot/upload-jobs/mission/:missionId/master-report ────────────────
router.get('/mission/:missionId/master-report', async (req, res) => {
    try {
        const { missionId } = req.params;
        const isAdminUser = isAdmin(req.user);
        const jobs = await query(
            `SELECT uj.*, d.title AS mission_title, d.site_name, d.latitude, d.longitude,
                    u.full_name AS pilot_name, u.email AS pilot_email
             FROM upload_jobs uj
             LEFT JOIN deployments d ON d.id = uj.mission_id
             LEFT JOIN users u       ON u.id = uj.pilot_id
             WHERE uj.mission_id = $1 AND ($2 OR uj.pilot_id = $3)
             ORDER BY uj.created_at ASC`,
            [missionId, isAdminUser, req.user.id]
        );
        if (jobs.rows.length === 0) return res.status(404).json({ success: false, message: 'No jobs found' });
        const meta = jobs.rows[0];
        const severityWeight = { critical: 30, high: 15, medium: 5, low: 1 };
        let allIssues = [], allRecs = [], totalFiles = 0, maxTempDelta = null;
        const jobSummaries = [];
        for (const job of jobs.rows) {
            const r = job.ai_result;
            totalFiles += parseInt(job.file_count) || 0;
            const issues = [...(r?.faults ?? []), ...(r?.defects ?? []), ...(r?.anomalies ?? [])];
            allIssues = [...allIssues, ...issues];
            if (r?.recommendations) allRecs = [...allRecs, ...r.recommendations];
            if (r?.maxTempDelta != null && (maxTempDelta == null || r.maxTempDelta > maxTempDelta)) maxTempDelta = r.maxTempDelta;
            jobSummaries.push({ jobId: job.id, uploadType: job.upload_type, analysisType: job.analysis_type,
                status: job.status, fileCount: parseInt(job.file_count)||0, issueCount: issues.length,
                pilotName: job.pilot_name || job.pilot_email, date: job.created_at, summary: r?.summary ?? null });
        }
        allRecs = [...new Set(allRecs)].slice(0, 10);
        const rawScore = allIssues.reduce((s, i) => s + (severityWeight[i.severity] ?? 1), 0);
        const riskScore = Math.min(100, rawScore);
        const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 10 ? 'medium' : 'low';
        const masterReport = {
            isMasterReport: true, missionId, missionTitle: meta.mission_title, siteName: meta.site_name,
            latitude: meta.latitude, longitude: meta.longitude, generatedAt: new Date().toISOString(),
            totalJobs: jobs.rows.length, totalFiles, riskScore, riskLevel,
            totalIssues: allIssues.length, maxTempDelta, issues: allIssues, recommendations: allRecs, jobSummaries,
            summary: `Master report: ${jobs.rows.length} job(s), ${totalFiles} files, ${allIssues.length} issue(s). Risk: ${riskScore}/100 (${riskLevel}).`,
        };
        await query(
            `INSERT INTO ai_reports (deployment_id, industry, report_type, report_data, generated_by)
             VALUES ($1, 'solar', 'master_inspection', $2, $3)`,
            [missionId, JSON.stringify(masterReport), req.user.id]
        ).catch(() => {});
        res.json({ success: true, data: masterReport });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});






// ── DELETE /api/pilot/upload-jobs/bulk — Bulk delete jobs ─────────────────────
router.delete('/bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array required' });
        }
        const admin = isAdmin(req.user);
        const n = ids.length;
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const result = await query(
            `DELETE FROM upload_jobs
             WHERE id IN (${placeholders})
               AND (pilot_id = $${n + 1} OR $${n + 2}::boolean)
             RETURNING id`,
            [...ids, req.user.id, admin]
        );
        const deleted = result.rows.map(r => r.id);
        res.json({ success: true, deleted, count: deleted.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/pilot/upload-jobs/:jobId — Delete a single job ────────────────
router.delete('/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const admin = isAdmin(req.user);
        const result = await query(
            `DELETE FROM upload_jobs WHERE id = $1 AND (pilot_id = $2 OR $3) RETURNING id`,
            [jobId, req.user.id, admin]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Job not found or not authorised' });
        res.json({ success: true, deleted: [jobId] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── PATCH /api/pilot/upload-jobs/:jobId/complete ──────────────────────────────
router.patch('/:jobId/complete', async (req, res) => {
    try {
        const { jobId } = req.params;
        const pilotId = req.user.id;
        const result = await query(
            `UPDATE upload_jobs SET status = 'complete', updated_at = NOW()
             WHERE id = $1 AND pilot_id = $2 RETURNING *`,
            [jobId, pilotId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
