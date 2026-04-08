import { query, transaction } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { canAccessMission } from '../services/permissionService.js';
import { isAdmin, isPilot } from '../utils/roleUtils.js';
import { uploadToS3, uploadLocal } from '../services/storageService.js';

const USE_S3 = process.env.USE_S3 === 'true';

export const getWorkItems = async (req, res, next) => {
    try {
        const { scopeType, scopeId, assignedTo, industryKey } = req.query;
        let sql = `
            SELECT w.* 
            FROM work_items w
        `;
        const params = [];

        // Join for Industry Filtering
        if (industryKey) {
            sql += `
            LEFT JOIN deployments d ON (w.scope_type = 'deployment' AND w.scope_id = d.id)
            LEFT JOIN sites s1 ON (w.scope_type = 'site' AND w.scope_id = s1.id)
            LEFT JOIN sites s2 ON (d.site_id = s2.id)
            LEFT JOIN clients c ON (COALESCE(s1.client_id, s2.client_id) = c.id)
            LEFT JOIN industries i ON (c.industry_id = i.id)
            `;
        }

        sql += ` WHERE 1=1`;

        if (industryKey) {
            params.push(industryKey);
            sql += ` AND i.key = $${params.length}`;
        }

        if (scopeType && scopeId) {
            sql += ` AND w.scope_type = $${params.length + 1} AND w.scope_id = $${params.length + 2}`;
            params.push(scopeType, scopeId);
        }

        if (assignedTo === 'me') {
            sql += ` AND w.assigned_user_id = $${params.length + 1}`;
            params.push(req.user.id);
        } else if (!isAdmin(req.user)) {
            // Non-admins can only see their assigned work items (SQL-level enforcement)
            sql += ` AND w.assigned_user_id = $${params.length + 1}`;
            params.push(req.user.id);
        }

        const result = await query(sql + ' ORDER BY w.row_number ASC', params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

export const updateWorkItemStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const itemResult = await query('SELECT * FROM work_items WHERE id = $1', [id]);
        if (itemResult.rows.length === 0) throw new AppError('Work item not found', 404);

        const item = itemResult.rows[0];

        // Authorization: Admin or Assigned User (using normalized role check)
        if (!isAdmin(req.user) && item.assigned_user_id !== req.user.id) {
            throw new AppError('Not authorized to update this work item', 403);
        }

        // SQL-level enforcement: Add WHERE clause to prevent race conditions
        const authCondition = isAdmin(req.user)
            ? ''
            : ` AND assigned_user_id = '${req.user.id}'`;

        const completedAt = status === 'done' ? 'CURRENT_TIMESTAMP' : 'NULL';
        const completedBy = status === 'done' ? req.user.id : null;

        await transaction(async (client) => {
            const updateResult = await client.query(
                `UPDATE work_items 
                 SET status = $1, 
                     updated_at = CURRENT_TIMESTAMP,
                     completed_at = ${completedAt},
                     completed_by_user_id = $2
                 WHERE id = $3${authCondition}`,
                [status, completedBy, id]
            );

            // Verify update succeeded (SQL-level permission check)
            if (updateResult.rowCount === 0) {
                throw new AppError('Not authorized to update this work item', 403);
            }

            await client.query(
                `INSERT INTO work_item_updates (work_item_id, user_id, action, payload_json)
                 VALUES ($1, $2, $3, $4)`,
                [id, req.user.id, 'STATUS_UPDATE', JSON.stringify({ status })]
            );
        });

        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        next(error);
    }
};

export const addWorkItemNote = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const itemResult = await query('SELECT * FROM work_items WHERE id = $1', [id]);
        if (itemResult.rows.length === 0) throw new AppError('Work item not found', 404);

        const item = itemResult.rows[0];

        // Authorization: Admin or Assigned User (using normalized role check)
        if (!isAdmin(req.user) && item.assigned_user_id !== req.user.id) {
            throw new AppError('Not authorized to comment on this work item', 403);
        }

        await query(
            `INSERT INTO work_item_updates (work_item_id, user_id, action, payload_json)
             VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, 'ADD_NOTE', JSON.stringify({ note })]
        );

        res.status(201).json({ success: true, message: 'Note added' });
    } catch (error) {
        next(error);
    }
};

export const getWorkItemUpdates = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query(
            `SELECT u.*, us.full_name as user_name 
             FROM work_item_updates u
             JOIN users us ON u.user_id = us.id
             WHERE u.work_item_id = $1 ORDER BY u.created_at DESC`,
            [id]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * Attach asset evidence to a work item
 * Pilots can only attach assets they own
 */
export const addWorkItemAsset = async (req, res, next) => {
    try {
        const { id } = req.params;
        let { assetId, assetType, assetUrl, description } = req.body;

        // Verify work item exists and user has access
        const itemResult = await query('SELECT * FROM work_items WHERE id = $1', [id]);
        if (itemResult.rows.length === 0) {
            throw new AppError('Work item not found', 404);
        }

        const item = itemResult.rows[0];

        // Authorization: Admin or Assigned User
        if (!isAdmin(req.user) && item.assigned_user_id !== req.user.id) {
            throw new AppError('Not authorized to attach assets to this work item', 403);
        }

        // If linking existing asset, verify ownership for pilots
        if (assetId) {
            const assetResult = await query(
                'SELECT * FROM assets WHERE id = $1',
                [assetId]
            );

            if (assetResult.rows.length === 0) {
                throw new AppError('Asset not found', 404);
            }

            const asset = assetResult.rows[0];

            // Pilots can only link assets they uploaded
            if (isPilot(req.user) && asset.created_by_user_id !== req.user.id) {
                throw new AppError('Pilots can only attach assets they uploaded', 403);
            }
        }

        // Handle file upload if present
        if (req.file) {
            const uploadResult = USE_S3
                ? await uploadToS3(req.file, `work-items/${id}`)
                : await uploadLocal(req.file, `work-items/${id}`);

            assetUrl = uploadResult.url;
            description = description || req.file.originalname;
            assetType = assetType || (req.file.mimetype.startsWith('image/') ? 'photo' : 'document');
        }

        if (!assetId && !assetUrl) {
            throw new AppError('Either an existing asset ID, an asset URL, or a file must be provided', 400);
        }

        // Create asset attachment record
        await transaction(async (client) => {
            // If creating new asset, insert it first
            let finalAssetId = assetId;
            if (!assetId && assetUrl) {
                const newAssetResult = await client.query(
                    `INSERT INTO assets (type, url, description, created_by_user_id, tenant_id)
                     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                    [assetType || 'evidence', assetUrl, description, req.user.id, req.user.tenantId]
                );
                finalAssetId = newAssetResult.rows[0].id;
            }

            // Link asset to work item via update log
            await client.query(
                `INSERT INTO work_item_updates (work_item_id, user_id, action, payload_json)
                 VALUES ($1, $2, $3, $4)`,
                [id, req.user.id, 'ATTACH_ASSET', JSON.stringify({
                    assetId: finalAssetId,
                    assetType,
                    description
                })]
            );
        });

        res.status(201).json({
            success: true,
            message: 'Asset attached successfully'
        });
    } catch (error) {
        next(error);
    }
};
