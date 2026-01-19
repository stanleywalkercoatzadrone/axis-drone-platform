import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthUrl, getTokensFromCode, getUserInfo } from '../services/googleDriveService.js';
import { generateToken, generateRefreshToken } from '../services/tokenService.js';
import { setCache } from '../config/redis.js';

export const getGoogleAuthUrl = async (req, res, next) => {
    try {
        const authUrl = getAuthUrl();
        res.json({
            success: true,
            data: { authUrl }
        });
    } catch (error) {
        next(error);
    }
};

export const googleCallback = async (req, res, next) => {
    try {
        const { code } = req.query;

        if (!code) {
            throw new AppError('Authorization code is required', 400);
        }

        // Get tokens from Google
        const tokens = await getTokensFromCode(code);
        const { access_token, refresh_token } = tokens;

        // Get user info from Google
        const googleUser = await getUserInfo(access_token);

        // Check if user exists
        let result = await query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2',
            [googleUser.id, googleUser.email]
        );

        let user;

        if (result.rows.length > 0) {
            // Update existing user with Google credentials
            user = await query(
                `UPDATE users
         SET google_id = $1,
             profile_picture_url = $2,
             drive_linked = true,
             drive_access_token = $3,
             drive_refresh_token = $4
         WHERE id = $5
         RETURNING id, email, full_name, company_name, role, permissions, profile_picture_url, drive_linked`,
                [googleUser.id, googleUser.picture, access_token, refresh_token, result.rows[0].id]
            );
            user = user.rows[0];
        } else {
            // Create new user from Google account
            user = await query(
                `INSERT INTO users (
          email, full_name, google_id, profile_picture_url,
          drive_linked, drive_access_token, drive_refresh_token, role, permissions
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email, full_name, company_name, role, permissions, profile_picture_url, drive_linked`,
                [
                    googleUser.email,
                    googleUser.name,
                    googleUser.id,
                    googleUser.picture,
                    true,
                    access_token,
                    refresh_token,
                    'USER',
                    JSON.stringify(['CREATE_REPORT', 'EDIT_REPORT'])
                ]
            );
            user = user.rows[0];
        }

        // Generate JWT tokens
        const token = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // Cache user data
        await setCache(`user:${user.id}`, user, 3600);

        // Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
       VALUES ($1, $2, $3, $4)`,
            [user.id, 'GOOGLE_AUTH', 'user', JSON.stringify({ email: user.email })]
        );

        // Redirect to frontend with tokens
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}?token=${token}&refreshToken=${refreshToken}`);
    } catch (error) {
        next(error);
    }
};

export const linkGoogleDrive = async (req, res, next) => {
    try {
        const { code } = req.body;

        if (!code) {
            throw new AppError('Authorization code is required', 400);
        }

        if (req.user.is_drive_blocked) {
            throw new AppError('Your organization has disabled Google Drive integration for this account.', 403);
        }

        // Get tokens from Google
        const tokens = await getTokensFromCode(code);
        const { access_token, refresh_token } = tokens;

        // Get user info to verify
        const googleUser = await getUserInfo(access_token);

        // Update user with Drive credentials
        const result = await query(
            `UPDATE users
       SET google_id = $1,
           profile_picture_url = $2,
           drive_linked = true,
           drive_access_token = $3,
           drive_refresh_token = $4
       WHERE id = $5
       RETURNING id, email, full_name, company_name, role, permissions, profile_picture_url, drive_linked, drive_folder`,
            [googleUser.id, googleUser.picture, access_token, refresh_token, req.user.id]
        );

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

        const user = result.rows[0];

        // Clear cache
        await setCache(`user:${user.id}`, user, 3600);

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
       VALUES ($1, $2, $3, $4)`,
            [user.id, 'DRIVE_LINKED', 'user', JSON.stringify({ googleEmail: googleUser.email })]
        );

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

export const unlinkGoogleDrive = async (req, res, next) => {
    try {
        const result = await query(
            `UPDATE users
       SET drive_linked = false,
           drive_access_token = NULL,
           drive_refresh_token = NULL
       WHERE id = $1
       RETURNING id, email, full_name, company_name, role, permissions, profile_picture_url, drive_linked`,
            [req.user.id]
        );

        const user = result.rows[0];
        await setCache(`user:${user.id}`, user, 3600);

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type)
       VALUES ($1, $2, $3)`,
            [user.id, 'DRIVE_UNLINKED', 'user']
        );

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};
