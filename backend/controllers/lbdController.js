/**
 * LBD Controller (Low Battery Defect / Line-By-line Defects)
 * Role-aware CRUD for the lbd_table
 *
 * PERMISSION MATRIX:
 *  getLBDForProject  → admin + pilot + client
 *  createLBDEntry    → admin + pilot
 *  updateLBDEntry    → admin + pilot
 *  getLBDAnalytics   → admin only
 */

import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeRole } from '../utils/roleUtils.js';

const SENSITIVE_NOTES_ROLES = ['admin'];

function sanitizeLBD(entry, userRole) {
    if (SENSITIVE_NOTES_ROLES.includes(normalizeRole(userRole))) return entry;
    const safe = { ...entry };
    delete safe.notes; // clients/pilots don't see internal admin notes
    return safe;
}

/**
 * GET /api/lbd/:projectId
 * Returns all LBD records for a project; clients only see their own project.
 */
export const getLBDForProject = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const role = normalizeRole(req.user.role);

        // Clients may only query their own project
        if (role === 'client') {
            const ownership = await query(
                `SELECT id FROM projects WHERE id = $1 AND client_id = $2`,
                [projectId, req.user.id]
            );
            if (ownership.rows.length === 0) {
                throw new AppError('Access denied to this project', 403);
            }
        }

        const result = await query(
            `SELECT l.*, m.mission_name
             FROM lbd_table l
             LEFT JOIN missions m ON m.id = l.mission_id
             WHERE l.project_id = $1
             ORDER BY l.created_at DESC`,
            [projectId]
        );

        const data = result.rows.map(r => sanitizeLBD(r, req.user.role));
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/lbd — admin + pilot
 */
export const createLBDEntry = async (req, res, next) => {
    try {
        const { project_id, mission_id, block, row, issue_type, status, notes } = req.body;

        if (!project_id || !block || !issue_type) {
            throw new AppError('project_id, block, and issue_type are required', 400);
        }

        const identified_by = req.user.id;

        const result = await query(
            `INSERT INTO lbd_table
               (project_id, mission_id, block, row, issue_type, status, identified_by, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING *`,
            [
                project_id,
                mission_id || null,
                block,
                row || null,
                issue_type,
                status || 'identified',
                identified_by,
                notes || null,
            ]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/lbd/:id — admin + pilot
 */
export const updateLBDEntry = async (req, res, next) => {
    try {
        const { id } = req.params;
        const role = normalizeRole(req.user.role);
        const { status, notes, resolved_date, issue_type, block, row } = req.body;

        // Pilots can only update entries they identified (unless admin)
        if (role !== 'admin') {
            const ownership = await query(
                `SELECT id FROM lbd_table WHERE id = $1 AND identified_by = $2`,
                [id, req.user.id]
            );
            if (ownership.rows.length === 0) {
                throw new AppError('Access denied to this LBD entry', 403);
            }
        }

        const result = await query(
            `UPDATE lbd_table
             SET
               status       = COALESCE($1, status),
               notes        = COALESCE($2, notes),
               resolved_date = COALESCE($3, resolved_date),
               issue_type   = COALESCE($4, issue_type),
               block        = COALESCE($5, block),
               row          = COALESCE($6, row)
             WHERE id = $7
             RETURNING *`,
            [status, notes, resolved_date, issue_type, block, row, id]
        );

        if (result.rows.length === 0) {
            throw new AppError('LBD entry not found', 404);
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/lbd/analytics — admin only
 */
export const getLBDAnalytics = async (req, res, next) => {
    try {
        const [statusCounts, blockCounts, recentEntries] = await Promise.all([
            query(
                `SELECT status, COUNT(*) AS count
                 FROM lbd_table
                 GROUP BY status`
            ),
            query(
                `SELECT block, COUNT(*) AS total,
                        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved
                 FROM lbd_table
                 GROUP BY block
                 ORDER BY total DESC
                 LIMIT 20`
            ),
            query(
                `SELECT l.*, m.mission_name, p.project_name
                 FROM lbd_table l
                 LEFT JOIN missions m ON m.id = l.mission_id
                 LEFT JOIN projects p ON p.id = l.project_id
                 ORDER BY l.created_at DESC
                 LIMIT 50`
            ),
        ]);

        res.json({
            success: true,
            data: {
                statusCounts: statusCounts.rows,
                blockCounts: blockCounts.rows,
                recentEntries: recentEntries.rows,
            },
        });
    } catch (err) {
        next(err);
    }
};
