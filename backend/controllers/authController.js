import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateToken, generateRefreshToken, hashPassword, comparePassword } from '../services/tokenService.js';
import { setCache, deleteCache } from '../config/redis.js';

export const register = async (req, res, next) => {
    try {
        const { email, password, fullName, companyName, title } = req.body;

        // Validation
        if (!email || !password || !fullName) {
            throw new AppError('Please provide email, password, and full name', 400);
        }

        // Check if user exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            throw new AppError('User already exists with this email', 400);
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, company_name, title, role, permissions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, company_name, title, role, permissions, created_at`,
            [email, passwordHash, fullName, companyName || null, title || null, 'USER', JSON.stringify(['CREATE_REPORT', 'EDIT_REPORT'])]
        );

        const user = result.rows[0];

        // Generate tokens
        const token = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // Map to camelCase for frontend
        const safeUser = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            title: user.title,
            role: user.role,
            permissions: user.permissions,
            profilePictureUrl: user.profile_picture_url,
            driveLinked: user.drive_linked,
            driveFolder: user.drive_folder,
            createdAt: user.created_at
        };

        // Cache user data
        await setCache(`user:${user.id}`, safeUser, 3600);

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [user.id, 'USER_REGISTERED', 'user', user.id, JSON.stringify({ email })]
        );

        res.status(201).json({
            success: true,
            data: {
                user: safeUser,
                token,
                refreshToken
            }
        });
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            throw new AppError('Please provide email and password', 400);
        }

        // Get user
        const result = await query(
            `SELECT id, email, password_hash, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, drive_folder
       FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            throw new AppError('Invalid credentials', 401);
        }

        const user = result.rows[0];

        // Check password
        const isPasswordValid = await comparePassword(password, user.password_hash);
        if (!isPasswordValid) {
            throw new AppError('Invalid credentials', 401);
        }

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Remove password from response
        delete user.password_hash;

        // Generate tokens
        const token = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // Map to camelCase for frontend
        const safeUser = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            title: user.title,
            role: user.role,
            permissions: user.permissions,
            profilePictureUrl: user.profile_picture_url,
            driveLinked: user.drive_linked,
            driveFolder: user.drive_folder,
            createdAt: user.created_at,
            lastLogin: user.last_login
        };

        // Cache user data (using the transformed object)
        await setCache(`user:${user.id}`, safeUser, 3600);

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.id, 'USER_LOGIN', 'user', JSON.stringify({ email }), req.ip, req.get('user-agent')]
        );

        res.json({
            success: true,
            data: {
                user: safeUser,
                token,
                refreshToken
            }
        });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (token) {
            // Blacklist the token
            await setCache(`blacklist:${token}`, true, 7 * 24 * 60 * 60); // 7 days
        }

        // Clear user cache
        await deleteCache(`user:${req.user.id}`);

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type)
       VALUES ($1, $2, $3)`,
            [req.user.id, 'USER_LOGOUT', 'user']
        );

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, drive_folder, created_at, last_login
       FROM users WHERE id = $1`,
            [req.user.id]
        );

        const user = result.rows[0];
        const safeUser = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            title: user.title,
            role: user.role,
            permissions: user.permissions,
            profilePictureUrl: user.profile_picture_url,
            driveLinked: user.drive_linked,
            driveFolder: user.drive_folder,
            createdAt: user.created_at,
            lastLogin: user.last_login
        };

        res.json({
            success: true,
            data: safeUser
        });
    } catch (error) {
        next(error);
    }
};

export const updateMe = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fullName, companyName, title, driveFolder } = req.body;

        const result = await query(
            `UPDATE users
       SET full_name = COALESCE($1, full_name),
           company_name = COALESCE($2, company_name),
           title = COALESCE($3, title),
           drive_folder = COALESCE($4, drive_folder),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, email, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, drive_folder, created_at, last_login`,
            [fullName || null, companyName || null, title || null, driveFolder || null, userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        const user = result.rows[0];

        // Cache user data
        await setCache(`user:${userId}`, user, 3600);

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [userId, 'USER_PROFILE_UPDATE', 'user', userId, JSON.stringify({ email: user.email })]
        );

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

export const refreshAccessToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new AppError('Refresh token required', 400);
        }

        const decoded = verifyToken(refreshToken);

        if (decoded.type !== 'refresh') {
            throw new AppError('Invalid refresh token', 401);
        }

        // Generate new access token
        const newToken = generateToken(decoded.id);

        res.json({
            success: true,
            data: {
                token: newToken
            }
        });
    } catch (error) {
        next(error);
    }
};

export const updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            throw new AppError('Please provide current and new password', 400);
        }

        // Get user password hash
        const userResult = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        const user = userResult.rows[0];

        // Verify current password
        const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
        if (!isPasswordValid) {
            throw new AppError('Invalid current password', 401);
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password
        await query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [newPasswordHash, userId]
        );

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4)`,
            [userId, 'USER_PASSWORD_UPDATE', 'user', userId]
        );

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        next(error);
    }
};
