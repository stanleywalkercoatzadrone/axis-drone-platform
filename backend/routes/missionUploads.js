import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const router = express.Router();
router.use(protect);

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || process.env.SUPABASE_STORAGE_BUCKET;
let storage = null;
if (GCS_BUCKET_NAME) {
    try { storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT }); } catch(e) {}
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

// In-memory registry mapping dataset_id -> array of completed files
const completedDatasets = new Map();
const sessionMeta = new Map();

router.post('/dataset/create', (req, res) => {
    const { mission_id, total_files } = req.body;
    const dataset_id = uuidv4();
    completedDatasets.set(dataset_id, { mission_id, files: [] });
    res.json({ success: true, dataset_id });
});

router.post('/initiate', async (req, res) => {
    const { dataset_id, mission_id, file_name, file_size, file_type } = req.body;
    const upload_session_id = uuidv4();
    const file_id = uuidv4();
    const total_chunks = Math.max(1, Math.ceil(file_size / CHUNK_SIZE));
    
    sessionMeta.set(upload_session_id, { dataset_id, mission_id, file_name, file_size, file_type, total_chunks });
    
    const signed_urls = [];
    if (storage && GCS_BUCKET_NAME) {
        for (let i = 0; i < total_chunks; i++) {
            const gcsPath = `uploads/chunks/${upload_session_id}/part_${i}`;
            const [url] = await storage.bucket(GCS_BUCKET_NAME).file(gcsPath).getSignedUrl({
                version: 'v4', action: 'write', expires: Date.now() + 60 * 60 * 1000,
                contentType: 'application/octet-stream',
            });
            signed_urls.push({ index: i, url });
        }
    } else {
        // Fallback to local server disk URLs for local dev
        const localDir = path.join(process.cwd(), 'uploads', 'chunks', upload_session_id);
        fs.mkdirSync(localDir, { recursive: true });
        for (let i = 0; i < total_chunks; i++) {
            signed_urls.push({ index: i, url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/mission-uploads/local-put/${upload_session_id}/${i}` });
        }
    }
    
    res.json({ success: true, upload_session_id, file_id, total_chunks, signed_urls });
});

// Local PUT fallback
router.put('/local-put/:session_id/:index', express.raw({ type: '*/*', limit: '20mb' }), (req, res) => {
    const { session_id, index } = req.params;
    const p = path.join(process.cwd(), 'uploads', 'chunks', session_id, `part_${index}`);
    fs.writeFileSync(p, req.body);
    res.status(200).send('OK');
});

router.post('/chunk', (req, res) => {
    res.json({ success: true });
});

router.post('/retry', async (req, res) => {
    const { upload_session_id, missing_chunks } = req.body;
    const signed_urls = [];
    if (storage && GCS_BUCKET_NAME) {
        for (const i of missing_chunks) {
            const gcsPath = `uploads/chunks/${upload_session_id}/part_${i}`;
            const [url] = await storage.bucket(GCS_BUCKET_NAME).file(gcsPath).getSignedUrl({
                version: 'v4', action: 'write', expires: Date.now() + 60 * 60 * 1000,
                contentType: 'application/octet-stream',
            });
            signed_urls.push({ index: i, url });
        }
    } else {
        for (const i of missing_chunks) {
            signed_urls.push({ index: i, url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/mission-uploads/local-put/${upload_session_id}/${i}` });
        }
    }
    res.json({ success: true, signed_urls });
});

router.post('/complete', async (req, res) => {
    const { upload_session_id } = req.body;
    const meta = sessionMeta.get(upload_session_id);
    if (!meta) return res.json({ success: true }); // Ignore if unknown
    
    let buffer = null;
    try {
        if (storage && GCS_BUCKET_NAME) {
            const bucket = storage.bucket(GCS_BUCKET_NAME);
            const sources = Array.from({length: meta.total_chunks}, (_, i) => bucket.file(`uploads/chunks/${upload_session_id}/part_${i}`));
            const dest = bucket.file(`uploads/assembled/${upload_session_id}/${meta.file_name}`);
            
            if (sources.length > 0) {
                if (sources.length === 1) {
                    await sources[0].copy(dest);
                } else if (sources.length <= 32) {
                    await bucket.combine(sources, dest);
                } else {
                    await bucket.combine(sources.slice(0, 32), dest);
                }
                const [data] = await dest.download();
                buffer = data;
            }
        } else {
            // Read local chunks
            const chunks = [];
            for (let i = 0; i < meta.total_chunks; i++) {
                const p = path.join(process.cwd(), 'uploads', 'chunks', upload_session_id, `part_${i}`);
                if (fs.existsSync(p)) chunks.push(fs.readFileSync(p));
            }
            buffer = Buffer.concat(chunks);
        }
        
        // Add to dataset
        if (completedDatasets.has(meta.dataset_id)) {
            completedDatasets.get(meta.dataset_id).files.push({
                file_name: meta.file_name,
                buffer: buffer,
                type: meta.file_type
            });
        }
    } catch (err) {
        console.error('Assemble error:', err);
    }
    
    res.json({ success: true });
});

router.post('/dataset/complete', async (req, res) => {
    const { dataset_id } = req.body;
    const dataset = completedDatasets.get(dataset_id);
    
    if (dataset && dataset.files.length > 0) {
        // Trigger Google Drive sync for all assembled files
        for (const file of dataset.files) {
            // Import syncFileToDrive dynamically to avoid circular dependencies
            try {
                const pilotUpload = await import('./pilotUpload.js');
                if (pilotUpload.syncFileToDrive) {
                    await pilotUpload.syncFileToDrive({
                        userId: req.user.id,
                        missionTitle: 'Mission-' + dataset.mission_id.substring(0,6),
                        uploadType: file.type === 'rgb' ? 'images' : file.type,
                        filename: file.file_name,
                        file: { buffer: file.buffer, originalname: file.file_name }
                    });
                }
            } catch (err) {
                console.error('[Drive] Dataset sync error:', err.message);
            }
        }
    }
    
    completedDatasets.delete(dataset_id);
    res.json({ success: true });
});

export default router;
