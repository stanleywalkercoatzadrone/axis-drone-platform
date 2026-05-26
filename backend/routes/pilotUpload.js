/**
 * pilotUpload.js — Pilot Data Upload Pipeline
 *
 * Two-phase workflow:
 *   1. POST /api/pilot/upload-jobs              — Create a job (returns storage destination)
 *   2. POST /api/pilot/upload-jobs/:id/files    — Upload files into the job
 *   3. POST /api/pilot/upload-jobs/:id/chunk    — Upload file chunks (for large multi-part uploads)
 *
 * Storage: all upload types route to Google Cloud Storage (GCS)
 *   Aerial  (images/thermal/orthomosaic) → GCS via uploadAerialImage()  — auto-sorted IR|RGB
 *   Ground  (lbd)                        → GCS via uploadLBDToGCS()     — {project}/{pilot}/{block}/
 *   Data    (kml/sensor_log/spreadsheet) → GCS via uploadByDestination() — flat folder
 *
 * Bucket is controlled by GCS_BUCKET_NAME env var (default: axis-platform-storage).
 */
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { tmpdir } from 'os';
import { protect } from '../middleware/auth.js';
import { isAdmin } from '../utils/roleUtils.js';
import { uploadSingle } from '../utils/fileUpload.js';
import { validateFileMagicBytes, ALLOWED_IMAGE_TYPES, ALLOWED_DATA_TYPES } from '../utils/fileUpload.js';
import { query } from '../config/database.js';
import { uploadByDestination, uploadLBDToGCS, uploadAerialImage } from '../services/storageService.js';
import { processUpload, analyzeWithGemini } from '../services/uploadProcessor.js';
import { uploadToDriveStructured } from '../services/googleDriveService.js';

// ── Filename → Group identifier ────────────────────────────────────────────────
// Strips trailing counter/UUID suffix so images with the same base name group together.
// Examples:
//   "SITE_A_Block1_001.jpg"     → "SITE_A_Block1"
//   "Scan_North_002.tif"        → "Scan_North"
//   "LBD_Zone_C_Row_04_005.jpg" → "LBD_Zone_C_Row_04"
//   "IMG_20240501_0001.jpg"     → "IMG_20240501"
function parseLBDGroup(filename) {
    // Remove extension
    const base = filename.replace(/\.[^.]+$/, '');
    // Strip trailing _NNN or -NNN numeric suffix (1–5 digits)
    const stripped = base.replace(/[_-]\d{1,5}$/, '');
    // If nothing remains meaningful, return the base as-is
    return stripped || base;
}

// ── Fire-and-forget Google Drive sync ─────────────────────────────────────────
// Called after every successful storage upload. Does not block the HTTP response.
async function syncFileToDrive({ userId, missionTitle, uploadType, filename, file }) {
    try {
        // Check if the user has Drive linked
        const { query: dbQuery } = await import('../config/database.js');
        let driveFolderUrl = null;
        
        let tokenRes = await dbQuery(
            `SELECT id, drive_folder FROM users WHERE id = $1 AND drive_access_token IS NOT NULL`,
            [userId]
        );
        if (tokenRes.rows.length === 0) {
            // Try the first admin with Drive linked as fallback
            tokenRes = await dbQuery(
                `SELECT id, drive_folder FROM users WHERE role ILIKE '%admin%' AND drive_access_token IS NOT NULL LIMIT 1`
            );
            if (tokenRes.rows.length === 0) {
                console.warn('[Drive] sync skipped: No admin or user has a linked Google Drive account.');
                return; // No Drive account linked — skip
            }
        }
        
        userId = tokenRes.rows[0].id;
        driveFolderUrl = tokenRes.rows[0].drive_folder;

        const group = parseLBDGroup(filename);
        
        // Extract base folder ID if user provided a target directory
        let baseFolderId = null;
        if (driveFolderUrl) {
            const match = driveFolderUrl.match(/(?:folders\/|id=)([a-zA-Z0-9_-]{15,})/);
            if (match && match[1]) {
                baseFolderId = match[1];
            }
        }

        let folderPath;
        if (baseFolderId) {
            // User provided a valid target directory folder ID -> Use it as base, then Mission > Type > Group
            const typeFolder = uploadType ? uploadType.charAt(0).toUpperCase() + uploadType.slice(1) : 'Misc';
            folderPath = [missionTitle, typeFolder, group];
        } else {
            // Fallback for missing/invalid Target Directory URL
            folderPath = ['Axis Drive', missionTitle, group];
        }

        await uploadToDriveStructured(userId, folderPath, file, filename, baseFolderId);
        console.log(`[Drive] ✓ ${missionTitle}/${group}/${filename}`);
    } catch (err) {
        // Never throw — Drive sync is best-effort
        console.warn(`[Drive] sync skipped for ${filename}:`, err);
    }
}

