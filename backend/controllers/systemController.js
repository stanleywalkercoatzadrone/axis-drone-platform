import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

export const getSystemSettings = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT setting_key, setting_value, encrypted, updated_at
       FROM system_settings
       WHERE encrypted = false OR $1 = true`,
            [req.user.role === 'ADMIN']
        );

        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

export const getSystemHealth = async (req, res, next) => {
    try {
        // Simple health metrics
        const dbStatus = await query('SELECT 1');

        res.json({
            success: true,
            data: {
                node: process.env.NODE_ENV === 'production' ? 'US-EAST-1' : 'LOCAL-DEV',
                model: 'GEMINI-2.0-PRO',
                database: dbStatus.rowCount > 0 ? 'CONNECTED' : 'DISCONNECTED',
                uptime: Math.floor(process.uptime()),
                version: '1.2.1-AXIS-PAYMENT'
            }
        });
    } catch (error) {
        next(error);
    }
};

export const updateSystemSetting = async (req, res, next) => {
    try {
        const { key, value, encrypted } = req.body;

        if (!key) {
            throw new AppError('Setting key is required', 400);
        }

        const result = await query(
            `INSERT INTO system_settings (setting_key, setting_value, encrypted, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $2, updated_by = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [key, value, encrypted || false, req.user.id]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
       VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'SYSTEM_SETTING_UPDATED', 'system', JSON.stringify({ key })]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

export const linkMasterDrive = async (req, res, next) => {
    try {
        const { code } = req.body;

        if (!code) {
            throw new AppError('Authorization code is required', 400);
        }

        // Import here to avoid circular dependency
        const { getTokensFromCode, getUserInfo } = await import('../services/googleDriveService.js');

        // Get tokens from Google
        const tokens = await getTokensFromCode(code);
        const { access_token, refresh_token } = tokens;

        // Get user info
        const googleUser = await getUserInfo(access_token);

        // Store in system settings
        await query(
            `INSERT INTO system_settings (setting_key, setting_value, encrypted, updated_by)
       VALUES 
         ('master_drive_enabled', 'true', false, $1),
         ('master_drive_access_token', $2, true, $1),
         ('master_drive_refresh_token', $3, true, $1),
         ('master_drive_email', $4, false, $1)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = $1, updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, access_token, refresh_token, googleUser.email]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
       VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'MASTER_DRIVE_LINKED', 'system', JSON.stringify({ email: googleUser.email })]
        );

        res.json({
            success: true,
            message: 'Master Drive account linked successfully',
            data: { email: googleUser.email }
        });
    } catch (error) {
        next(error);
    }
};

export const unlinkMasterDrive = async (req, res, next) => {
    try {
        await query(
            `UPDATE system_settings
       SET setting_value = CASE 
         WHEN setting_key = 'master_drive_enabled' THEN 'false'
         WHEN setting_key IN ('master_drive_access_token', 'master_drive_refresh_token', 'master_drive_email', 'master_drive_folder_id') THEN NULL
         ELSE setting_value
       END,
       updated_by = $1,
       updated_at = CURRENT_TIMESTAMP
       WHERE setting_key IN ('master_drive_enabled', 'master_drive_access_token', 'master_drive_refresh_token', 'master_drive_email', 'master_drive_folder_id')`,
            [req.user.id]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type)
       VALUES ($1, $2, $3)`,
            [req.user.id, 'MASTER_DRIVE_UNLINKED', 'system']
        );

        res.json({
            success: true,
            message: 'Master Drive account unlinked'
        });
    } catch (error) {
        next(error);
    }
};
