/**
 * local.js — Local mode API routes (only active when AXIS_LOCAL_MODE=true)
 *
 * Routes:
 *   GET  /api/local/status           — app status, job stats, ODM health
 *   GET  /api/local/jobs             — list all local jobs
 *   GET  /api/local/jobs/:id         — single job
 *   POST /api/local/jobs             — submit a new orthomosaic job
 *   GET  /api/local/files/:path      — serve a local output file (for viewer)
 *   POST /api/local/sync             — trigger manual sync to Axis Platform
 *   GET  /api/local/sync/log/:jobId  — sync log for a job
 */

import express  from 'express';
import multer   from 'multer';
import path     from 'path';
import fsp      from 'fs/promises';
import fs       from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/logger.js';
import {
    createJob, getJob, listJobs, updateJob, getStats, getSyncLog,
} from '../services/localDatabase.js';
import { runOrthomosaic, checkOdmHealth } from '../services/orthomosaicEngine.js';
import { syncPendingJobs } from '../services/syncService.js';

const router = express.Router();

const DATA_DIR = process.env.LOCAL_DATA_DIR
    || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', 'AxisOrtho', 'jobs');

// ── Multer: save uploads directly to job input dir ───────────────────────────

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const jobId  = req.jobId || (req.jobId = uuidv4());
        const dir    = path.join(DATA_DIR, jobId, 'input');
        await fsp.mkdir(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ok = /\.(jpg|jpeg|tif|tiff|png)$/i.test(file.originalname);
        cb(null, ok);
    },
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per file
});

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
    const [odmHealth, stats] = await Promise.all([
        checkOdmHealth().catch(e => ({ healthy: false, error: e.message })),
        Promise.resolve(getStats()),
    ]);
    res.json({
        success:    true,
        localMode:  true,
        dataDir:    DATA_DIR,
        odm:        odmHealth,
        jobs:       stats,
        syncToken:  !!process.env.AXIS_SYNC_TOKEN,
        apiUrl:     process.env.AXIS_API_URL || 'https://axisplatform.app/api',
    });
});

// ── Jobs ──────────────────────────────────────────────────────────────────────

router.get('/jobs', (req, res) => {
    const jobs = listJobs({ limit: Number(req.query.limit) || 50 });
    res.json({ success: true, data: jobs });
});

router.get('/jobs/:id', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: job });
});

/**
 * POST /api/local/jobs
 * Accepts multipart upload of drone images + optional metadata.
 * Creates a job, writes images to disk, starts processing asynchronously.
 */
router.post('/jobs', upload.array('images', 2000), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No images uploaded' });
        }

        const jobId      = req.jobId || uuidv4();
        const inputDir   = path.join(DATA_DIR, jobId, 'input');
        const outputDir  = path.join(DATA_DIR, jobId, 'output');
        const fastMode   = req.body.fastMode === 'true' || req.body.fastMode === true;
        const missionId  = req.body.missionId  || null;
        const missionTitle = req.body.missionTitle || null;

        await fsp.mkdir(outputDir, { recursive: true });

        // Create job record in SQLite
        const job = createJob({
            id:           jobId,
            missionId,
            missionTitle,
            imageCount:   req.files.length,
            fastMode,
            inputDir,
        });

        // Respond immediately — processing runs in background
        res.status(202).json({ success: true, data: job });

        // ── Background processing ─────────────────────────────────────────────
        setImmediate(async () => {
            try {
                updateJob(jobId, { status: 'processing', pipeline_stage: 'Starting' });

                const files = req.files.map(f => ({
                    name:      f.originalname,
                    localPath: f.path,
                }));

                const results = await runOrthomosaic(
                    { jobId, missionId, files, outputDir, fastMode },
                    (pct) => updateJob(jobId, { progress: pct, pipeline_stage: `Processing ${pct}%` })
                );

                updateJob(jobId, {
                    status:           'completed',
                    pipeline_stage:   'Completed',
                    progress:         100,
                    output_dir:       outputDir,
                    orthomosaic_path: results.orthomosaicPath || null,
                    dsm_path:         results.dsmPath         || null,
                    archive_path:     results.archivePath     || null,
                });

                logger.info(`[Local] ✓ Job ${jobId} completed.`);
            } catch (err) {
                logger.error(`[Local] Job ${jobId} failed: ${err.message}`);
                updateJob(jobId, { status: 'failed', error_message: err.message });
            }
        });
    } catch (err) {
        logger.error('[Local POST /jobs]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── File serving (for orthomosaic viewer) ─────────────────────────────────────

router.get('/files/*', (req, res) => {
    // Decode and sanitize path
    const rawPath = decodeURIComponent(req.params[0] || '');
    const safePath = path.normalize(rawPath).replace(/^(\.\.[/\\])+/, '');
    const absPath  = path.join(DATA_DIR, safePath);

    // Security: must be within DATA_DIR
    if (!absPath.startsWith(DATA_DIR)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!fs.existsSync(absPath)) {
        return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Set content type based on extension
    const ext = path.extname(absPath).toLowerCase();
    const mimeTypes = {
        '.tif':  'image/tiff',
        '.tiff': 'image/tiff',
        '.zip':  'application/zip',
        '.png':  'image/png',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(absPath)}"`);

    const stat = fs.statSync(absPath);
    res.setHeader('Content-Length', stat.size);

    fs.createReadStream(absPath).pipe(res);
});

// ── Sync ──────────────────────────────────────────────────────────────────────

router.post('/sync', async (req, res) => {
    try {
        const result = await syncPendingJobs();
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[Local POST /sync]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/sync/log/:jobId', (req, res) => {
    const log = getSyncLog(req.params.jobId);
    res.json({ success: true, data: log });
});

export default router;
