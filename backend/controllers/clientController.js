import db, { transaction } from '../config/database.js';
import { hashPassword } from '../services/tokenService.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeRole } from '../utils/roleUtils.js';

// Helper to get industry ID from key if needed, or validate access
const getIndustryId = async (keyOrId) => {
    // Simple check for UUID format could happen here
    return keyOrId;
};

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
export const getClients = async (req, res, next) => {
    try {
        const { industryId } = req.query;
        let query = `
      SELECT c.*, i.name as industry_name,
      (SELECT COUNT(*) FROM sites s WHERE s.client_id = c.id) as project_count
      FROM clients c
      LEFT JOIN industries i ON c.industry_id = i.id
      WHERE 1=1
    `;
        const params = [];

        // Filter by Industry if provided
        if (industryId) {
            // support lookup by key or uuid
            if (industryId.length < 30) { // simplistic check for key vs uuid
                query += ` AND i.key = $${params.length + 1}`;
            } else {
                query += ` AND c.industry_id = $${params.length + 1}`;
            }
            params.push(industryId);
        }

        // Role-based scoping (Future: restrict client_org_admin)

        query += ` ORDER BY c.name ASC`;

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
export const getClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const query = `
      SELECT c.*, i.key as industry_key, i.name as industry_name
      FROM clients c
      LEFT JOIN industries i ON c.industry_id = i.id
      WHERE c.id = $1
    `;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return next(new AppError('Client not found', 404));
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Admin
export const createClient = async (req, res, next) => {
    try {
        const { name, industryId, industryKey, externalId, address } = req.body;

        // Resolve industry UUID
        let finalIndustryId = industryId;
        if (!finalIndustryId && industryKey) {
            const indRes = await db.query('SELECT id FROM industries WHERE key = $1', [industryKey]);
            if (indRes.rows.length > 0) finalIndustryId = indRes.rows[0].id;
        }

        if (!finalIndustryId) {
            return next(new AppError('Industry ID or Key is required', 400));
        }

        const query = `
      INSERT INTO clients (industry_id, name, external_id, address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

        const result = await db.query(query, [
            finalIndustryId,
            name,
            externalId || null,
            address || {}
        ]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get stakeholders for a client
// @route   GET /api/clients/:id/stakeholders
// @access  Private
export const getStakeholders = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT * FROM stakeholder_profiles WHERE client_id = $1 ORDER BY full_name ASC`,
            [id]
        );
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
}

// @desc    Add stakeholder to client
// @route   POST /api/clients/:id/stakeholders
// @access  Admin/Private
export const addStakeholder = async (req, res, next) => {
    try {
        const { id } = req.params; // Client ID
        const { full_name, email, title, phone, type, createUser, password } = req.body;

        let emailData = null; // Store email info to send AFTER transaction

        await transaction(async (client) => {
            let userId = null;

            // 1. Create User if requested
            if (createUser && email) {
                // Check logical conflict or existing user
                const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
                if (existing.rows.length > 0) {
                    userId = existing.rows[0].id;
                    // Link to existing user
                } else {
                    let pwdHash;
                    let invitationTokenHash = null;
                    let invitationExpiresAt = null;
                    let rawTokenForEmail = null;

                    if (req.body.sendInvite) {
                        const crypto = await import('crypto');

                        // Generate RAW token for the link
                        rawTokenForEmail = crypto.randomBytes(32).toString('hex');

                        // Generate HASH for the database
                        invitationTokenHash = crypto.createHash('sha256').update(rawTokenForEmail).digest('hex');

                        invitationExpiresAt = new Date();
                        invitationExpiresAt.setDate(invitationExpiresAt.getDate() + 7); // 7 days expiration

                        // Set a random password hash for security so account can't be accessed via password until set
                        const randomPwd = crypto.randomBytes(16).toString('hex');
                        pwdHash = await hashPassword(randomPwd);
                    } else if (password) {
                        pwdHash = await hashPassword(password);
                    } else {
                        throw new AppError('Password is required if not sending invite', 400);
                    }

                    // Default permissions for client_user
                    const permissions = ['VIEW_MASTER_VAULT'];

                    const newUser = await client.query(`
                        INSERT INTO users (email, password_hash, full_name, role, permissions, invitation_token_hash, invitation_expires_at)
                        VALUES ($1, $2, $3, 'client_user', $4, $5, $6)
                        RETURNING id
                     `, [email, pwdHash, full_name, JSON.stringify(permissions), invitationTokenHash, invitationExpiresAt]);
                    userId = newUser.rows[0].id;

                    // Queue email data for sending AFTER transaction commits
                    if (req.body.sendInvite && rawTokenForEmail) {
                        emailData = {
                            email,
                            fullName: full_name,
                            rawToken: rawTokenForEmail
                        };
                    }
                }
            }

            // 2. Insert Stakeholder Profile
            await client.query(`
                INSERT INTO stakeholder_profiles (client_id, user_id, type, full_name, email, title, phone)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [id, userId, type, full_name, email, title, phone]);
        });

        // 3. Send Email (After transaction commits)
        if (emailData) {
            const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/set-password/${emailData.rawToken}`;
            try {
                // Use dynamic import to avoid circular dependency issues if any
                const { sendUserInvitationEmail } = await import('../services/emailService.js');
                await sendUserInvitationEmail({
                    to: emailData.email,
                    fullName: emailData.fullName,
                    invitationUrl,
                    role: 'client_user'
                });
            } catch (emailErr) {
                console.error('Failed to send invitation email:', emailErr);
                // System admin should hopefully see this log.
            }
        }

        res.status(201).json({ success: true, message: 'Stakeholder added successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Admin
export const updateClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, externalId, address, industryId } = req.body;

        const result = await db.query(
            `UPDATE clients 
             SET name = $1, external_id = $2, address = $3, industry_id = $4, updated_at = NOW() 
             WHERE id = $5 
             RETURNING *`,
            [name, externalId, address || {}, industryId, id]
        );

        if (result.rows.length === 0) {
            return next(new AppError('Client not found', 404));
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Admin
export const deleteClient = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return next(new AppError('Client not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Client deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
