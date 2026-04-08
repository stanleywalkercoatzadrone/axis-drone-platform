import { query, transaction } from '../config/database.js';
import { hashPassword } from '../services/tokenService.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';

/**
 * POST /api/tenants/register
 * Public — creates a new organisation + first admin user in one transaction.
 */
export const registerTenant = async (req, res, next) => {
    try {
        const { orgName, slug, ownerEmail, ownerName, password, plan = 'starter' } = req.body;

        // ── Validation ──────────────────────────────────────────────────────
        if (!orgName || !slug || !ownerEmail || !ownerName || !password) {
            return next(new AppError('orgName, slug, ownerEmail, ownerName, and password are all required.', 400));
        }

        // Slug: lowercase alphanumeric + hyphens only
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (cleanSlug.length < 3) {
            return next(new AppError('Slug must be at least 3 characters (letters, numbers, hyphens).', 400));
        }

        if (password.length < 8) {
            return next(new AppError('Password must be at least 8 characters.', 400));
        }

        const VALID_PLANS = ['free', 'starter', 'pro', 'enterprise'];
        const finalPlan = VALID_PLANS.includes(plan) ? plan : 'starter';

        const PLAN_LIMITS = {
            free:       { max_pilots: 1,  max_missions: 5,   ai_reports: false, white_label: false },
            starter:    { max_pilots: 3,  max_missions: 10,  ai_reports: false, white_label: false },
            pro:        { max_pilots: 15, max_missions: -1,  ai_reports: true,  white_label: false },
            enterprise: { max_pilots: -1, max_missions: -1,  ai_reports: true,  white_label: true  },
        };

        let tenantId, userId;

        await transaction(async (client) => {
            // 1. Create tenant
            const tenantRes = await client.query(
                `INSERT INTO tenants (name, slug, plan, owner_email, plan_limits)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [orgName, cleanSlug, finalPlan, ownerEmail, JSON.stringify(PLAN_LIMITS[finalPlan])]
            );
            tenantId = tenantRes.rows[0].id;

            // 2. Create first admin user for this tenant
            const pwdHash = await hashPassword(password);
            const userRes = await client.query(
                `INSERT INTO users (email, password_hash, full_name, role, tenant_id, company_name, permissions)
                 VALUES ($1, $2, $3, 'admin', $4, $5, $6)
                 RETURNING id`,
                [
                    ownerEmail,
                    pwdHash,
                    ownerName,
                    cleanSlug,          // tenant_id stored as slug string (matches existing pattern)
                    orgName,
                    JSON.stringify(['admin:all'])
                ]
            );
            userId = userRes.rows[0].id;
        });

        res.status(201).json({
            success: true,
            message: `Organisation "${orgName}" created. You can now sign in.`,
            data: {
                tenantSlug: cleanSlug,
                plan: finalPlan,
            }
        });
    } catch (error) {
        // Unique constraint → slug or email already taken
        if (error.code === '23505') {
            if (error.constraint?.includes('slug')) {
                return next(new AppError('That organisation slug is already taken. Choose another.', 409));
            }
            return next(new AppError('An account with that email already exists.', 409));
        }
        next(error);
    }
};

/**
 * GET /api/tenants/me
 * Authenticated — returns the current user's tenant info.
 */
export const getMyTenant = async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const result = await query(
            `SELECT id, name, slug, plan, status, owner_email, plan_limits, created_at
             FROM tenants
             WHERE slug = $1 OR id::text = $1`,
            [tenantId]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    slug: tenantId,
                    name: req.user.companyName || tenantId,
                    plan: 'enterprise',
                    status: 'active',
                }
            });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/tenants/me/users
 * Authenticated admin — list all users in this tenant.
 */
export const getTenantUsers = async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const result = await query(
            `SELECT id, email, full_name, role, created_at, company_name
             FROM users
             WHERE tenant_id = $1
             ORDER BY created_at ASC`,
            [tenantId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/tenants/me/invite
 * Authenticated admin — invite a new user into the same tenant.
 */
export const inviteUserToTenant = async (req, res, next) => {
    try {
        const { email, fullName, role = 'admin' } = req.body;
        const tenantId = req.user.tenantId;

        if (!email || !fullName) {
            return next(new AppError('email and fullName are required.', 400));
        }

        const ALLOWED_ROLES = ['admin', 'pilot_technician', 'client_user'];
        if (!ALLOWED_ROLES.includes(role)) {
            return next(new AppError(`Role must be one of: ${ALLOWED_ROLES.join(', ')}`, 400));
        }

        // Check not already in this tenant
        const existing = await query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [email, tenantId]
        );
        if (existing.rows.length > 0) {
            return next(new AppError('A user with that email already exists in your organisation.', 409));
        }

        // Generate invitation token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Random placeholder password (user will set via invite link)
        const randomPwd = crypto.randomBytes(16).toString('hex');
        const pwdHash = await hashPassword(randomPwd);

        await query(
            `INSERT INTO users (email, password_hash, full_name, role, tenant_id, invitation_token_hash, invitation_expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [email, pwdHash, fullName, role, tenantId, tokenHash, expiresAt]
        );

        // Send invitation email
        const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/set-password/${rawToken}`;
        try {
            const { sendUserInvitationEmail } = await import('../services/emailService.js');
            await sendUserInvitationEmail({ to: email, fullName, invitationUrl: inviteUrl, role });
        } catch (emailErr) {
            console.error('[tenantController] Failed to send invite email:', emailErr.message);
            // Non-fatal — admin can resend manually
        }

        res.status(201).json({
            success: true,
            message: `Invitation sent to ${email}.`,
            data: { email, role, inviteUrl }
        });
    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('A user with that email already exists.', 409));
        }
        next(error);
    }
};
