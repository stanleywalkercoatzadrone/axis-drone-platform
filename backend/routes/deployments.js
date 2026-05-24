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
import { query as _expQuery } from '../config/database.js';


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
                COALESCE(a.description, a.asset_key) AS asset_name, a.asset_type
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

// ── Mission Interest Inquiry — AI draft generation (no emails sent) ──────────
router.post('/:id/interest-inquiry/generate', authorize('admin'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const { generateMissionInquiryEmail } = await import('../services/geminiService.js');

        // Admin can pass a pay rate hint and role context from the frontend
        const { payRate = null, personnelRole = null } = req.body;

        const missionRes = await query(
            `SELECT d.id, d.title, d.date, d.location, d.notes, d.type,
                    d.days_on_site,
                    s.name AS site_name, c.name AS client_name
             FROM deployments d
             LEFT JOIN sites s ON s.id = d.site_id
             LEFT JOIN clients c ON c.id = d.client_id
             WHERE d.id = $1`,
            [req.params.id]
        );
        if (!missionRes.rows.length) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }
        const m = missionRes.rows[0];

        // Fallback: if no payRate provided, try avg rate of assigned personnel
        let resolvedPayRate = payRate;
        if (!resolvedPayRate) {
            const rateRes = await query(
                `SELECT AVG(p.daily_pay_rate)::numeric(10,2) AS avg_rate
                 FROM deployment_personnel dp
                 JOIN personnel p ON p.id = dp.personnel_id
                 WHERE dp.deployment_id = $1 AND p.daily_pay_rate > 0`,
                [req.params.id]
            );
            const avgRate = rateRes.rows[0]?.avg_rate;
            if (avgRate && parseFloat(avgRate) > 0) resolvedPayRate = parseFloat(avgRate);
        }

        const draft = await generateMissionInquiryEmail({
            title:                 m.title,
            type:                  m.type,
            industry:              null,
            siteName:              m.site_name,
            clientName:            m.client_name,
            date:                  m.date,
            location:              m.location,
            notes:                 m.notes,
            estimatedDurationDays: m.days_on_site,
            payRate:               resolvedPayRate,
            personnelRole:         personnelRole,
        });

        res.json({ success: true, subject: draft.subject, body: draft.body });
    } catch (e) {
        console.error('[POST interest-inquiry/generate]', e.message);
        res.status(500).json({ success: false, message: 'AI generation failed: ' + e.message });
    }
});

