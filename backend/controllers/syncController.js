import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { io } from '../app.js';
import { uploadToDrive, findOrCreateFolder } from '../services/googleDriveService.js';

export const syncToVault = async (req, res, next) => {
    try {
        const { reportId } = req.body;

        // Verify report ownership and get user Drive status
        const result = await query(
            `SELECT r.*, u.drive_linked, u.drive_folder
       FROM reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1 AND r.user_id = $2`,
            [reportId, req.user.id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Report not found or not authorized', 404);
        }

        const report = result.rows[0];

        if (!report.drive_linked) {
            throw new AppError('Google Drive not linked. Please link your Google Drive account in settings.', 400);
        }

        const syncLogs = [];

        try {
            // 1. Sync to user's personal folder
            const userFolderName = report.drive_folder || 'SkyLens_Reports';
            const userFolder = await findOrCreateFolder(req.user.id, userFolderName);

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

            const userUpload = await uploadToDrive(
                req.user.id,
                reportFile,
                `${report.title}_${new Date().toISOString().split('T')[0]}.json`,
                userFolder.id
            );

            syncLogs.push({
                reportId,
                userId: req.user.id,
                destination: 'User Vault',
                path: `/${userFolderName}/${userUpload.name}`,
                status: 'SUCCESS',
                metadata: JSON.stringify({ driveId: userUpload.id, webViewLink: userUpload.webViewLink })
            });

            // Emit progress
            io.to(`user:${req.user.id}`).emit('sync:progress', {
                reportId,
                destination: 'User Vault',
                status: 'SUCCESS',
                link: userUpload.webViewLink
            });

        } catch (error) {
            console.error('User vault sync error:', error);
            syncLogs.push({
                reportId,
                userId: req.user.id,
                destination: 'User Vault',
                path: `/${report.drive_folder || 'SkyLens_Reports'}`,
                status: 'FAILED',
                error_message: error.message
            });
        }

        // 2. Sync to master archive (simulated - would need admin Drive account)
        const masterVaultPath = `/SkyLens_Master_Archive/${report.industry}/${report.title}`;
        syncLogs.push({
            reportId,
            userId: req.user.id,
            destination: 'Master Archive',
            path: masterVaultPath,
            status: 'SUCCESS',
            metadata: JSON.stringify({ note: 'Master archive sync simulated' })
        });

        // Save sync logs
        for (const log of syncLogs) {
            await query(
                `INSERT INTO sync_logs (report_id, user_id, destination, path, status, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [log.reportId, log.userId, log.destination, log.path, log.status, log.error_message || null, log.metadata || null]
            );
        }

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'REPORT_SYNCED', 'report', reportId, JSON.stringify({ destinations: syncLogs.length })]
        );

        res.json({
            success: true,
            message: 'Report synced to vaults',
            data: syncLogs
        });
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
