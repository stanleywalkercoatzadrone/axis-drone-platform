/**
 * mapping.js  —  Axis Mapping Engine™ routes
 *
 * Upload flow (chunked through Cloud Run, no browser-to-GCS direct upload):
 *   POST /init          Create job, returns job_id + per-file GCS paths
 *   POST /chunk         Upload one 8MB chunk; backend streams to GCS
 *   POST /commit        All chunks done → trigger ODM
 *   GET  /:id/status    Job status
 *   GET  /:id/assets    Output assets
 */
import express from 'express';
import multer  from 'multer';
import { protect } from '../../middleware/auth.js';
import * as ctrl from '../../controllers/mappingController.js';

const router = express.Router();

// 10MB limit per chunk — well under Cloud Run's 32MB request cap
const chunkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

router.use(protect);

// Step 1 — create job records, return job_id and per-file gcs paths
router.post('/init',   ctrl.initUpload);

// Step 2 — receive one chunk per request, stream to GCS
router.post('/chunk',  (req, res, next) => {
    chunkUpload.single('chunk')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (err) return next(err);
        next();
    });
}, ctrl.uploadChunk);

// Step 3 — all chunks uploaded, trigger ODM
router.post('/commit', ctrl.commitUpload);

router.get('/active',    ctrl.getActiveJobs); // list in-flight jobs (for auto-resume)
router.get('/:id/status', ctrl.getStatus);
router.get('/:id/assets', ctrl.getAssets);
router.get('/:id/images', ctrl.getImages);  // signed URLs for gallery

export default router;