// ── Mission Interest Inquiry — send availability check email to selected pilots ──
router.post('/:id/interest-inquiry', authorize('admin'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const { sendMissionInterestEmail } = await import('../services/emailService.js');

        // aiGeneratedBody: if provided, replaces the static template body with AI-written content
        const {
            personnelIds = [],
            manualEmails = [],          // [{ name, email }] — manually typed addresses
            customMessage = '',
            aiGeneratedBody = null,
            aiGeneratedSubject = null,
            postToLinkedIn = false
        } = req.body;

        const hasDbRecipients     = Array.isArray(personnelIds) && personnelIds.length > 0;
        const hasManualRecipients = Array.isArray(manualEmails) && manualEmails.length > 0;

        if (!hasDbRecipients && !hasManualRecipients) {
            return res.status(400).json({ success: false, message: 'At least one recipient (personnelIds or manualEmails) is required' });
        }

        // Fetch the mission
        const missionRes = await query(
            `SELECT d.id, d.title, d.status, d.date, d.location, d.notes, d.type,
                    d.days_on_site,
                    s.name AS site_name, c.name AS client_name
             FROM deployments d
             LEFT JOIN sites s ON s.id = d.site_id
             LEFT JOIN clients c ON c.id = d.client_id
             WHERE d.id = $1`,
            [req.params.id]
        );
        if (!missionRes.rows.length) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }
        const m = missionRes.rows[0];
        const missionPayload = {
            title:                 m.title,
            siteName:              m.site_name,
            date:                  m.date,
            location:              m.location,
            notes:                 m.notes,
            type:                  m.type,
            industry:              null,
            estimatedDurationDays: m.days_on_site,
            // Pass AI content through so emailService can use it
            aiGeneratedBody,
            aiGeneratedSubject,
        };

        const results = [];

        // ── Send to DB personnel ──────────────────────────────────────────────
        if (hasDbRecipients) {

        const pilotsRes = await query(
            `SELECT p.id, p.full_name, p.email,
                    COALESCE(pb.daily_rate, p.daily_pay_rate, 0) AS daily_pay_rate
             FROM personnel p
             LEFT JOIN pilot_banking_info pb ON pb.pilot_id = p.id
             WHERE p.id = ANY($1::uuid[])`,
            [personnelIds]
        );

        // Token secret for HMAC signing (stateless — no DB storage needed)
        const { createHmac } = await import('crypto');
        const tokenSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'axis-interest-token-secret';
        const apiBase = process.env.API_BASE_URL || process.env.FRONTEND_URL || 'https://axisplatform.app';

        for (const pilot of pilotsRes.rows) {
            if (!pilot.email) {
                results.push({ pilotId: pilot.id, pilotName: pilot.full_name, status: 'skipped', reason: 'No email on file' });
                continue;
            }
            try {
                const token = createHmac('sha256', tokenSecret)
                    .update(`${req.params.id}:${pilot.id}`)
                    .digest('hex');
                const interestedUrl  = `${apiBase}/api/deployments/${req.params.id}/pilot-interest?pilotId=${pilot.id}&response=yes&token=${token}`;
                const unavailableUrl = `${apiBase}/api/deployments/${req.params.id}/pilot-interest?pilotId=${pilot.id}&response=no&token=${token}`;
                await sendMissionInterestEmail(
                    { name: pilot.full_name, email: pilot.email },
                    { ...missionPayload, dailyPayRate: pilot.daily_pay_rate, interestedUrl, unavailableUrl },
                    customMessage
                );
                await query(
                    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                     VALUES ($1, 'INTEREST_INQUIRY_SENT', 'deployment', $2, $3)
                     ON CONFLICT DO NOTHING`,
                    [req.user?.id, req.params.id, JSON.stringify({ pilotId: pilot.id, pilotName: pilot.full_name, aiAssisted: !!aiGeneratedBody })]
                ).catch(() => {});
                results.push({ pilotId: pilot.id, pilotName: pilot.full_name, status: 'sent' });
            } catch (emailErr) {
                console.error(`[interest-inquiry] Failed to email ${pilot.email}:`, emailErr.message);
                results.push({ pilotId: pilot.id, pilotName: pilot.full_name, status: 'failed', reason: emailErr.message });
            }
        }
        } // end hasDbRecipients

        // ── Send to manual email addresses ────────────────────────────────────
        if (hasManualRecipients) {
            for (const recipient of manualEmails) {
                if (!recipient?.email) continue;
                try {
                    await sendMissionInterestEmail(
                        { name: recipient.name || recipient.email, email: recipient.email },
                        { ...missionPayload, dailyPayRate: null, interestedUrl: null, unavailableUrl: null },
                        customMessage
                    );
                    results.push({ pilotId: recipient.email, pilotName: recipient.name || recipient.email, status: 'sent' });
                } catch (emailErr) {
                    console.error(`[interest-inquiry] Failed to email manual ${recipient.email}:`, emailErr.message);
                    results.push({ pilotId: recipient.email, pilotName: recipient.name || recipient.email, status: 'failed', reason: emailErr.message });
                }
            }
        }

        const sent = results.filter(r => r.status === 'sent').length;
        const totalRecipients = personnelIds.length + manualEmails.length;
        
        // ── 🔗 LinkedIn Blast Integration ──
        let linkedInSuccess = false;
        let linkedInError = null;
        
        if (postToLinkedIn && (aiGeneratedBody || customMessage)) {
            try {
                const { LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN } = process.env;
                if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_AUTHOR_URN) {
                    throw new Error('LinkedIn credentials not configured in environment.');
                }
                
                // Construct the post text: Subject + Body or Custom Message
                let postText = '';
                if (aiGeneratedSubject) postText += `🚀 ${aiGeneratedSubject}\n\n`;
                postText += aiGeneratedBody ? aiGeneratedBody.replace(/\[Name\]/gi, 'Network') : customMessage;
                postText += `\n\n#DroneMission #PilotOpportunity #AxisPlatform`;

                const liPayload = {
                    author: LINKEDIN_AUTHOR_URN,
                    lifecycleState: "PUBLISHED",
                    specificContent: {
                        "com.linkedin.ugc.ShareContent": {
                            shareCommentary: { text: postText },
                            shareMediaCategory: "NONE"
                        }
                    },
                    visibility: {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                };

                const liRes = await globalThis.fetch('https://api.linkedin.com/v2/ugcPosts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                        'X-Restli-Protocol-Version': '2.0.0'
                    },
                    body: JSON.stringify(liPayload)
                });

                if (!liRes.ok) {
                    const liErr = await liRes.text();
                    throw new Error(`LinkedIn API responded with ${liRes.status}: ${liErr}`);
                }
                
                linkedInSuccess = true;
                results.push({ pilotId: 'linkedin', pilotName: 'LinkedIn Feed', status: 'sent' });
            } catch (err) {
                console.error('[interest-inquiry] LinkedIn post failed:', err.message);
                linkedInError = err.message;
                results.push({ pilotId: 'linkedin', pilotName: 'LinkedIn Feed', status: 'failed', reason: err.message });
            }
        }

        // "Not Selected" notices are sent separately via POST /:id/interest-inquiry/not-selected
        // AFTER the admin has chosen crew — never auto-fired here.
        res.json({ success: true, sent, total: totalRecipients, results, linkedInSuccess, linkedInError });
    } catch (e) {
        console.error('[POST interest-inquiry]', e.message);
        res.status(500).json({ success: false, message: 'Failed to send interest inquiries' });
    }
});

