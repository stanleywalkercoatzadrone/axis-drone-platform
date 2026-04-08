import express from 'express';
import {
    getAllDeployments,
    getDeploymentById,
    createDeployment,
    updateDeployment,
    deleteDeployment,
    addDailyLog,
    updateDailyLog,
    deleteDailyLog,
    getDeploymentCost,
    uploadDeploymentFile,
    getDeploymentFiles,
    deleteDeploymentFile,
    assignPersonnel,
    unassignPersonnel,
    assignMonitoringUser,
    unassignMonitoringUser,
    notifyAssignment
} from '../controllers/deploymentController.js';
import { sendDeploymentInvoices as sendInvoicesController } from '../controllers/invoiceController.js';

import { protect, authorize, checkScopedPermission } from '../middleware/auth.js';
import { preventPilotMissionMutation } from '../middleware/missionGuard.js';
import { uploadSingle, uploadAny } from '../utils/fileUpload.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Deployment routes
router.get('/', getAllDeployments);
router.get('/:id', checkScopedPermission('missions:read'), getDeploymentById);
router.post('/', authorize('admin'), preventPilotMissionMutation, createDeployment);
router.put('/:id', preventPilotMissionMutation, checkScopedPermission('missions:update_status'), updateDeployment);
router.delete('/:id', authorize('admin'), preventPilotMissionMutation, deleteDeployment);

// Daily log routes
router.post('/:id/daily-logs', checkScopedPermission('missions:update_status'), addDailyLog);
router.put('/:id/daily-logs/:logId', checkScopedPermission('missions:update_status'), updateDailyLog);
router.delete('/:id/daily-logs/:logId', checkScopedPermission('missions:update_status'), deleteDailyLog);

