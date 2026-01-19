import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { uploadToS3, uploadLocal, deleteFromS3 } from '../services/storageService.js';
import { analyzeInspectionImage } from '../services/geminiService.js';
import { io } from '../server.js';
import { v4 as uuidv4 } from 'uuid';

const USE_S3 = process.env.USE_S3 === 'true';

export const uploadImage = async (req, res, next) => {
    try {
        const { reportId } = req.body;

        if (!req.file) {
            throw new AppError('Please upload an image', 400);
        }

        // Verify report ownership
        const reportResult = await query(
            'SELECT id FROM reports WHERE id = $1 AND user_id = $2',
            [reportId, req.user.id]
        );

        if (reportResult.rows.length === 0) {
            throw new AppError('Report not found or not authorized', 404);
        }

        // Upload to storage
        const uploadResult = USE_S3
            ? await uploadToS3(req.file, `reports/${reportId}`)
            : await uploadLocal(req.file, `reports/${reportId}`);

        // Save to database
        const result = await query(
            `INSERT INTO images (report_id, storage_url, storage_key, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [reportId, uploadResult.url, uploadResult.key, JSON.stringify({ originalName: req.file.originalname, size: req.file.size })]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'IMAGE_UPLOADED', 'image', result.rows[0].id, JSON.stringify({ reportId })]
        );

        io.emit('image:uploaded', { imageId: result.rows[0].id, reportId });

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

export const analyzeImage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { industry, sensitivity } = req.body;

        // Get image
        const imageResult = await query(
            `SELECT i.*, r.user_id, r.industry as report_industry
       FROM images i
       JOIN reports r ON i.report_id = r.id
       WHERE i.id = $1`,
            [id]
        );

        if (imageResult.rows.length === 0) {
            throw new AppError('Image not found', 404);
        }

        const image = imageResult.rows[0];

        if (image.user_id !== req.user.id) {
            throw new AppError('Not authorized', 403);
        }

        // Convert image URL to base64 for Gemini API
        // In production, you would fetch the image from S3
        const imageData = image.storage_url; // Placeholder

        // Call Gemini API
        const analysis = await analyzeInspectionImage(
            imageData,
            industry || image.report_industry,
            sensitivity || 50
        );

        // Update image with annotations
        const annotations = analysis.issues.map(issue => ({
            id: uuidv4(),
            label: issue.label,
            description: issue.description,
            severity: issue.severity,
            confidence: issue.confidence,
            x: issue.location.x,
            y: issue.location.y,
            width: issue.location.width,
            height: issue.location.height,
            source: 'ai',
            costEstimates: issue.suggestedCosts || []
        }));

        await query(
            'UPDATE images SET annotations = $1 WHERE id = $2',
            [JSON.stringify(annotations), id]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'IMAGE_ANALYZED', 'image', id, JSON.stringify({ annotationCount: annotations.length })]
        );

        io.emit('image:analyzed', { imageId: id, reportId: image.report_id });

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

        // Delete from S3 if applicable
        if (USE_S3 && result.rows[0].storage_key) {
            await deleteFromS3(result.rows[0].storage_key);
        }

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
