import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { io } from '../app.js';

export const syncToVault = async (req, res, next) => {
    try {
        const { reportId } = req.body;

        // Verify report ownership
        const result = await query(
            `SELECT r.*
       FROM reports r
       WHERE r.id = $1 AND r.user_id = $2`,
            [reportId, req.user.id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Report not found or not authorized', 404);
        }

        const report = result.rows[0];

        const syncLogs = [];

        try {
            // 1. Sync to Supabase Storage (User Vault)
            const userFolderName = 'SkyLens_Reports'; // Normalized folder

            // Create report JSON file
            const reportData = JSON.stringify({
                title: report.title,
                client: report.client,
                industry: report.industry,
                summary: report.summary,
                config: report.config,
                branding: report.branding,
                createdAt: report.created_at,
                finalizedAt: report.finalized_at
            }, null, 2);

            const reportFile = {
                buffer: Buffer.from(reportData),
                mimetype: 'application/json'
            };

            const fileName = `reports/${req.user.id}/${report.title}_${new Date().toISOString().split('T')[0]}.json`;

            // Import dynamically
            const { uploadToSupabase } = await import('../services/supabaseService.js');

            const userUpload = await uploadToSupabase(
                reportFile,
                fileName,
                { bucketName: 'documents', upsert: true } // Upsert for reports
            );

            syncLogs.push({
                reportId,
                userId: req.user.id,
                destination: 'Supabase Vault',
                path: userUpload.path,
                status: 'SUCCESS',
                metadata: JSON.stringify({ publicUrl: userUpload.publicUrl })
            });

            // Emit progress
            io.to(`user:${req.user.id}`).emit('sync:progress', {
                reportId,
                destination: 'User Vault',
                status: 'SUCCESS',
                link: userUpload.publicUrl
            });

        } catch (error) {
            console.error('Vault sync error:', error);
            syncLogs.push({
                reportId,
                userId: req.user.id,
                destination: 'Supabase Vault',
                path: `reports/${req.user.id}`,
                status: 'FAILED',
                error_message: error.message
            });
        }

    } catch (error) {
        next(error);
    }
};

export const getSyncLogs = async (req, res, next) => {
    try {
        const { reportId } = req.params;

        const result = await query(
            `SELECT * FROM sync_logs
       WHERE report_id = $1
       ORDER BY timestamp DESC`,
            [reportId]
        );

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};
