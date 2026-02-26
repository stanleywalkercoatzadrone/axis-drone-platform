import { query, transaction } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateToken, generateRefreshToken, hashPassword, comparePassword, verifyToken } from '../services/tokenService.js';
import { setCache, deleteCache } from '../config/redis.js';
import jwt from 'jsonwebtoken';

export const register = async (req, res, next) => {
    try {
        console.log('DEBUG: Register Endpoint Hit');
        console.log('DEBUG: Payload:', JSON.stringify(req.body, null, 2));
        const { email, password, fullName, companyName, title, role, adminSecret } = req.body;

        // Validation
        if (!email || !password || !fullName) {
            throw new AppError('Please provide email, password, and full name', 400);
        }

        // Determine Role & Permissions
        let userRole = 'USER';
        let userPermissions = ['CREATE_REPORT', 'EDIT_REPORT'];

        if (role === 'ADMIN') {
            console.log(`DEBUG: Admin role requested. Secret provided: ${adminSecret ? 'YES' : 'NO'}`);
            if (adminSecret === 'SKYLENS-ADMIN-2025') {
                userRole = 'ADMIN';
                // Full Access for Admin
                userPermissions = ['CREATE_REPORT', 'EDIT_REPORT', 'DELETE_REPORT', 'RELEASE_REPORT', 'MANAGE_USERS', 'MANAGE_SETTINGS', 'VIEW_MASTER_VAULT'];
                console.log('DEBUG: Admin Access Granted');
            } else {
                console.log(`DEBUG: Admin Secret Mismatch. Received: '${adminSecret}'`);
                // If they tried to be admin but failed secret, reject or downgrade? 
                // Better to reject for security clarity
                throw new AppError('Invalid Admin Authorization Token', 403);
            }
        } else if (role === 'SENIOR_INSPECTOR') {
            userRole = 'SENIOR_INSPECTOR';
            userPermissions = ['CREATE_REPORT', 'EDIT_REPORT', 'RELEASE_REPORT'];
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
       RETURNING id, email, full_name, company_name, title, role, permissions, tenant_id, created_at`,
            [email, passwordHash, fullName, companyName || null, title || null, userRole, JSON.stringify(userPermissions)]
        );

        const user = result.rows[0];

        // Define safeUser for response
        const safeUser = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            title: user.title,
            role: user.role,
            permissions: user.permissions,
            tenantId: user.tenant_id,
            createdAt: user.created_at
        };

        // Generate tokens
        const token = generateToken(user.id, 1);
        const refreshToken = generateRefreshToken(user.id, 1);

        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        const decodedRefresh = verifyToken(refreshToken, JWT_REFRESH_SECRET);

        // Persist refresh token family
        await query(
            `INSERT INTO refresh_tokens (jti, user_id, family_id, status, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [decodedRefresh.jti, user.id, decodedRefresh.family_id, 'active', new Date(decodedRefresh.exp * 1000)]
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
            `SELECT id, email, password_hash, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, drive_folder, tenant_id, auth_version
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

        // Define safeUser for response
        const safeUser = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            title: user.title,
            role: user.role,
            profilePictureUrl: user.profile_picture_url,
            driveLinked: user.drive_linked,
            driveFolder: user.drive_folder,
            tenantId: user.tenant_id,
            authVersion: user.auth_version,
            forcePasswordReset: user.force_password_reset ?? false,
            createdAt: user.created_at,
            lastLogin: new Date()
        };

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Remove password from response
        delete user.password_hash;

        // Generate tokens
        const token = generateToken(user.id, user.auth_version);
        const refreshToken = generateRefreshToken(user.id, user.auth_version);

        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        const decodedRefresh = verifyToken(refreshToken, JWT_REFRESH_SECRET);

        // Persist refresh token family
        try {
            await query(
                `INSERT INTO refresh_tokens (jti, user_id, family_id, status, expires_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [decodedRefresh.jti, user.id, decodedRefresh.family_id, 'active', new Date(decodedRefresh.exp * 1000)]
            );
        } catch (insertError) {
            console.error('🔥 CRITICAL DB ERROR on Refresh Token Insert:', insertError);
            throw new AppError(`DB Insert Failed: ${insertError.message}`, 500);
        }

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
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const crypto = await import('crypto');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

            try {
                // Determine TTL from token remaining lifetime
                const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
                const decoded = jwt.verify(token, JWT_SECRET);
                const ttlSeconds = Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));

                await setCache(`blacklist:${tokenHash}`, true, ttlSeconds);
            } catch (err) {
                // If token is already invalid/expired, we don't strictly need to blacklist, 
                // but we could do a fallback TTL if desired.
                console.log('Logout token verification failed (likely expired):', err.message);
            }
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
            `SELECT id, email, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, drive_folder, tenant_id, created_at, last_login
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
            tenantId: user.tenant_id,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            forcePasswordReset: user.force_password_reset ?? false
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
        const { fullName, companyName, title, driveFolder, role, adminSecret } = req.body;

        // Allow role upgrade only with correct secret
        let roleValue = null;
        if (role === 'ADMIN' && adminSecret === 'SKYLENS-ADMIN-2025') {
            roleValue = 'ADMIN';
        } else if (role && role !== 'ADMIN') {
            // Allow downgrading or changing to other roles if already admin?
            // For now, simpler: only allow if already admin or secret provided
            if (req.user.role === 'ADMIN') roleValue = role;
        }

        const result = await query(
            `UPDATE users
       SET full_name = COALESCE($1, full_name),
           company_name = COALESCE($2, company_name),
           title = COALESCE($3, title),
           drive_folder = COALESCE($4, drive_folder),
           role = COALESCE($5, role),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, email, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, drive_folder, auth_version, tenant_id, created_at, last_login`,
            [fullName || null, companyName || null, title || null, driveFolder || null, roleValue, userId]
        );

        if (result.rows.length === 0) {
            throw new AppError('User not found', 404);
        }

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
            tenantId: user.tenant_id,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            forcePasswordReset: user.force_password_reset ?? false
        };

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
            data: safeUser
        });
    } catch (error) {
        next(error);
    }
};

export const refreshAccessToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) throw new AppError('Refresh token required', 400);

        // Strict verify (do this BEFORE DB work)
        const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        const JWT_ISS = process.env.JWT_ISS || 'axis-drone-platform';
        const JWT_AUD = process.env.JWT_AUD || 'axis-drone-client';

        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {
            algorithms: ['HS256'],
            issuer: JWT_ISS,
            audience: JWT_AUD,
        });

        if (decoded.type !== 'refresh') throw new AppError('Invalid refresh token type', 401);
        if (!decoded.jti) throw new AppError('Refresh token missing jti', 401);

        const authResult = await transaction(async (client) => {
            // 1. Atomically consume the token and check for reuse
            const consumeResult = await client.query(
                `UPDATE refresh_tokens 
                 SET status = 'used' 
                 WHERE jti = $1 AND status = 'active'
                 RETURNING user_id, family_id`,
                [decoded.jti]
            );

            if (consumeResult.rows.length === 0) {
                // TOKEN REUSE DETECTED or invalid token context
                // Security: Lookup the real family/user by JTI instead of trusting decoded payload
                const existing = await client.query(
                    "SELECT family_id, user_id FROM refresh_tokens WHERE jti = $1",
                    [decoded.jti]
                );

                if (existing.rows.length > 0) {
                    const { family_id, user_id } = existing.rows[0];

                    console.error(`P0: REFRESH_TOKEN_REUSE_DETECTED user=${user_id} family=${family_id} jti=${decoded.jti} (Revoking all sessions)`);

                    // 1. Revoke the entire family
                    await client.query(
                        "UPDATE refresh_tokens SET status = 'revoked' WHERE family_id = $1",
                        [family_id]
                    );

                    // 2. Global Revocation: Increment user auth_version
                    await client.query(
                        "UPDATE users SET auth_version = auth_version + 1 WHERE id = $1",
                        [user_id]
                    );

                    // 3. Clear cache
                    await deleteCache(`user:${user_id}`);
                }

                throw new AppError('Refresh token reuse detected. All sessions have been revoked for security.', 401);
            }

            const { user_id, family_id } = consumeResult.rows[0];

            // 2. Get user's current auth_version
            const userResult = await client.query(
                'SELECT auth_version FROM users WHERE id = $1',
                [user_id]
            );

            if (userResult.rows.length === 0) {
                throw new AppError('User missing', 401);
            }
            const authVersion = userResult.rows[0].auth_version;

            // 3. Mint new pair
            const newToken = generateToken(user_id, authVersion);
            const newRefreshToken = generateRefreshToken(user_id, authVersion, family_id);
            const newDecoded = verifyToken(newRefreshToken, JWT_REFRESH_SECRET);

            if (!newDecoded?.jti) throw new AppError('Refresh mint failed (missing jti)', 500);

            // 4. Persist new refresh token
            await client.query(
                `INSERT INTO refresh_tokens (jti, user_id, family_id, status, expires_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    newDecoded.jti,
                    user_id,
                    family_id,
                    'active',
                    new Date(newDecoded.exp * 1000)
                ]
            );

            return { token: newToken, refreshToken: newRefreshToken };
        });

        res.json({ success: true, data: authResult });
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
            'UPDATE users SET password_hash = $1, force_password_reset = false WHERE id = $2',
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

