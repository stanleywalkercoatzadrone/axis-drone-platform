/**
 * Client Portal Controller
 * Scoped read-only views for client users.
 * All queries are filtered by client_id = req.user.id.
 * Sensitive fields (pricing, internal_notes, pilot_pay, etc.) are NEVER returned.
 */

import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeRole } from '../utils/roleUtils.js';

function assertClient(req) {
    const role = normalizeRole(req.user.role);
    if (role !== 'client' && role !== 'admin') {
        throw new AppError('Access denied', 403);
    }
}

/**
 * GET /api/client/projects
 * Returns projects belonging to this client with summary stats.
 */
export const getClientProjects = async (req, res, next) => {
    try {
        assertClient(req);
        const clientId = normalizeRole(req.user.role) === 'admin'
            ? (req.query.client_id || req.user.id)
            : req.user.id;

        const result = await query(
            `SELECT
               p.id,
               p.project_name,
               p.site_location,
               p.status,
               p.created_at,
               COUNT(DISTINCT m.id)                            AS total_missions,
               COUNT(DISTINCT CASE WHEN m.status = 'completed' THEN m.id END) AS completed_missions,
               MAX(m.flight_date)                              AS last_flight_date,
               COUNT(DISTINCT l.id)                           AS total_lbd,
               COUNT(DISTINCT CASE WHEN l.status = 'resolved' THEN l.id END) AS resolved_lbd
             FROM projects p
             LEFT JOIN missions m ON m.project_id = p.id
             LEFT JOIN lbd_table l ON l.project_id = p.id
             WHERE p.client_id = $1
             GROUP BY p.id
             ORDER BY p.created_at DESC`,
            [clientId]
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/client/missions?project_id=...
 * Returns completed (and in-progress) missions for this client's projects.
 * Strips pilot pay / internal notes.
 */
export const getClientMissions = async (req, res, next) => {
    try {
        assertClient(req);
        const clientId = normalizeRole(req.user.role) === 'admin'
            ? (req.query.client_id || req.user.id)
            : req.user.id;

        const projectFilter = req.query.project_id
            ? 'AND m.project_id = $2'
            : '';
        const params = req.query.project_id
            ? [clientId, req.query.project_id]
            : [clientId];

        const result = await query(
            `SELECT
               m.id, m.mission_name, m.site, m.flight_date,
               m.status, m.kml_url,
               p.project_name
             FROM missions m
             JOIN projects p ON p.id = m.project_id
             WHERE p.client_id = $1 ${projectFilter}
             ORDER BY m.flight_date DESC NULLS LAST`,
            params
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/client/lbd?project_id=...
 * Returns LBD issues for client's projects. Strips internal notes.
 */
export const getClientLBD = async (req, res, next) => {
    try {
        assertClient(req);
        const clientId = normalizeRole(req.user.role) === 'admin'
            ? (req.query.client_id || req.user.id)
            : req.user.id;

        const projectFilter = req.query.project_id
            ? 'AND l.project_id = $2'
            : '';
        const params = req.query.project_id
            ? [clientId, req.query.project_id]
            : [clientId];

        const result = await query(
            `SELECT
               l.id, l.block, l.row, l.issue_type, l.status,
               l.resolved_date, l.created_at,
               m.mission_name, p.project_name
             FROM lbd_table l
             JOIN projects p ON p.id = l.project_id
             LEFT JOIN missions m ON m.id = l.mission_id
             WHERE p.client_id = $1 ${projectFilter}
             ORDER BY l.created_at DESC`,
            params
        );

        // Summary stats
        const stats = {
            total: result.rows.length,
            resolved: result.rows.filter(r => r.status === 'resolved').length,
            inProgress: result.rows.filter(r => r.status === 'in_progress').length,
            identified: result.rows.filter(r => r.status === 'identified').length,
        };

        res.json({ success: true, data: result.rows, stats });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/client/deliverables?project_id=...
 * Returns deliverable URLs for this client's projects.
 */
export const getClientDeliverables = async (req, res, next) => {
    try {
        assertClient(req);
        const clientId = normalizeRole(req.user.role) === 'admin'
            ? (req.query.client_id || req.user.id)
            : req.user.id;

        const projectFilter = req.query.project_id
            ? 'AND d.project_id = $2'
            : '';
        const params = req.query.project_id
            ? [clientId, req.query.project_id]
            : [clientId];

        const result = await query(
            `SELECT
               d.id, d.project_id, d.orthomosaic_url,
               d.model_3d_url, d.report_url, d.created_at,
               p.project_name
             FROM deliverables d
             JOIN projects p ON p.id = d.project_id
             WHERE p.client_id = $1 ${projectFilter}
             ORDER BY d.created_at DESC`,
            params
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/client/activity
 * Unified activity feed — last 15 events across client's projects.
 */
export const getClientActivity = async (req, res, next) => {
    try {
        assertClient(req);
        const clientId = normalizeRole(req.user.role) === 'admin'
            ? (req.query.client_id || req.user.id)
            : req.user.id;

        const result = await query(
            `SELECT * FROM (
               SELECT 'mission' AS event_type, m.id AS event_id,
                 m.mission_name AS title, p.project_name AS subtitle, m.updated_at AS event_at
               FROM missions m JOIN projects p ON p.id = m.project_id
               WHERE p.client_id = $1 AND m.status = 'completed'

               UNION ALL

               SELECT 'lbd_resolved' AS event_type, l.id AS event_id,
                 ('Block ' || COALESCE(l.block::text,'?') || ' — ' || l.issue_type) AS title,
                 p.project_name AS subtitle, l.resolved_date AS event_at
               FROM lbd_table l JOIN projects p ON p.id = l.project_id
               WHERE p.client_id = $1 AND l.status = 'resolved' AND l.resolved_date IS NOT NULL

               UNION ALL

               SELECT 'deliverable' AS event_type, d.id AS event_id,
                 'New deliverable available' AS title, p.project_name AS subtitle, d.created_at AS event_at
               FROM deliverables d JOIN projects p ON p.id = d.project_id
               WHERE p.client_id = $1
             ) events
             WHERE event_at IS NOT NULL
             ORDER BY event_at DESC LIMIT 15`,
            [clientId]
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
};
