/**
 * Mission Controller
 * Role-Based Mission Management for Axis Platform
 *
 * PERMISSION MATRIX:
 *  createMission     → admin only
 *  assignPilot       → admin only
 *  getAllMissions     → admin only
 *  getAssignedMissions → admin + pilot
 *  getCompletedMissions → admin + pilot + client
 *  getMissionKML     → admin + pilot
 */

import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeRole } from '../utils/roleUtils.js';

// -- helpers ------------------------------------------------------------------

const SENSITIVE_FIELDS = ['pricing', 'internal_notes', 'pilot_pay', 'contract_value', 'internal_qa'];

function stripSensitive(mission, userRole) {
    if (normalizeRole(userRole) === 'admin') return mission;
    const safe = { ...mission };
    SENSITIVE_FIELDS.forEach(f => delete safe[f]);
    return safe;
}

// -- handlers -----------------------------------------------------------------

/**
 * POST /api/missions/create — admin only
 */
export const createMission = async (req, res, next) => {
    try {
        const {
            project_id,
            mission_name,
            site,
            kml_url,
            flight_date,
            assigned_pilot_id,
        } = req.body;

        if (!mission_name || !site) {
            throw new AppError('mission_name and site are required', 400);
        }

        const result = await query(
            `INSERT INTO missions
               (project_id, mission_name, site, kml_url, flight_date, assigned_pilot_id, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW())
             RETURNING *`,
            [project_id || null, mission_name, site, kml_url || null, flight_date || null, assigned_pilot_id || null]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/missions/assign — admin only
 */
export const assignPilot = async (req, res, next) => {
    try {
        const { mission_id, pilot_id } = req.body;
        if (!mission_id || !pilot_id) {
            throw new AppError('mission_id and pilot_id are required', 400);
        }

        const result = await query(
            `UPDATE missions SET assigned_pilot_id = $1 WHERE id = $2 RETURNING *`,
            [pilot_id, mission_id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Mission not found', 404);
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/missions — admin only — all missions with full details
 */
export const getAllMissions = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT m.*,
                    p.project_name, p.client_id, p.site_location,
                    u.full_name AS pilot_name
             FROM missions m
             LEFT JOIN projects p  ON p.id = m.project_id
             LEFT JOIN users    u  ON u.id = m.assigned_pilot_id
             ORDER BY m.created_at DESC`
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/pilot/missions — admin + pilot — missions assigned to this pilot
 */
export const getAssignedMissions = async (req, res, next) => {
    try {
        const isAdmin = normalizeRole(req.user.role) === 'admin';
        let result;

        if (isAdmin) {
            result = await query(
                `SELECT m.*, p.project_name, u.full_name AS pilot_name
                 FROM missions m
                 LEFT JOIN projects p ON p.id = m.project_id
                 LEFT JOIN users    u ON u.id = m.assigned_pilot_id
                 ORDER BY m.flight_date DESC NULLS LAST`
            );
        } else {
            result = await query(
                `SELECT m.*, p.project_name
                 FROM missions m
                 LEFT JOIN projects p ON p.id = m.project_id
                 WHERE m.assigned_pilot_id = $1
                 ORDER BY m.flight_date DESC NULLS LAST`,
                [req.user.id]
            );
        }

        const data = result.rows.map(r => stripSensitive(r, req.user.role));
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/missions/completed — admin + pilot + client
 */
export const getCompletedMissions = async (req, res, next) => {
    try {
        const role = normalizeRole(req.user.role);
        let result;

        if (role === 'admin') {
            result = await query(
                `SELECT m.*, p.project_name, p.client_id
                 FROM missions m
                 LEFT JOIN projects p ON p.id = m.project_id
                 WHERE m.status = 'completed'
                 ORDER BY m.flight_date DESC`
            );
        } else if (role === 'pilot_technician') {
            result = await query(
                `SELECT m.*, p.project_name
                 FROM missions m
                 LEFT JOIN projects p ON p.id = m.project_id
                 WHERE m.status = 'completed' AND m.assigned_pilot_id = $1
                 ORDER BY m.flight_date DESC`,
                [req.user.id]
            );
        } else {
            // client — only see completed missions for their projects
            result = await query(
                `SELECT m.id, m.mission_name, m.site, m.flight_date, m.status, p.project_name
                 FROM missions m
                 JOIN projects p ON p.id = m.project_id
                 WHERE m.status = 'completed' AND p.client_id = $1
                 ORDER BY m.flight_date DESC`,
                [req.user.id]
            );
        }

        const data = result.rows.map(r => stripSensitive(r, req.user.role));
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/pilot/kml/:missionId — admin + pilot
 */
export const getMissionKML = async (req, res, next) => {
    try {
        const { missionId } = req.params;
        const role = normalizeRole(req.user.role);

        let result;
        if (role === 'admin') {
            result = await query(
                `SELECT id, mission_name, kml_url FROM missions WHERE id = $1`,
                [missionId]
            );
        } else {
            // pilot — only their own assigned missions
            result = await query(
                `SELECT id, mission_name, kml_url
                 FROM missions
                 WHERE id = $1 AND assigned_pilot_id = $2`,
                [missionId, req.user.id]
            );
        }

        if (result.rows.length === 0) {
            throw new AppError('Mission not found or access denied', 404);
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        next(err);
    }
};