// Pilot field reports (read-only — written by pilots via pilotSecure.js)
router.get('/:id/pilot-reports', checkScopedPermission('missions:read'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const { id } = req.params;
        const result = await query(
            `SELECT
                dl.id,
                dl.date,
                dl.created_at                                          AS "createdAt",
                COALESCE(dl.pilot_name, p.full_name, 'Unknown Pilot') AS "pilotName",
                p.email                                                AS "pilotEmail",
                dl.missions_flown                                      AS "missionsFlown",
                dl.blocks_completed                                    AS "blocksCompleted",
                dl.hours_worked                                        AS "hoursWorked",
                dl.issues_encountered                                  AS "issuesEncountered",
                dl.weather_conditions_reported                         AS "weatherConditionsReported",
                dl.ai_report                                           AS "aiReport",
                dl.weather_snapshot                                    AS "weatherSnapshot",
                dl.irradiance_snapshot                                 AS "irradianceSnapshot",
                dl.is_incident                                         AS "isIncident",
                dl.incident_severity                                   AS "incidentSeverity",
                dl.incident_summary                                    AS "incidentSummary"
             FROM daily_logs dl
             LEFT JOIN personnel p ON p.id = dl.technician_id
             WHERE dl.deployment_id = $1
               AND (dl.pilot_name IS NOT NULL
                    OR (dl.missions_flown IS NOT NULL AND dl.missions_flown > 0)
                    OR dl.ai_report IS NOT NULL
                    OR dl.hours_worked > 0)
             ORDER BY dl.date DESC, dl.created_at DESC`,
            [id]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('[GET pilot-reports]', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch pilot reports' });
    }
});

// DELETE /deployments/:id/pilot-reports/:reportId — admin hard-delete a daily report
router.delete('/:id/pilot-reports/:reportId', checkScopedPermission('missions:update_status'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const result = await query(
            `DELETE FROM daily_logs WHERE id = $1 AND deployment_id = $2 RETURNING id`,
            [req.params.reportId, req.params.id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Report not found or already deleted' });
        }
        res.json({ success: true, message: 'Report deleted' });
    } catch (e) {
        console.error('[DELETE pilot-report]', e.message);
        res.status(500).json({ success: false, message: 'Failed to delete report' });
    }
});

// ── Pilot Work Assignments ──────────────────────────────────────────────────
// Each assignment is a daily task assigned to a pilot for a specific work date.
// Optional KML file or asset can be linked.

// GET all assignments for a deployment (admin view)
router.get('/:id/assignments', checkScopedPermission('missions:read'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const result = await query(
            `SELECT
                pwa.id, pwa.deployment_id, pwa.personnel_id,
                pwa.file_id, pwa.asset_id,
                pwa.assignment_type, pwa.notes, pwa.assigned_at,
                pwa.completed, pwa.completed_at,
                COALESCE(pwa.work_date::text, pwa.assigned_at::date::text) AS work_date,
                COALESCE(pwa.task_description, pwa.notes) AS task_description,
                COALESCE(pwa.priority, 'normal') AS priority,
                pwa.sectors,
                p.full_name AS pilot_name, p.email AS pilot_email,
                df.name AS file_name,
                a.name AS asset_name, a.asset_type
             FROM pilot_work_assignments pwa
             JOIN personnel p ON p.id = pwa.personnel_id
             LEFT JOIN deployment_files df ON df.id = pwa.file_id
             LEFT JOIN assets a ON a.id = pwa.asset_id
             WHERE pwa.deployment_id = $1
             ORDER BY COALESCE(pwa.work_date, pwa.assigned_at::date) DESC, p.full_name`,
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('[GET assignments]', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
    }
});

// POST create assignment (admin only) — daily task with optional file/asset link
router.post('/:id/assignments', authorize('admin'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const {
            personnelId,
            workDate,          // YYYY-MM-DD — the day this task applies to
            taskDescription,   // what the pilot should do
            priority = 'normal', // 'low' | 'normal' | 'high' | 'urgent'
            sectors,           // optional: comma-separated sector labels e.g. "A1, A2"
            assignmentType = 'task',
            fileId,
            assetId,
            notes,
        } = req.body;

        if (!personnelId) {
            return res.status(400).json({ success: false, message: 'personnelId required' });
        }

        // Try inserting with new columns; fall back gracefully if migration not yet run
        let result;
        try {
            result = await query(
                `INSERT INTO pilot_work_assignments
                    (deployment_id, personnel_id, work_date, task_description, priority, sectors,
                     file_id, asset_id, assignment_type, notes, assigned_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 RETURNING *`,
                [
                    req.params.id, personnelId,
                    workDate || null, taskDescription || notes || null,
                    priority, sectors || null,
                    fileId || null, assetId || null,
                    assignmentType, notes || null,
                    req.user?.id || null,
                ]
            );
        } catch (colErr) {
            // Columns not yet migrated — fall back to legacy schema
            if (colErr.message.includes('work_date') || colErr.message.includes('task_description')) {
                result = await query(
                    `INSERT INTO pilot_work_assignments
                        (deployment_id, personnel_id, file_id, asset_id, assignment_type, notes, assigned_by)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     ON CONFLICT DO NOTHING
                     RETURNING *`,
                    [req.params.id, personnelId, fileId || null, assetId || null,
                     assignmentType, taskDescription || notes || null, req.user?.id || null]
                );
            } else {
                throw colErr;
            }
        }

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (e) {
        console.error('[POST assignments]', e.message);
        res.status(500).json({ success: false, message: 'Failed to create assignment' });
    }
});

// PATCH mark assignment complete/incomplete or update notes
router.patch('/:id/assignments/:assignmentId', checkScopedPermission('missions:write'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const { completed, notes } = req.body;
        const result = await query(
            `UPDATE pilot_work_assignments
             SET completed = COALESCE($1, completed),
                 completed_at = CASE WHEN $1 = true THEN NOW() WHEN $1 = false THEN NULL ELSE completed_at END,
                 notes = COALESCE($2, notes)
             WHERE id = $3 AND deployment_id = $4
             RETURNING *`,
            [completed ?? null, notes ?? null, req.params.assignmentId, req.params.id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        console.error('[PATCH assignment]', e.message);
        res.status(500).json({ success: false, message: 'Failed to update assignment' });
    }
});

// DELETE remove assignment (admin only)
router.delete('/:id/assignments/:assignmentId', authorize('admin'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        await query(
            `DELETE FROM pilot_work_assignments WHERE id = $1 AND deployment_id = $2`,
            [req.params.assignmentId, req.params.id]
        );
        res.json({ success: true });
    } catch (e) {
        console.error('[DELETE assignment]', e.message);
        res.status(500).json({ success: false, message: 'Failed to delete assignment' });
    }
});

router.get('/:id/cost', getDeploymentCost);

// Invoicing
router.post('/:id/invoices/send', authorize('ADMIN'), sendInvoicesController);


// File routes
router.post('/:id/files', uploadAny, uploadDeploymentFile);
router.get('/:id/files', getDeploymentFiles);
router.delete('/:id/files/:fileId', deleteDeploymentFile);

// Personnel Assignment routes (admin-only, mission mutation)
router.post('/:id/personnel', authorize('admin'), preventPilotMissionMutation, assignPersonnel);
router.delete('/:id/personnel/:personnelId', authorize('admin'), preventPilotMissionMutation, unassignPersonnel);

// Monitoring Team Assignment routes (admin-only, mission mutation)
router.post('/:id/monitoring', authorize('admin'), preventPilotMissionMutation, assignMonitoringUser);
router.delete('/:id/monitoring/:userId', authorize('admin'), preventPilotMissionMutation, unassignMonitoringUser);
router.post('/:id/notify-assignment', authorize('admin'), preventPilotMissionMutation, notifyAssignment);

export default router;
