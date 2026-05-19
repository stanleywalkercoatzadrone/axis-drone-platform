import express from 'express';
import { protect } from '../middleware/auth.js';
import { listFiles, importFile } from '../services/googleDriveService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(protect);

// GET /api/v1/drive/files?parent=root
router.get('/files', async (req, res, next) => {
    try {
        const parentFolderId = req.query.parent || 'root';
        const files = await listFiles(req.user.id, parentFolderId);
        res.json({ success: true, data: files });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/drive/import
router.post('/import', async (req, res, next) => {
    try {
        const { fileId, missionId } = req.body;
        if (!fileId) throw new AppError('File ID is required', 400);

        // Fetch stream from Google Drive
        const { metadata, stream } = await importFile(req.user.id, fileId);

        // Here we would normally pipe the stream directly to Google Cloud Storage (GCS)
        // or process it locally. Since this is an import simulation:
        // We will just return success indicating it's "queued" or "processed".

        // Example GCS pipe:
        // const gcsStream = bucket.file(`imports/${metadata.name}`).createWriteStream();
        // stream.pipe(gcsStream);
        
        // Wait for it to finish (simulate)
        await new Promise(resolve => setTimeout(resolve, 1500));

        res.json({
            success: true,
            message: 'File imported successfully',
            data: {
                id: fileId,
                name: metadata.name,
                size: metadata.size,
                status: 'imported',
                url: `https://storage.googleapis.com/mock-bucket/imports/${encodeURIComponent(metadata.name)}`
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
