import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { hashPassword, generateInvitationToken } from '../services/tokenService.js';
import { clearCachePattern } from '../config/redis.js';
import { sendUserInvitationEmail } from '../services/emailService.js';

export const getUsers = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, email, full_name, company_name, title, role, permissions, profile_picture_url, drive_linked, is_drive_blocked, created_at, last_login
       FROM users
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
            [req.user.tenantId]
        );

        // Transform snake_case to camelCase for frontend
        const users = result.rows.map(user => ({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            title: user.title,
            role: user.role,
            permissions: user.permissions,
            avatarUrl: user.profile_picture_url,
            profilePictureUrl: user.profile_picture_url,
            driveLinked: user.drive_linked,
            isDriveBlocked: user.is_drive_blocked,
            createdAt: user.created_at,
            lastLogin: user.last_login
        }));

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

export const createUser = async (req, res, next) => {
    try {
        console.log('DEBUG: createUser payload received:', JSON.stringify(req.body, null, 2));
        const { email, password, fullName, companyName, title, role, permissions } = req.body;

        if (!email || !fullName) {
            throw new AppError('Please provide email and full name', 400);
        }

        let passwordHash = null;

        let invitationToken = null;
        let invitationTokenHash = null;
        let invitationExpires = null;

        if (password) {
            passwordHash = await hashPassword(password);
        } else {
            // Generate raw token
            const rawToken = generateInvitationToken();
            invitationToken = rawToken; // Keep raw for email

            // Hash for DB
            const crypto = await import('crypto');
            invitationTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

            invitationExpires = new Date();
            invitationExpires.setDate(invitationExpires.getDate() + 7); // 7 days
        }

        let result;
        try {
            result = await query(
                `INSERT INTO users (email, password_hash, full_name, company_name, title, role, permissions, tenant_id, invitation_token_hash, invitation_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, email, full_name, company_name, title, role, permissions, created_at, invitation_token_hash`,
                [
                    email,
                    passwordHash,
                    fullName,
                    companyName || null,
                    title || null,
                    role || 'USER',
                    JSON.stringify(permissions || ['CREATE_REPORT']),
                    req.user.tenantId,
                    req.user.tenantId,
                    invitationTokenHash,
                    invitationExpires
                ]
            );
        } catch (dbError) {
            if (dbError.code === '23505') { // Unique violation
                throw new AppError('A user with this email already exists', 400);
            }
            if (dbError.code === '23514') { // Check constraint violation (role)
                throw new AppError(`Invalid role provided: ${role}. Database constraint mismatch.`, 400);
            }
            throw dbError;
        }

        const newUser = result.rows[0];

        // Send invitation email
        // Note: Using the raw invitationToken generated above, not the hash from DB
        if (!password && invitationToken) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const invitationUrl = `${frontendUrl}/set-password/${invitationToken}`;

            sendUserInvitationEmail({
                to: newUser.email,
                fullName: newUser.full_name,
                invitationUrl: invitationUrl,
                role: newUser.role
            }).catch(emailError => {
                console.error('Failed to send invitation email:', emailError);
            });
        }

        // Optional audit log (don't fail if this errors)
        try {
            await query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
                [req.user?.id || 'system', 'USER_CREATED', 'user', newUser.id, JSON.stringify({ email, createdBy: req.user?.email || 'system' })]
            );
        } catch (auditError) {
            console.error('Audit log failed:', auditError);
        }

        // Transform to camelCase for frontend
        const safeUser = {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.full_name,
            companyName: newUser.company_name,
            title: newUser.title,
            role: newUser.role,
            permissions: newUser.permissions,
            createdAt: newUser.created_at
        };

        res.status(201).json({
            success: true,
            data: safeUser
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

            if (!email || !fullName) continue;

            let passwordHash = null;
            let invitationToken = null;
            let invitationTokenHash = null;
            let invitationExpires = null;

            if (password) {
                passwordHash = await hashPassword(password);
            } else {
                const rawToken = generateInvitationToken();
                invitationToken = rawToken; // Keep raw for email

                const crypto = await import('crypto');
                invitationTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

                invitationExpires = new Date();
                invitationExpires.setDate(invitationExpires.getDate() + 7);
            }

            const result = await query(
                `INSERT INTO users (email, password_hash, full_name, company_name, title, role, permissions, tenant_id, invitation_token_hash, invitation_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, email, full_name, company_name, title, role, invitation_token_hash
         ON CONFLICT (email) DO NOTHING`,
                [
                    email,
                    passwordHash,
                    fullName,
                    companyName || null,
                    title || null,
                    role || 'USER',
                    JSON.stringify(['CREATE_REPORT']),
                    req.user.tenantId,
                    invitationToken,
                    invitationExpires
                ]
            );

            if (result.rows.length > 0) {
                // Transform to camelCase
                const user = {
                    id: result.rows[0].id,
                    email: result.rows[0].email,
                    fullName: result.rows[0].full_name,
                    companyName: result.rows[0].company_name,
                    title: result.rows[0].title,
                    role: result.rows[0].role
                };
                createdUsers.push(user);

                // Send invitation email if token exists (use raw token from loop scope)
                if (invitationToken && !result.rows[0].password_hash) {
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                    const invitationUrl = `${frontendUrl}/set-password/${invitationToken}`;

                    sendUserInvitationEmail({
                        to: result.rows[0].email,
                        fullName: result.rows[0].full_name,
                        invitationUrl: invitationUrl,
                        role: result.rows[0].role
                    }).catch(emailError => {
                        console.error(`Failed to send batch invitation email to ${result.rows[0].email}:`, emailError);
                    });
                }
            }
        }


        // Optional audit log
        try {
            await query(
                `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
           VALUES ($1, $2, $3, $4)`,
                [req.user?.id || 'system', 'BATCH_USER_IMPORT', 'user', JSON.stringify({ count: createdUsers.length })]
            );
        } catch (auditError) {
            console.error('Audit log failed:', auditError);
        }

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
       WHERE id = $9 AND tenant_id = $10
       RETURNING id, email, full_name, company_name, title, role, permissions, drive_linked, drive_folder, is_drive_blocked`,
            [fullName || null, companyName || null, title || null, role || null, permissions ? JSON.stringify(permissions) : null, driveLinked ?? null, driveFolder || null, req.body.isDriveBlocked ?? null, id, req.user.tenantId]
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
            driveLinked: user.drive_linked,
            driveFolder: user.drive_folder,
            isDriveBlocked: user.is_drive_blocked
        };

        await clearCachePattern(`user:${id}`);

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
            [req.user.id, 'USER_UPDATED', 'user', id, JSON.stringify({ updatedBy: req.user.email })]
        );

        res.json({
            success: true,
            data: safeUser
        });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query('DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, req.user.tenantId]);

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
            'UPDATE users SET password_hash = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, email',
            [passwordHash, id, req.user.tenantId]
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
