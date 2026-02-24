import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { uploadFile, deleteFile } from '../services/storageService.js';
import { analyzeInspectionImage } from '../services/geminiService.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Lazy io getter to avoid circular import (app.js → routes → controller → app.js)
const getIo = async () => {
    try {
        const { io } = await import('../app.js');
        return io;
    } catch {
        return null;
    }
};

/**
 * Fetch an image and return it as a base64 data URI.
 * Handles both local relative paths (e.g. /uploads/file.jpg) and absolute URLs (GCS/S3/Supabase).
 */
async function fetchImageAsBase64(storageUrl) {
    // Local file: relative path like /uploads/abc.jpg
    if (!storageUrl.startsWith('http://') && !storageUrl.startsWith('https://')) {
        const localPath = path.join(process.cwd(), storageUrl);
        const buffer = await fs.readFile(localPath);
        const ext = path.extname(storageUrl).toLowerCase().replace('.', '');
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff' };
        const contentType = mimeMap[ext] || 'image/jpeg';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    // Remote URL: fetch via axios
    const response = await axios.get(storageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:${contentType};base64,${base64}`;
}

export const uploadImage = async (req, res, next) => {
    try {
        const { reportId } = req.body;
        const files = req.files || (req.file ? [req.file] : []);

        if (files.length === 0) {
            throw new AppError('Please upload at least one file', 400);
        }

        // Verify report ownership
        const reportResult = await query(
            'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
            [reportId, req.user.id]
        );

        if (reportResult.rows.length === 0) {
            throw new AppError('Report not found or not authorized', 404);
        }

        const uploadedImages = [];

        for (const file of files) {
            // Upload to storage using unified API
            const uploadResult = await uploadFile(file, `reports/${reportId}`);

            // Save to database
            const result = await query(
                `INSERT INTO images (report_id, storage_url, storage_key, metadata)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [reportId, uploadResult.url, uploadResult.key, JSON.stringify({ originalName: file.originalname, size: file.size, mimetype: file.mimetype })]
            );

            await query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.user.id, 'IMAGE_UPLOADED', 'image', result.rows[0].id, JSON.stringify({ reportId })]
            );

            uploadedImages.push(result.rows[0]);

            const io = await getIo();
            if (io) io.emit('image:uploaded', { imageId: result.rows[0].id, reportId });
        }

        res.status(201).json({
            success: true,
            data: uploadedImages,
            count: uploadedImages.length
        });
    } catch (error) {
        next(error);
    }
};

export const analyzeImage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { industry, sensitivity } = req.body;

        const imageResult = await query(
            `SELECT i.*, r.user_id, r.industry as report_industry, r.tenant_id
             FROM images i
             JOIN reports r ON i.report_id = r.id
             WHERE i.id = $1`,
            [id]
        );

        if (imageResult.rows.length === 0) {
            throw new AppError('Image not found', 404);
        }

        const image = imageResult.rows[0];

        // Allow access if user owns the report OR is in the same tenant
        if (image.user_id !== req.user.id && image.tenant_id !== req.user.tenantId) {
            throw new AppError('Not authorized', 403);
        }

        // Fetch image from storage and convert to base64 for Gemini
        let imageData;
        try {
            imageData = await fetchImageAsBase64(image.storage_url);
        } catch (fetchErr) {
            console.error('[analyzeImage] Failed to fetch image from storage:', fetchErr.message);
            throw new AppError(`Could not retrieve image for analysis: ${fetchErr.message}`, 502);
        }

        const analysis = await analyzeInspectionImage(
            imageData,
            industry || image.report_industry,
            sensitivity || 50
        );

        const annotations = (analysis.issues || []).map(issue => ({
            id: uuidv4(),
            label: issue.label,
            description: issue.description,
            severity: issue.severity,
            confidence: issue.confidence,
            x: issue.location?.x ?? 0,
            y: issue.location?.y ?? 0,
            width: issue.location?.width ?? 10,
            height: issue.location?.height ?? 10,
            type: 'box',
            source: 'ai',
            costEstimates: issue.suggestedCosts || []
        }));

        await query(
            'UPDATE images SET annotations = $1, summary = $2 WHERE id = $3',
            [JSON.stringify(annotations), analysis.summary || null, id]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'IMAGE_ANALYZED', 'image', id, JSON.stringify({ annotationCount: annotations.length })]
        );

        const io = await getIo();
        if (io) io.emit('image:analyzed', { imageId: id, reportId: image.report_id });

        res.json({
            success: true,
            data: {
                imageId: id,
                annotations,
                summary: analysis.summary,
                recommendations: analysis.recommendations
            }
        });
    } catch (error) {
        next(error);
    }
};

export const updateAnnotations = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { annotations } = req.body;

        const result = await query(
            `UPDATE images i
             SET annotations = $1
             FROM reports r
             WHERE i.id = $2 AND i.report_id = r.id AND r.user_id = $3
             RETURNING i.*`,
            [JSON.stringify(annotations), id, req.user.id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Image not found or not authorized', 404);
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

export const deleteImage = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(
            `DELETE FROM images i
             USING reports r
             WHERE i.id = $1 AND i.report_id = r.id AND r.user_id = $2
             RETURNING i.storage_key`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Image not found or not authorized', 404);
        }

        if (result.rows[0].storage_key) {
            await deleteFile(result.rows[0].storage_key);
        }

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