let io = null;
export function setIo(socketIoInstance) { io = socketIoInstance; }

const router = express.Router();
// ── DIAGNOSTIC: GET /api/pilot/upload-jobs/_diagnostics/ai-pipeline  ──────────
router.get('/_diagnostics/ai-pipeline', protect, async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }
        const filesRes = await query(`
            SELECT uf.id, uf.job_id, uf.file_name, uf.status, uf.error_message, 
                   uj.upload_type, uj.analysis_type, uf.ai_result, uf.created_at
            FROM upload_files uf
            JOIN upload_jobs uj ON uj.id = uf.job_id
            ORDER BY uf.created_at DESC
            LIMIT 15
        `);
        res.json({ success: true, count: filesRes.rows.length, data: filesRes.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.use(protect);

// ── Routing table ─────────────────────────────────────────────────────────────
const UPLOAD_DESTINATION = {
    images:      'gcs',  // aerial RGB photos
    thermal:     'gcs',  // aerial IR/thermal images
    orthomosaic: 'gcs',  // aerial orthomosaic GeoTIFFs
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
        if (destination === 'gcs' && ['images', 'thermal', 'orthomosaic'].includes(uploadType) && !missionFolder) {
            return res.status(400).json({ success: false, message: 'missionFolder is required for aerial uploads — e.g. M14 or Flight-3' });
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

        // Auto-select the correct prompt type if caller didn't specify one
        const AUTO_ANALYSIS_TYPE = {
            thermal:     'thermal_fault',   // IR → thermal fault detection
            images:      'solar_panel',      // RGB aerial → full visual solar inspection
            lbd:         'lbd_defect',       // LiDAR/structural → structural defect detection
            orthomosaic: 'full_inspection',  // Orthomosaic → comprehensive multi-system
            kml:         'none',
            sensor_log:  'none',
            spreadsheet: 'none',
        };
        let resolvedAnalysisType = analysisType || AUTO_ANALYSIS_TYPE[uploadType] || 'full_inspection';
        
        // Defensive override: if they upload an image but the frontend left it at thermal_fault, fix it.
        if (uploadType === 'images' && resolvedAnalysisType === 'thermal_fault') {
            resolvedAnalysisType = 'solar_panel';
        } else if (uploadType === 'thermal' && resolvedAnalysisType === 'solar_panel') {
            resolvedAnalysisType = 'thermal_fault';
        }

        const result = await query(
            `INSERT INTO upload_jobs (mission_id, pilot_id, upload_type, analysis_type, storage_destination, lbd_block, mission_folder, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [missionId, pilotId, uploadType, resolvedAnalysisType, destination, lbdBlock || null, missionFolder || null, notes || null]
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

        // SECURITY: Validate file magic bytes before any storage write (H-6)
        const isAerialJob = ['images', 'thermal', 'orthomosaic'].includes(job.upload_type);
        try {
            await validateFileMagicBytes(file, isAerialJob ? ALLOWED_IMAGE_TYPES : ALLOWED_DATA_TYPES);
        } catch (typeErr) {
            return res.status(400).json({ success: false, message: typeErr.message });
        }

        const folder = FOLDER_MAP[job.upload_type] || 'uploads';
        const destination = job.storage_destination || UPLOAD_DESTINATION[job.upload_type] || 'local';

            // Upload to GCS based on job destination
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

            } else if (isAerialJob) {
                // Aerial images → GCS: {SiteName}/{MissionFolder}/IR|RGB/{uuid}{ext}
                // missionFolder is what the pilot typed in (e.g. M14, Flight-3, Block-A-Day2)
                const siteRes = await query(
                    `SELECT d.site_name FROM deployments d WHERE d.id = $1`,
                    [job.mission_id]
                );
                const siteName    = siteRes.rows[0]?.site_name || 'Site';
                const folderLabel = job.mission_folder || 'Mission';

                // GCS key: {SiteName}/{pilot-supplied folder}/IR|RGB/{uuid}{ext}
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

        // ── Fire-and-forget Google Drive sync ─────────────────────────────────
        // Fetch mission title for folder naming
        query(`SELECT title FROM deployments WHERE id = $1`, [job.mission_id])
            .then(r => {
                const missionTitle = r.rows[0]?.title || `Mission-${job.mission_id.slice(0, 8)}`;
                syncFileToDrive({ userId: pilotId, missionTitle, uploadType: job.upload_type, filename: file.originalname, file }).catch(() => {});
            }).catch(() => {});

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
            exifMeta:     uploadResult.exifMeta
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

// ── POST /api/pilot/upload-jobs/:jobId/chunk — Upload a file chunk ────────────
router.post('/:jobId/chunk', uploadSingle, async (req, res) => {
    try {
        const { jobId } = req.params;
        const pilotId = req.user.id;
        const chunk = req.file; // The chunk buffer
        
        // Metadata passed via form fields
        const fileId = req.body.fileId;
        const fileName = req.body.fileName;
        const mimeType = req.body.mimeType || 'application/octet-stream';
        const chunkIndex = parseInt(req.body.chunkIndex);
        const totalChunks = parseInt(req.body.totalChunks);
        
        if (!chunk || !fileId || isNaN(chunkIndex) || isNaN(totalChunks)) {
            return res.status(400).json({ success: false, message: 'Invalid chunk payload' });
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
        
        // Store the chunk in /tmp
        const chunkDir = path.join(tmpdir(), 'axis_uploads', jobId, fileId);
        await fs.mkdir(chunkDir, { recursive: true });
        
        const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
        await fs.writeFile(chunkPath, chunk.buffer);
        
        // Check if all chunks are received
        const files = await fs.readdir(chunkDir);
        
        if (files.length === totalChunks) {
            // All chunks arrived, assemble the file
            const finalFilePath = path.join(tmpdir(), 'axis_uploads', jobId, `final_${fileId}`);
            
            // Append all chunks sequentially
            const writeStream = createWriteStream(finalFilePath);
            for (let i = 0; i < totalChunks; i++) {
                const chunkData = await fs.readFile(path.join(chunkDir, `chunk_${i}`));
                writeStream.write(chunkData);
            }
            writeStream.end();
            
            // Wait for the stream to finish writing
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            
            // Read the final assembled file back into a buffer (since storageService expects it)
            // Note: CloudRun instances have ~2GB RAM + 2GB ephemeral disk usually. 
            // For files > 1GB this might OOM. But for drone images (50MB) and point clouds (500MB) it's fine.
            const finalBuffer = await fs.readFile(finalFilePath);
            const assembledFile = {
                originalname: fileName,
                mimetype: mimeType,
                size: finalBuffer.length,
                buffer: finalBuffer
            };

            // SECURITY: Validate assembled file magic bytes BEFORE any storage write.
            // Chunk uploads previously bypassed per-file validation — this closes that gap.
            const isAerialChunk = ['images', 'thermal', 'orthomosaic'].includes(job.upload_type);
            try {
                await validateFileMagicBytes(assembledFile, isAerialChunk ? ALLOWED_IMAGE_TYPES : ALLOWED_DATA_TYPES);
            } catch (typeErr) {
                // Clean up temp files before rejecting
                try { await fs.rm(chunkDir, { recursive: true, force: true }); } catch (_) {}
                try { await fs.unlink(finalFilePath); } catch (_) {}
                return res.status(400).json({ success: false, message: typeErr.message });
            }

            // Now route to storage using the standard machinery
            const folder = FOLDER_MAP[job.upload_type] || 'uploads';
            const destination = job.storage_destination || UPLOAD_DESTINATION[job.upload_type] || 'local';
            
            let uploadResult;
            try {
                if (job.upload_type === 'lbd' && destination === 'gcs') {
                    const ctx = await query(
                        `SELECT d.title AS project, u.full_name AS pilot
                         FROM deployments d JOIN users u ON u.id = $2 WHERE d.id = $1`,
                        [job.mission_id, job.pilot_id]
                    );
                    uploadResult = await uploadLBDToGCS(
                        assembledFile, 
                        ctx.rows[0]?.project || 'Project', 
                        ctx.rows[0]?.pilot || 'Pilot', 
                        job.lbd_block || 'Block'
                    );
                } else if (isAerialChunk) {
                    const siteRes = await query(`SELECT site_name FROM deployments WHERE id = $1`, [job.mission_id]);
                    const siteName = siteRes.rows[0]?.site_name || 'Site';
                    uploadResult = await uploadAerialImage(
                        assembledFile, job.mission_id, null, `${siteName}/${job.mission_folder || 'Mission'}`
                    );
                } else {
                    uploadResult = await uploadByDestination(assembledFile, folder, destination);
                }
            } catch (storageErr) {
                console.warn('[pilotUpload] Assembled cloud upload failed, falling back to local:', storageErr.message);
                const uploadDir = path.resolve('uploads', folder);
                await fs.mkdir(uploadDir, { recursive: true });
                const safeFilename = `${jobId}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                await fs.writeFile(path.join(uploadDir, safeFilename), assembledFile.buffer);
                uploadResult = { url: `/uploads/${folder}/${safeFilename}`, key: `uploads/${folder}/${safeFilename}` };
            }
            
            // Record file in DB
            const fileRecord = await query(
                `INSERT INTO upload_files (job_id, file_name, file_size, storage_url, status)
                 VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
                [jobId, fileName, assembledFile.size, uploadResult.url]
            );
            const uploadFileId = fileRecord.rows[0].id;
            
            await query(
                `UPDATE upload_jobs SET file_count = file_count + 1, updated_at = NOW() WHERE id = $1`,
                [jobId]
            );
            
            // Clean up temp files
            try {
                await fs.rm(chunkDir, { recursive: true, force: true });
                await fs.unlink(finalFilePath).catch(()=>{});
            } catch (e) {
                console.warn('Failed to clean up chunks:', e.message);
            }
            
            // Trigger processing
            processUpload({
                jobId, uploadFileId, missionId: job.mission_id,
                uploadType: job.upload_type, analysisType: job.analysis_type,
                storageUrl: uploadResult.url, fileBuffer: assembledFile.buffer,
                mimeType: assembledFile.mimetype, fileName, io, userId: pilotId,
                exifMeta: uploadResult.exifMeta
            }).catch(e => console.error('[pilotUpload] processUpload error:', e.message));
            
            // ── Fire-and-forget Google Drive sync (chunked upload) ──────────
            query(`SELECT title FROM deployments WHERE id = $1`, [job.mission_id])
                .then(r => {
                    const missionTitle = r.rows[0]?.title || `Mission-${job.mission_id.slice(0, 8)}`;
                    syncFileToDrive({ userId: pilotId, missionTitle, uploadType: job.upload_type, filename: fileName, file: assembledFile }).catch(() => {});
                }).catch(() => {});

            return res.json({ success: true, complete: true, data: { fileUrl: uploadResult.url } });
        }
        
        // Acknowledged chunk, but not complete yet
        res.json({ success: true, complete: false, chunkIndex, totalChunks });
        
    } catch (err) {
        console.error('[pilotUpload] chunk error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pilot/upload-jobs/admin/all — All jobs (admin view) ──────────────
router.get('/admin/all', async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }
        // Unified admin monitor including new pipeline_jobs where possible
        const result = await query(
            `-- Unified Admin Monitor: Standard Uploads + Orthomosaic Processing + Legacy Pipeline
             (
              SELECT uj.id, uj.mission_id, uj.upload_type, uj.analysis_type,
                     uj.status, uj.ai_result, uj.file_count::text,
                     uj.mission_folder, uj.lbd_block, uj.report_url,
                     uj.created_at, uj.updated_at,
                     d.title                                 AS mission_title,
                     d.site_name                             AS site_name,
                     u.email                                 AS pilot_email,
                     COALESCE(u.full_name, u.email)          AS pilot_name
              FROM upload_jobs uj
              LEFT JOIN deployments d ON d.id = uj.mission_id
              LEFT JOIN users u       ON u.id = uj.pilot_id
             )
             UNION ALL
             (
              SELECT j.id, p.mission_id, 'orthomosaic'       AS upload_type, j.quality_tier AS analysis_type,
                     CASE 
                        WHEN j.status = 'completed' THEN 'complete'
                        WHEN j.status IN ('processing', 'generating_tiles') THEN 'processing'
                        WHEN j.status IN ('failed', 'canceled') THEN 'failed'
                        ELSE 'pending'
                     END                                     AS status,
                     NULL::jsonb                             AS ai_result,
                     j.image_count::text                     AS file_count,
                     NULL                                    AS mission_folder,
                     NULL                                    AS lbd_block,
                     NULL                                    AS report_url,
                     j.created_at, j.updated_at,
                     d.title                                 AS mission_title,
                     d.site_name                             AS site_name,
                     u.email                                 AS pilot_email,
                     COALESCE(u.full_name, u.email)          AS pilot_name
              FROM orthomosaic_jobs j
              LEFT JOIN orthomosaic_projects p ON p.id = j.project_id
              LEFT JOIN deployments d          ON d.id = p.mission_id
              LEFT JOIN users u                ON u.id = j.pilot_id
             )
             ORDER BY created_at DESC
             LIMIT 100`,
            []
        );


        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/pilot/upload-jobs/admin/pipeline — Global Pipeline View ─────────
router.get('/admin/pipeline', async (req, res) => {
    try {
        const { limit = 50, status } = req.query;
        // Mock the old pipeline view using the current systems so the frontend monitor doesn't break
        const result = await query(
            `SELECT uj.id, uj.status, uj.processed_count as progress, uj.upload_type as job_type, 
                    'normal' as priority, uj.file_count as image_count, uj.created_at as started_at, 
                    uj.updated_at as completed_at, NULL as error_message, uj.ai_result,
                    uj.mission_id, uj.file_count as total_files, uj.file_count as uploaded_files,
                    d.title as mission_title, d.location as site_name
             FROM upload_jobs uj
             JOIN deployments d ON d.id = uj.mission_id
             ORDER BY uj.created_at DESC
             LIMIT $1`,
            [parseInt(limit)]
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
        let job = jobCheck.rows[0];
        let isOrtho = false;

        if (jobCheck.rows.length === 0) {
            // Check orthomosaic_jobs instead
            const orthoCheck = await query(
                `SELECT * FROM orthomosaic_jobs WHERE id = $1 AND (pilot_id = $2 OR $3)`,
                [jobId, req.user.id, isAdmin(req.user)]
            );
            if (orthoCheck.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Job not found' });
            }
            job = orthoCheck.rows[0];
            isOrtho = true;
        }

        if (isOrtho) {
            // Query orthomosaic_upload_sets and construct public GCS urls
            const bucketName = process.env.GCS_BUCKET_NAME || 'axis-platform-storage';
            const result = await query(
                `SELECT id, file_name, 
                        CONCAT('https://storage.googleapis.com/', $2::text, '/', gcs_path) AS storage_url, 
                        file_size_bytes AS file_size, 
                        NULL AS ai_result, validation_status AS status, created_at
                 FROM orthomosaic_upload_sets
                 WHERE job_id = $1 AND gcs_path IS NOT NULL
                 ORDER BY created_at DESC
                 LIMIT 200`,
                [jobId, bucketName]
            );
            return res.json({ success: true, data: result.rows });
        }

        // Standard upload_files logic
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

// ── Helper: aggregate all per-file AI results for a job ─────────────────────
async function aggregateJobAiResults(jobId) {
    const severityWeight = { critical: 30, high: 15, medium: 5, low: 1 };

    // Pull every file's ai_result that has been processed
    const filesRes = await query(
        `SELECT file_name, ai_result FROM upload_files
         WHERE job_id = $1 AND ai_result IS NOT NULL
         ORDER BY created_at ASC`,
        [jobId]
    );

    let allFaults    = [];
    let allDefects   = [];
    let allAnomalies = [];
    let allRecs      = [];
    let allFlags     = [];
    let summaries    = [];
    let maxTempDelta = null;
    let maxSoil      = null;
    let worstCond    = 'good';
    const condRank   = { good: 0, normal: 0, monitor: 1, degraded: 1, review: 2, critical: 3, unsafe: 4 };

    for (const row of filesRes.rows) {
        const r = row.ai_result;
        if (!r) continue;

        // Collect all issues, tagging with source file
        const tag = (arr) => (arr || []).map(item => ({ ...item, sourceFile: row.file_name }));
        allFaults    = [...allFaults,    ...tag(r.faults)];
        allDefects   = [...allDefects,   ...tag(r.defects)];
        allAnomalies = [...allAnomalies, ...tag(r.anomalies)];
        if (r.recommendations) allRecs   = [...allRecs,  ...r.recommendations];
        if (r.complianceFlags) allFlags  = [...allFlags, ...r.complianceFlags];
        if (r.summary)         summaries.push(`[${row.file_name}] ${r.summary}`);
        if (r.maxTempDelta != null && (maxTempDelta == null || r.maxTempDelta > maxTempDelta)) maxTempDelta = r.maxTempDelta;
        if (r.soilingPercent != null && (maxSoil == null || r.soilingPercent > maxSoil)) maxSoil = r.soilingPercent;
        const cRank = condRank[r.overallCondition ?? r.overallSeverity ?? 'good'] ?? 0;
        const wRank = condRank[worstCond] ?? 0;
        if (cRank > wRank) worstCond = r.overallCondition ?? r.overallSeverity ?? worstCond;
    }

    const allIssues  = [...allFaults, ...allDefects, ...allAnomalies];
    const rawScore   = allIssues.reduce((s, i) => s + (severityWeight[i.severity] ?? 1), 0);
    const riskScore  = Math.min(100, rawScore);
    const riskLevel  = riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 10 ? 'medium' : 'low';
    const critCount  = allIssues.filter(i => i.severity === 'critical').length;

    return {
        filesProcessed:   filesRes.rows.length,
        allIssues,
        faults:           allFaults,
        defects:          allDefects,
        anomalies:        allAnomalies,
        totalIssues:      allIssues.length,
        criticalIssues:   critCount,
        riskScore,
        riskLevel,
        maxTempDelta,
        soilingPercent:   maxSoil,
        overallCondition: worstCond,
        recommendations:  [...new Set(allRecs)],
        complianceFlags:  [...new Set(allFlags)],
        summary:          summaries.length > 0
            ? summaries.join('\n')
            : (filesRes.rows.length === 0 ? 'AI analysis has not completed yet.' : 'Analysis complete.'),
    };
}

// ── FORCE RE-ANALYZE JOB ──────────────────────────────────────────────────────
router.post('/:id/reanalyze', protect, async (req, res) => {
    try {
        const jobId = req.params.id;
        const jobRes = await query(`SELECT * FROM upload_jobs WHERE id = $1`, [jobId]);
        if (jobRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
        
        const job = jobRes.rows[0];
        
        // Fetch all files
        const filesRes = await query(`SELECT * FROM upload_files WHERE job_id = $1`, [jobId]);
        res.json({ success: true, message: `Re-analyzing ${filesRes.rows.length} files in background.` });
        
        await query(`UPDATE upload_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`, [jobId]);
        
        for (const file of filesRes.rows) {
            try {
                // Manually trigger analysis
                const aiResult = await analyzeWithGemini(
                    file.storage_url || file.file_path, 
                    null, 
                    null, 
                    job.upload_type, 
                    job.analysis_type
                );
                
                await query(
                    `UPDATE upload_files SET ai_result = $1, error_message = NULL, status = 'complete', updated_at = NOW() WHERE id = $2`,
                    [JSON.stringify(aiResult), file.id]
                );
            } catch (err) {
                console.error(`Reanalyze error file ${file.id}:`, err.message);
                await query(
                    `UPDATE upload_files SET error_message = $1, status = 'failed' WHERE id = $2`,
                    [err.message, file.id]
                );
            }
        }
        
        await query(`UPDATE upload_jobs SET status = 'complete', updated_at = NOW() WHERE id = $1`, [jobId]);
        
    } catch (err) {
        console.error('[pilotUpload] reanalyze error:', err);
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

        // ── Aggregate ALL per-file AI results (fixes the "last file wins" bug) ──
        const agg = await aggregateJobAiResults(jobId);

        // Fallback to job-level ai_result if no per-file results found yet
        if (agg.filesProcessed === 0 && j.ai_result) {
            const r = j.ai_result;
            const faults    = r?.faults    ?? [];
            const defects   = r?.defects   ?? [];
            const anomalies = r?.anomalies ?? [];
            agg.allIssues   = [...faults, ...defects, ...anomalies];
            agg.totalIssues = agg.allIssues.length;
            agg.recommendations = r?.recommendations ?? [];
            agg.summary = r?.summary ?? 'AI analysis complete.';
            agg.overallCondition = r?.overallCondition ?? r?.overallSeverity ?? 'unknown';
            agg.maxTempDelta = r?.maxTempDelta ?? null;
        }

        const reportData = {
            jobId,
            missionId:        j.mission_id,
            missionTitle:     j.mission_title,
            siteName:         j.site_name,
            pilotName:        j.pilot_name || j.pilot_email,
            uploadType:       j.upload_type,
            analysisType:     j.analysis_type,
            generatedAt:      new Date().toISOString(),
            riskScore:        agg.riskScore,
            riskLevel:        agg.riskLevel,
            summary:          agg.summary,
            totalIssues:      agg.totalIssues,
            criticalIssues:   agg.criticalIssues,
            overallCondition: agg.overallCondition,
            maxTempDelta:     agg.maxTempDelta,
            soilingPercent:   agg.soilingPercent,
            imageQuality:     null,
            issues:           agg.allIssues,
            faults:           agg.faults,
            defects:          agg.defects,
            anomalies:        agg.anomalies,
            recommendations:  agg.recommendations,
            complianceFlags:  agg.complianceFlags,
            filesProcessed:   agg.filesProcessed,
        };

        // ── Save to ai_reports ────────────────────────────────────────────────
        const rpt = await query(
            `INSERT INTO ai_reports (deployment_id, industry, report_type, report_data, generated_by)
             VALUES ($1, $2, 'ai_inspection', $3, $4)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [j.mission_id, j.industry || 'solar', JSON.stringify(reportData), req.user.id]
        ).catch(() => ({ rows: [] }));

        const reportId  = rpt.rows[0]?.id;
        const reportUrl = `/api/pilot/upload-jobs/${jobId}/report`;

        await query(
            `UPDATE upload_jobs SET report_url = $1, updated_at = NOW() WHERE id = $2`,
            [reportUrl, jobId]
        ).catch(() => {});

        if (io) {
            io.emit('report:ready', {
                jobId, reportId, reportUrl,
                missionId: j.mission_id,
                siteName: j.site_name,
                riskScore:   reportData.riskScore,
                riskLevel:   reportData.riskLevel,
                totalIssues: reportData.totalIssues,
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

        // ── Aggregate ALL per-file results first (source of truth) ────────────
        const agg = await aggregateJobAiResults(jobId);

        // If we have aggregated results, return them directly (most accurate)
        if (agg.filesProcessed > 0) {
            return res.json({ success: true, data: {
                jobId,
                missionId:        j.mission_id,
                missionTitle:     j.mission_title,
                siteName:         j.site_name,
                pilotName:        j.pilot_name || j.pilot_email,
                uploadType:       j.upload_type,
                analysisType:     j.analysis_type,
                generatedAt:      j.updated_at,
                riskScore:        agg.riskScore,
                riskLevel:        agg.riskLevel,
                summary:          agg.summary,
                totalIssues:      agg.totalIssues,
                criticalIssues:   agg.criticalIssues,
                overallCondition: agg.overallCondition,
                maxTempDelta:     agg.maxTempDelta,
                soilingPercent:   agg.soilingPercent,
                imageQuality:     null,
                issues:           agg.allIssues,
                faults:           agg.faults,
                defects:          agg.defects,
                anomalies:        agg.anomalies,
                recommendations:  agg.recommendations,
                complianceFlags:  agg.complianceFlags,
                filesProcessed:   agg.filesProcessed,
            }});
        }

        // ── Fallback: try stored ai_reports ───────────────────────────────────
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

        // ── Last resort: job-level ai_result ─────────────────────────────────
        const aiResult  = j.ai_result;
        const faults    = aiResult?.faults    ?? [];
        const defects   = aiResult?.defects   ?? [];
        const anomalies = aiResult?.anomalies ?? [];
        const allIssues = [...faults, ...defects, ...anomalies];
        const severityWeight = { critical: 30, high: 15, medium: 5, low: 1 };
        const rawScore  = allIssues.reduce((s, i) => s + (severityWeight[i.severity] ?? 1), 0);
        const riskScore = Math.min(100, rawScore);
        const riskLevel = riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 10 ? 'medium' : 'low';

        res.json({ success: true, data: {
            jobId, missionId: j.mission_id, missionTitle: j.mission_title, siteName: j.site_name,
            pilotName: j.pilot_name || j.pilot_email, uploadType: j.upload_type,
            analysisType: j.analysis_type, generatedAt: j.updated_at,
            riskScore, riskLevel,
            summary: aiResult?.summary ?? (aiResult ? '' : 'AI analysis has not been run yet for this job.'),
            totalIssues: allIssues.length,
            overallCondition: aiResult?.overallCondition ?? aiResult?.overallSeverity ?? 'pending',
            maxTempDelta: aiResult?.maxTempDelta ?? null,
            imageQuality: aiResult?.imageQuality ?? null,
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
        const orthoResult = await query(
            `DELETE FROM orthomosaic_jobs
             WHERE id IN (${placeholders})
               AND (pilot_id = $${n + 1} OR $${n + 2}::boolean)
             RETURNING id`,
            [...ids, req.user.id, admin]
        );
        const deleted = [...result.rows, ...orthoResult.rows].map(r => r.id);
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
            `DELETE FROM upload_jobs 
             WHERE id = $1 AND (pilot_id = $2 OR $3) 
             RETURNING id`,
            [jobId, req.user.id, admin]
        );
        if (result.rows.length > 0) {
            return res.json({ success: true, deleted: [jobId] });
        }

        const orthoResult = await query(
            `DELETE FROM orthomosaic_jobs 
             WHERE id = $1 AND (pilot_id = $2 OR $3) 
             RETURNING id`,
            [jobId, req.user.id, admin]
        );
        if (orthoResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Job not found or not authorised' });
        }
        res.json({ success: true, deleted: [jobId] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ── DIAGNOSTIC: GET /api/pilot/upload-jobs/_diagnostics/ai-pipeline  ──────────
router.get('/_diagnostics/ai-pipeline', async (req, res) => {
    try {
        const filesRes = await query(`
            SELECT uf.id, uf.job_id, uf.file_name, uf.status, uf.error_message, 
                   uj.upload_type, uj.analysis_type, uf.ai_result, uf.created_at
            FROM upload_files uf
            JOIN upload_jobs uj ON uj.id = uf.job_id
            ORDER BY uf.created_at DESC
            LIMIT 15
        `);
        res.json({ success: true, count: filesRes.rows.length, data: filesRes.rows });
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
