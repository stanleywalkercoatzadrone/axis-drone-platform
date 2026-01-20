import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { hashPassword } from '../services/tokenService.js';
import { clearCachePattern } from '../config/redis.js';

export const getUsers = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, is_drive_blocked, created_at, last_login
       FROM users
       ORDER BY created_at DESC`
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

export const createUser = async (req, res, next) => {
    try {
        const { email, password, fullName, companyName, title, role, permissions } = req.body;

        if (!email || !password || !fullName) {
            throw new AppError('Please provide email, password, and full name', 400);
        }

        const passwordHash = await hashPassword(password);

        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, company_name, title, role, permissions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, company_name, title, role, permissions, created_at`,
            [email, passwordHash, fullName, companyName || null, title || null, role || 'USER', JSON.stringify(permissions || ['CREATE_REPORT'])]
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'USER_CREATED', 'user', result.rows[0].id, JSON.stringify({ email, createdBy: req.user.email })]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

export const batchCreateUsers = async (req, res, next) => {
    try {
        const { users } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            throw new AppError('Please provide an array of users', 400);
        }

        const createdUsers = [];

        for (const user of users) {
            const { email, password, fullName, companyName, title, role } = user;

            if (!email || !password || !fullName) continue;

            const passwordHash = await hashPassword(password);

            const result = await query(
                `INSERT INTO users (email, password_hash, full_name, company_name, title, role, permissions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, full_name, company_name, title, role
         ON CONFLICT (email) DO NOTHING`,
                [email, passwordHash, fullName, companyName || null, title || null, role || 'USER', JSON.stringify(['CREATE_REPORT'])]
            );

            if (result.rows.length > 0) {
                createdUsers.push(result.rows[0]);
            }
        }

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
       VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'BATCH_USER_IMPORT', 'user', JSON.stringify({ count: createdUsers.length })]
        );

        res.status(201).json({
            success: true,
            count: createdUsers.length,
            data: createdUsers
        });
    } catch (error) {
        next(error);
    }
};

export const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fullName, companyName, title, role, permissions, driveLinked, driveFolder } = req.body;

        const result = await query(
            `UPDATE users
       SET full_name = COALESCE($1, full_name),
           company_name = COALESCE($2, company_name),
           title = COALESCE($3, title),
           role = COALESCE($4, role),
           permissions = COALESCE($5, permissions),
           drive_linked = COALESCE($6, drive_linked),
           drive_folder = COALESCE($7, drive_folder),
           is_drive_blocked = COALESCE($8, is_drive_blocked)
       WHERE id = $9
       RETURNING id, email, full_name, company_name, title, role, permissions, drive_linked, drive_folder, is_drive_blocked`,
            [fullName || null, companyName || null, title || null, role || null, permissions ? JSON.stringify(permissions) : null, driveLinked ?? null, driveFolder || null, req.body.isDriveBlocked ?? null, id]
        );

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        await clearCachePattern(`user:${id}`);

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'USER_UPDATED', 'user', id, JSON.stringify({ updatedBy: req.user.email })]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        await clearCachePattern(`user:${id}`);

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'USER_DELETED', 'user', id, JSON.stringify({ deletedBy: req.user.email })]
        );

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const resetUserPassword = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            throw new AppError('Password must be at least 6 characters', 400);
        }

        const passwordHash = await hashPassword(newPassword);

        const result = await query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email',
            [passwordHash, id]
        );

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        await clearCachePattern(`user:${id}`);

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'ADMIN_PASSWORD_RESET', 'user', id, JSON.stringify({ resetBy: req.user.email })]
        );

        res.json({
            success: true,
            message: 'User password reset successfully'
        });
    } catch (error) {
        next(error);
    }
};