// ── GET recipients who were sent an inquiry for this mission ─────────────────
// Reads audit_logs so the frontend knows exactly who received an inquiry.
// Used to gate the "Notify Not Selected" step — only those pilots see it.
router.get('/:id/interest-inquiry/recipients', authorize('admin'), async (req, res) => {
    try {
        const { query } = await import('../config/database.js');

        // Pull distinct pilots from audit_logs (most recent send per pilot first)
        const result = await query(
            `SELECT DISTINCT ON ((metadata->>'pilotId'))
                    metadata->>'pilotId'   AS "pilotId",
                    metadata->>'pilotName' AS "pilotName",
                    created_at             AS "sentAt"
             FROM audit_logs
             WHERE action        = 'INTEREST_INQUIRY_SENT'
               AND resource_type = 'deployment'
               AND resource_id   = $1
             ORDER BY (metadata->>'pilotId'), created_at DESC`,
            [req.params.id]
        );

        // Also fetch current crew (assigned personnel) so UI can flag who's already in
        const crewRes = await query(
            `SELECT dp.personnel_id::text AS "pilotId"
             FROM deployment_personnel dp
             WHERE dp.deployment_id = $1`,
            [req.params.id]
        );
        const assignedIds = new Set(crewRes.rows.map(r => r.pilotId));

        const recipients = result.rows.map(r => ({
            pilotId:   r.pilotId,
            pilotName: r.pilotName,
            sentAt:    r.sentAt,
            assigned:  assignedIds.has(r.pilotId),   // true = already on crew
        }));

        res.json({ success: true, data: recipients });
    } catch (e) {
        console.error('[GET interest-inquiry/recipients]', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch recipients' });
    }
});

// ── Manual: Send not-selected email to specific pilots (admin only) ──────────
router.post('/:id/interest-inquiry/not-selected', authorize('admin'), async (req, res) => {

    try {
        const { query } = await import('../config/database.js');
        const { sendMissionNotSelectedEmail } = await import('../services/emailService.js');
        const { personnelIds: rawIds } = req.body;
        // Filter out any non-UUID IDs (e.g. manual-xxx entries from frontend)
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const personnelIds = Array.isArray(rawIds) ? rawIds.filter(id => UUID_RE.test(id)) : [];
        if (personnelIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid personnel IDs provided' });
        }
        // Fetch mission info
        const missionRes = await query(
            `SELECT d.title, d.date, d.location, s.name AS site_name
             FROM deployments d LEFT JOIN sites s ON s.id = d.site_id
             WHERE d.id = $1`, [req.params.id]
        );
        const m = missionRes.rows[0];
        if (!m) return res.status(404).json({ success: false, message: 'Mission not found' });
        const mission = { title: m.title, siteName: m.site_name, date: m.date, location: m.location };

        const pilotsRes = await query(
            `SELECT id, full_name, email FROM personnel WHERE id = ANY($1::uuid[])`,
            [personnelIds]
        );
        const results = [];
        for (const pilot of pilotsRes.rows) {
            if (!pilot.email) { results.push({ pilotId: pilot.id, pilotName: pilot.full_name, status: 'skipped', reason: 'No email' }); continue; }
            try {
                await sendMissionNotSelectedEmail({ name: pilot.full_name, email: pilot.email }, mission);
                results.push({ pilotId: pilot.id, pilotName: pilot.full_name, status: 'sent' });
            } catch (e) {
                results.push({ pilotId: pilot.id, pilotName: pilot.full_name, status: 'failed', reason: e.message });
            }
        }
        res.json({ success: true, sent: results.filter(r => r.status === 'sent').length, results });
    } catch (e) {
        console.error('[POST not-selected]', e.message);
        res.status(500).json({ success: false, message: 'Failed to send not-selected emails' });
    }
});

// ── Pilot Interest Response — unauthenticated, pilot clicks from email link ───
router.get('/:id/pilot-interest', async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const { createHmac } = await import('crypto');
        const { sendEmail } = await import('../services/emailService.js');

        const { pilotId, response, token } = req.query;
        if (!pilotId || !response || !token) {
            return res.status(400).send('<h2>Invalid response link.</h2>');
        }

        // Verify HMAC token
        const tokenSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'axis-interest-token-secret';
        const expected = createHmac('sha256', tokenSecret)
            .update(`${req.params.id}:${pilotId}`)
            .digest('hex');
        if (token !== expected) {
            return res.status(403).send('<h2>This link is invalid or has expired.</h2>');
        }

        const isInterested = response === 'yes';

        // Fetch mission + pilot info for the notification
        const [missionRes, pilotRes] = await Promise.all([
            query(`SELECT d.title, d.location, d.date, s.name AS site_name
                   FROM deployments d LEFT JOIN sites s ON s.id = d.site_id
                   WHERE d.id = $1`, [req.params.id]),
            query(`SELECT full_name, email FROM personnel WHERE id = $1`, [pilotId]),
        ]);

        const mission = missionRes.rows[0];
        const pilot   = pilotRes.rows[0];
        if (!mission || !pilot) {
            return res.status(404).send('<h2>Mission or pilot not found.</h2>');
        }

        // Log in audit trail (non-fatal)
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
             VALUES (NULL, $1, 'deployment', $2, $3)
             ON CONFLICT DO NOTHING`,
            [
                isInterested ? 'PILOT_INTEREST_CONFIRMED' : 'PILOT_INTEREST_DECLINED',
                req.params.id,
                JSON.stringify({ pilotId, pilotName: pilot.full_name, response })
            ]
        ).catch(() => {});

        // Send admin notification email
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER;
        if (adminEmail) {
            const status  = isInterested ? '✅ Interested' : '❌ Not Available';
            const bgColor = isInterested ? '#064e3b' : '#7f1d1d';
            const label   = isInterested ? 'INTERESTED' : 'NOT AVAILABLE';
            const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:0 20px;">
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:16px 16px 0 0;padding:24px 28px;">
    <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.2em;text-transform:uppercase;">Axis Platform — Pilot Response</div>
    <div style="font-size:22px;font-weight:900;color:#38bdf8;margin-top:6px;">Interest Inquiry Update</div>
  </div>
  <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
    <div style="background:${bgColor};border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:24px;">${isInterested ? '✅' : '❌'}</span>
      <div>
        <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:${isInterested ? '#6ee7b7' : '#fca5a5'};text-transform:uppercase;letter-spacing:0.1em;">Pilot Response</p>
        <p style="margin:0;font-size:18px;font-weight:800;color:#fff;">${label}</p>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:8px 0;color:#64748b;font-weight:700;width:100px;">Pilot</td><td style="padding:8px 0;color:#0f172a;">${pilot.full_name}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:700;">Email</td><td style="padding:8px 0;color:#0f172a;">${pilot.email}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:700;">Mission</td><td style="padding:8px 0;color:#0f172a;">${mission.title}</td></tr>
      ${mission.site_name ? `<tr><td style="padding:8px 0;color:#64748b;font-weight:700;">Site</td><td style="padding:8px 0;color:#0f172a;">${mission.site_name}</td></tr>` : ''}
      ${mission.date     ? `<tr><td style="padding:8px 0;color:#64748b;font-weight:700;">Date</td><td style="padding:8px 0;color:#0f172a;">${mission.date}</td></tr>` : ''}
    </table>
    <p style="font-size:12px;color:#94a3b8;margin-top:20px;">This notification was automatically generated by Axis Platform when the pilot responded to your interest inquiry.</p>
  </div>
</div>
</body></html>`;
            await sendEmail(adminEmail, `Pilot Response: ${pilot.full_name} — ${status} — ${mission.title}`, html).catch(() => {});
        }

        // Return a clean HTML confirmation page to the pilot
        const pilotPage = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${isInterested ? 'Interest Confirmed' : 'Response Recorded'} — Axis</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px}.card{background:#1e293b;border:1px solid #334155;border-radius:20px;padding:40px 36px;max-width:420px;width:100%;text-align:center}.icon{font-size:52px;margin-bottom:16px}.title{font-size:22px;font-weight:800;color:#f8fafc;margin-bottom:8px}.sub{font-size:14px;color:#94a3b8;line-height:1.6}.mission{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:14px;margin-top:20px;text-align:left}.ml{font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px}.mv{font-size:14px;color:#e2e8f0;font-weight:600}.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-top:20px;${isInterested ? 'background:#064e3b;color:#6ee7b7;' : 'background:#7f1d1d;color:#fca5a5;'}}</style>
</head><body>
<div class="card">
  <div class="icon">${isInterested ? '✅' : '👋'}</div>
  <div class="title">${isInterested ? 'Interest Confirmed!' : 'Response Recorded'}</div>
  <p class="sub">${isInterested
    ? 'Great — our operations team has been notified and will be in touch soon with next steps.'
    : 'No problem at all. We appreciate you letting us know and will reach out for future opportunities.'
  }</p>
  <div class="mission">
    <div class="ml">Mission</div>
    <div class="mv">${mission.title}</div>
    ${mission.site_name ? `<div class="ml" style="margin-top:10px;">Site</div><div class="mv">${mission.site_name}</div>` : ''}
  </div>
  <div class="badge">${isInterested ? '✅ Interested' : '❌ Not Available'}</div>
</div>
</body></html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(pilotPage);
    } catch (e) {
        console.error('[GET pilot-interest]', e.message);
        res.status(500).send('<h2>Something went wrong. Please contact operations directly.</h2>');
    }
});