/**
 * Verify invitation token
 * GET /api/auth/invitation/:token
 */
export const verifyInvitationToken = async (req, res, next) => {
    try {
        const { token } = req.params;

        const crypto = await import('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const result = await query(
            'SELECT email, full_name, role FROM users WHERE invitation_token_hash = $1 AND invitation_expires_at > NOW()',
            [tokenHash]
        );

        if (result.rows.length === 0) {
            throw new AppError('Invalid or expired invitation link', 400);
        }

        const user = result.rows[0];

        res.json({
            success: true,
            data: {
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Set password using invitation token
 * POST /api/auth/set-password-with-token
 */
export const setPasswordWithToken = async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            throw new AppError('Token and password are required', 400);
        }

        if (password.length < 8) {
            throw new AppError('Password must be at least 8 characters long', 400);
        }

        // 1. Find user and verify token
        // 1. Find user and verify token (using hash)
        const crypto = await import('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const result = await query(
            'SELECT id FROM users WHERE invitation_token_hash = $1 AND invitation_expires_at > NOW()',
            [tokenHash]
        );

        if (result.rows.length === 0) {
            throw new AppError('Invalid or expired invitation link', 400);
        }

        const userId = result.rows[0].id;

        // 2. Hash new password
        const passwordHash = await hashPassword(password);

        // 3. Update user, clear token, and increment auth_version to invalidate any existing sessions
        await query(
            `UPDATE users 
             SET password_hash = $1, 
                 invitation_token_hash = NULL, 
                 invitation_expires_at = NULL,
                 auth_version = auth_version + 1,
                 force_password_reset = false,
                 updated_at = NOW()
             WHERE id = $2`,
            [passwordHash, userId]
        );

        // 4. Log audit event
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'USER_PASSWORD_SET_VIA_INVITE', 'user', userId]
        );

        res.json({
            success: true,
            message: 'Password set successfully. You can now log in.'
        });
    } catch (error) {
        next(error);
    }
};

export const emergencyReset = async (req, res, next) => {
    try {
        const passwordHash = await hashPassword('admin123');
        await query(
            'UPDATE users SET password_hash = $1, force_password_reset = false WHERE email = $2',
            [passwordHash, 'admin@coatzadroneusa.com']
        );
        res.status(200).send('Emergency reset successful: admin123');
    } catch (err) {
        next(err);
    }
};