// ── Mission-scoped Expense CRUD ──────────────────────────────────────────────

/** GET  /api/deployments/:id/expenses  — list expenses for a mission */
router.get('/:id/expenses', async (req, res) => {
    try {
        const { rows } = await _expQuery(`
            SELECT id, category, description, amount, expense_date, vendor,
                   status, notes, file_name, created_at, updated_at
            FROM mission_expenses
            WHERE mission_id = $1
            ORDER BY expense_date DESC, created_at DESC
        `, [req.params.id]);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[GET /:id/expenses]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/** POST /api/deployments/:id/expenses  — add an expense to a mission */
router.post('/:id/expenses', authorize('admin'), async (req, res) => {
    try {
        const { category, description, amount, expense_date, vendor, notes } = req.body;
        // Determine status: pending if mission is open, confirmed if closed
        const missionRes = await _expQuery(`SELECT status FROM deployments WHERE id = $1`, [req.params.id]);
        const mStatus = missionRes.rows[0]?.status || '';
        const expenseStatus = (mStatus === 'Completed' || mStatus === 'Archived') ? 'confirmed' : 'pending';

        const { rows } = await _expQuery(`
            INSERT INTO mission_expenses
                (mission_id, category, description, amount, expense_date, vendor, notes, status, uploaded_by, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
            RETURNING *
        `, [
            req.params.id,
            category || 'Other',
            description || null,
            parseFloat(amount) || 0,
            expense_date || new Date().toISOString().split('T')[0],
            vendor || null,
            notes || null,
            expenseStatus,
            req.user.id
        ]);
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[POST /:id/expenses]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/** PUT  /api/deployments/:id/expenses/:expId  — edit an expense */
router.put('/:id/expenses/:expId', authorize('admin'), async (req, res) => {
    try {
        const { category, description, amount, expense_date, vendor, notes } = req.body;
        const { rows } = await _expQuery(`
            UPDATE mission_expenses
            SET category    = COALESCE($1, category),
                description = COALESCE($2, description),
                amount      = COALESCE($3, amount),
                expense_date= COALESCE($4, expense_date),
                vendor      = $5,
                notes       = $6,
                updated_at  = NOW()
            WHERE id = $7 AND mission_id = $8
            RETURNING *
        `, [
            category || null,
            description || null,
            amount != null ? parseFloat(amount) : null,
            expense_date || null,
            vendor || null,
            notes || null,
            req.params.expId,
            req.params.id
        ]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'Expense not found' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('[PUT /:id/expenses/:expId]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/** DELETE /api/deployments/:id/expenses/:expId  — delete an expense */
router.delete('/:id/expenses/:expId', authorize('admin'), async (req, res) => {
    try {
        await _expQuery(`DELETE FROM mission_expenses WHERE id = $1 AND mission_id = $2`, [req.params.expId, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /:id/expenses/:expId]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
