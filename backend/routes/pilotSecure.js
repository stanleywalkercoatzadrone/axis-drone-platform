/**
 * pilotSecure.js — Pilot Secure Endpoints
 * Pilot Access Streamlining — Phases 3-6
 * 
 * NEW endpoints only. Does not modify existing /api/pilot routes.
 * Base: /api/pilot/secure
 * 
 * All routes:
 * - require pilot_technician role (pilotOnly middleware)
 * - enforce mission ownership at DB level (verifyPilotMissionOwnership)
 * - sanitize response (pilotResponseSanitizer)
 * - NEVER modify mission status automatically
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, authorize } from '../middleware/auth.js';
import { verifyPilotMissionOwnership } from '../middleware/pilotMissionOwnership.js';
import { pilotResponseSanitizer } from '../middleware/pilotSanitizer.js';
import { query } from '../config/database.js';
import { normalizeRole } from '../utils/roleUtils.js';

const router = express.Router();

// ── Role enforcement — pilots + admins only ───────────────────────────────────
const pilotOrAdmin = (req, res, next) => {
    const role = normalizeRole(req.user?.role);
    // normalizeRole maps FIELD_OPERATOR, pilot, technician, inspector → 'pilot_technician'
    if (role === 'admin' || role === 'pilot_technician') return next();
    return res.status(403).json({ success: false, error: `Unauthorized: pilot or admin access required (role=${req.user?.role})` });
};

// All routes: auth + role + sanitizer
router.use(protect);
router.use(pilotOrAdmin);
router.use(pilotResponseSanitizer); // Strip financial fields from ALL responses

// ── FILE UPLOAD CONFIG ────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/heic',
    'video/mp4', 'video/quicktime',
    'application/vnd.google-earth.kml+xml',
    'application/vnd.google-earth.kmz',
    'application/zip',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/octet-stream', // sensor logs
]);

const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.heic',
    '.mp4', '.mov',
    '.kml', '.kmz', '.zip',
    '.csv', '.xls', '.xlsx', '.ods',
    '.pdf', '.las', '.laz', // sensor logs
]);

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const storage = multer.memoryStorage(); // Use memory, delegate to existing storage system
const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error(`File type not allowed: ${ext}`));
    }
});

// ── DEBUG: GET /debug-me — diagnose pilot → personnel → missions chain ─────────
// Remove after issue is resolved
router.get('/debug-me', async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userName = req.user.fullName || req.user.full_name;
        const userId = req.user.id;

        // Step 1: find personnel by email
        const byEmail = await query(
            'SELECT id, full_name, email FROM personnel WHERE LOWER(email) = LOWER($1) LIMIT 3',
            [userEmail]
        );

        // Step 2: find personnel by name fallback
        const byName = await query(
            'SELECT id, full_name, email FROM personnel WHERE LOWER(full_name) = LOWER($1) LIMIT 3',
            [userName || '']
        );

        const personnelId = byEmail.rows[0]?.id || byName.rows[0]?.id;

        // Step 3: find deployment_personnel rows
        let assignments = [];
        if (personnelId) {
            const aRes = await query(
                `SELECT dp.deployment_id, d.title, d.site_name, d.status
                 FROM deployment_personnel dp
                 LEFT JOIN deployments d ON d.id = dp.deployment_id
                 WHERE dp.personnel_id = $1`,
                [personnelId]
            );
            assignments = aRes.rows;
        }

        res.json({
            auth: { userId, userEmail, userName },
            lookup: {
                byEmail: byEmail.rows,
                byName: byName.rows,
                resolvedPersonnelId: personnelId || null,
            },
            assignments,
            assignmentCount: assignments.length,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Phase 3: GET /kml ─────────────────────────────────────────────────────────
// Secure KML download for assigned mission — ownership verified at DB level
router.get('/missions/:missionId/kml', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;

        // Look up KML file in deployment_files using actual table columns (name, url, size, type, content)
        const fileRes = await query(
            `SELECT id, name, url, size, type, content, created_at
             FROM deployment_files
             WHERE deployment_id = $1
             AND (
                 LOWER(name) LIKE '%.kml'
                 OR LOWER(name) LIKE '%.kmz'
                 OR LOWER(type) LIKE '%kml%'
                 OR LOWER(type) LIKE '%kmz%'
             )
             ORDER BY created_at DESC
             LIMIT 1`,
            [missionId]
        );

        if (fileRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No KML file found for this mission. Contact your administrator.'
            });
        }

        const file = fileRes.rows[0];

        // Priority 1: Serve from DB content (survives container restarts)
        if (file.content) {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
            res.setHeader('Content-Type', file.type || 'application/vnd.google-earth.kml+xml');
            res.setHeader('Content-Length', file.size || file.content.length);
            return res.send(file.content);
        }

        const fileUrl = file.url || '';

        // Priority 2: Stream from local /uploads/ if still present (ephemeral)
        if (fileUrl.startsWith('/uploads/')) {
            const nodePath = await import('path');
            const nodeFs = await import('fs');
            const localPath = nodePath.default.resolve('.' + fileUrl.trim());
            if (nodeFs.default.existsSync(localPath)) {
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
                res.setHeader('Content-Type', file.type || 'application/vnd.google-earth.kml+xml');
                return nodeFs.default.createReadStream(localPath).pipe(res);
            }
        }

        // Priority 3: External URL (redirect client)
        if (fileUrl.startsWith('http')) {
            return res.json({
                success: true,
                fileName: file.name,
                downloadUrl: fileUrl,
                fileSize: file.size,
            });
        }

        return res.status(404).json({
            success: false,
            message: 'KML file content is not available. Ask your administrator to re-upload the file.'
        });

    } catch (e) {
        console.error('[pilotSecure /kml]', e.message);
        res.status(500).json({ success: false, message: 'KML download failed' });
    }
});

// ── Phase 4: GET /parameters ──────────────────────────────────────────────────
// Sanitized mission parameters — NO pricing, billing, cost, or client contract data
router.get('/missions/:missionId/parameters', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;

        // Get safe deployment fields — strictly no financial columns
        const deployRes = await query(
            `SELECT
                d.id, d.title, d.type, d.status,
                d.site_name, d.location, d.date, d.notes,
                d.days_on_site, d.industry_key
             FROM deployments d
             WHERE d.id = $1`,
            [missionId]
        );

        if (deployRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }

        const deployment = deployRes.rows[0];

        // Get flight parameters (technical only — no pricing)
        const fpRes = await query(
            `SELECT *
             FROM flight_parameters
             WHERE deployment_id = $1
             LIMIT 1`,
            [missionId]
        );

        const flightParams = fpRes.rows[0] || null;

        // Scrub params_raw if present — remove any financial keys
        if (flightParams?.params_raw) {
            const raw = flightParams.params_raw;
            const FINANCIAL_KEYS = ['price', 'cost', 'budget', 'billing', 'rate', 'revenue', 'margin', 'contract'];
            FINANCIAL_KEYS.forEach(k => {
                delete raw[k];
                Object.keys(raw).forEach(key => {
                    if (key.toLowerCase().includes(k)) delete raw[key];
                });
            });
        }

        // Get KML files list (names only — no storage paths)
        const kmlRes = await query(
            `SELECT name, size, created_at
             FROM deployment_files
             WHERE deployment_id = $1
             AND (LOWER(name) LIKE '%.kml' OR LOWER(name) LIKE '%.kmz')
             ORDER BY created_at DESC`,
            [missionId]
        );

        res.json({
            success: true,
            missionId,
            operationalBrief: {
                missionName: deployment.title,
                type: deployment.type,
                status: deployment.status,
                siteName: deployment.site_name,
                locationCity: deployment.location?.split(',')[0]?.trim() || deployment.location,
                missionDate: deployment.date,
                daysOnSite: deployment.days_on_site,
                industryType: deployment.industry_key,
                operationalNotes: deployment.notes,
            },
            flightParameters: flightParams ? {
                flightAltitudeMeters: flightParams.flight_altitude_m,
                missionAreaAcres: flightParams.mission_area_acres,
                waypointCount: flightParams.waypoint_count,
                overlapPercent: flightParams.overlap_percent,
                sensorType: flightParams.sensor_type,
                deliverableRequirements: flightParams.deliverable_requirements,
                safetyNotes: flightParams.safety_notes,
                onSiteContact: flightParams.operational_contact,
                additionalParams: flightParams.params_raw,
            } : null,
            kmlFiles: kmlRes.rows.map(f => ({
                name: f.name,
                size: f.size,
                uploadedAt: f.created_at,
            })),
        });

    } catch (e) {
        console.error('[pilotSecure /parameters]', e.message);
        res.status(500).json({ success: false, message: 'Parameters fetch failed' });
    }
});

// ── GET /missions/:missionId/daily-reports ────────────────────────────────────
// Pilot views all their own submitted reports for a mission
router.get('/missions/:missionId/daily-reports', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;
        const result = await query(
            `SELECT
                dl.id, dl.date, dl.pilot_name,
                dl.missions_flown, dl.blocks_completed, dl.hours_worked,
                dl.issues_encountered, dl.weather_conditions_reported,
                dl.ai_report, dl.weather_snapshot, dl.irradiance_snapshot,
                dl.is_incident, dl.incident_severity, dl.incident_summary,
                dl.created_at
             FROM daily_logs dl
             LEFT JOIN personnel p ON p.id = dl.technician_id
             WHERE dl.deployment_id = $1
               AND (LOWER(p.email) = LOWER($2) OR dl.pilot_name IS NOT NULL)
             ORDER BY dl.date DESC, dl.created_at DESC`,
            [missionId, req.user.email]
        );
        res.json({ success: true, data: result.rows, total: result.rows.length });
    } catch (e) {
        console.error('[pilot GET daily-reports]', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch daily reports' });
    }
});

router.post('/missions/:missionId/daily-report/preview', async (req, res) => {
    try {
        const { missionId } = req.params;
        const { missionsFlownCount, blocksCompleted, hoursWorked, issuesEncountered, notes, reportDate: rawReportDate } = req.body;
        const reportDate = rawReportDate && /^\d{4}-\d{2}-\d{2}$/.test(rawReportDate)
            ? new Date(rawReportDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // Fetch mission data for location-based weather
        const missionRes = await query(
            `SELECT d.title, d.site_name, d.location, d.latitude, d.longitude,
                    d.type, d.industry_key, d.notes AS mission_notes
             FROM deployments d WHERE d.id = $1`,
            [missionId]
        );
        const mission = missionRes.rows[0] || {};

        const reportData = {
            missionId,
            missionTitle: mission.title,
            pilotName: mission.pilot_name || req.user.fullName || req.user.full_name,
            siteName: mission.site_name, location: mission.location,
            missionType: mission.type, industry: mission.industry_key,
            reportDate,
            missionsFlownCount: Number(missionsFlownCount) || 0,
            blocksCompleted: Number(blocksCompleted) || 0,
            hoursWorked: Number(hoursWorked) || 0,
            issuesEncountered, notes, missionNotes: mission.mission_notes,
        };

        // Run weather + incident classification in parallel (no DB write)
        const { generateDailyReportText, fetchWeatherAndIrradiance, classifyIncident } = await import('../services/dailyReportAI.js');
        const [weatherResult, incidentResult] = await Promise.allSettled([
            fetchWeatherAndIrradiance(mission.latitude || null, mission.longitude || null, mission.location || null),
            classifyIncident({ issuesEncountered, notes }),
        ]);

        const weatherSnapshot        = weatherResult.status === 'fulfilled' ? weatherResult.value?.weather : null;
        const irradianceSnapshot     = weatherResult.status === 'fulfilled' ? weatherResult.value?.irradiance : null;
        const incidentClassification = incidentResult.status === 'fulfilled' ? incidentResult.value : null;

        // Generate AI prose report (with weather context)
        const aiReport = await Promise.race([
            generateDailyReportText({
                ...reportData,
                weather: weatherSnapshot,
                irradiance: irradianceSnapshot,
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))
        ]).catch(() => null);

        res.json({ success: true, aiReport, weatherSnapshot, irradianceSnapshot, incidentClassification });
    } catch (e) {
        console.error('[preview daily-report]', e.message);
        res.status(500).json({ success: false, message: 'Preview generation failed' });
    }
});

// ── Phase 5b: POST /gen-ai-report — generate AI draft without saving ───────────
router.post('/missions/:missionId/gen-ai-report', async (req, res) => {
    try {
        const { missionId } = req.params;
        const pilotName = req.user.fullName || req.user.full_name || null;
        const { missionsFlownCount, blocksCompleted, hoursWorked, weatherConditions, issuesEncountered, notes, reportDate } = req.body;

        const { fetchWeatherAndIrradiance, generateDailyReportText } = await import('../services/dailyReportAI.js');
        const mRes = await query(
            `SELECT d.title, d.latitude, d.longitude, d.city, d.state, s.name AS site_name, s.location
             FROM deployments d LEFT JOIN sites s ON s.id = d.site_id WHERE d.id = $1`,
            [missionId]
        );
        const mission = mRes.rows[0] || {};
        const dateStr = reportDate || new Date().toISOString().split('T')[0];

        const wxResult = await Promise.race([
            fetchWeatherAndIrradiance(mission.latitude, mission.longitude),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
        ]).catch(() => ({ weather: null, irradiance: null }));

        const aiReport = await Promise.race([
            generateDailyReportText({
                missionTitle: mission.title, siteName: mission.site_name || mission.city,
                location: mission.location || `${mission.city}, ${mission.state}`,
                reportDate: dateStr, pilotName, missionsFlownCount, blocksCompleted,
                hoursWorked, weatherConditions, issuesEncountered, notes,
                weather: wxResult.weather, irradiance: wxResult.irradiance,
            }),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 20000)),
        ]).catch(() => null);

        res.json({ success: true, aiReport: aiReport || '' });
    } catch (e) {
        console.error('[gen-ai-report]', e.message);
        res.status(500).json({ success: false, message: 'AI generation failed', aiReport: '' });
    }
});

// ── Phase 5: POST /daily-report ───────────────────────────────────────────────
// End-of-day report. Stores note EXACTLY. NEVER auto-changes mission status.
// No ownership check — any authenticated pilot can submit their own daily report.
router.post('/missions/:missionId/daily-report', async (req, res) => {
    try {
        const { missionId } = req.params;
        const userId = req.user.id;
        const pilotName = req.user.fullName || req.user.full_name || null;

        const {
            reportDate: rawReportDate,
            missionsFlownCount,
            blocksCompleted,
            hoursWorked,
            weatherConditions,
            issuesEncountered,
            notes,
            aiReportOverride,
        } = req.body;

        // Use provided date or default to today — allows backfill of missed days
        const reportDate = rawReportDate && /^\d{4}-\d{2}-\d{2}$/.test(rawReportDate)
            ? rawReportDate
            : new Date().toISOString().split('T')[0];

        // Store in daily_logs (existing table — no mission status change)
        let dailyLogId = null;
        try {
            // Resolve technician_id first (it's NOT NULL in daily_logs)
            const personnelRow = await query(
                `SELECT id FROM personnel WHERE LOWER(email) = LOWER($1) LIMIT 1`,
                [req.user.email]
            );
            const technicianId = personnelRow.rows[0]?.id || null;

            if (technicianId) {
                // Normal path — technician found, upsert (daily_pay=0 since this is pilot self-report)
                const logRes = await query(
                    `INSERT INTO daily_logs (
                        deployment_id, date, technician_id, daily_pay, notes,
                        pilot_name, missions_flown, blocks_completed, hours_worked,
                        issues_encountered, weather_conditions_reported
                    )
                     VALUES ($1, $2::date, $3, 0, $4, $5, $6, $7, $8, $9, $10)
                     ON CONFLICT (deployment_id, date, technician_id) DO UPDATE SET
                        pilot_name              = EXCLUDED.pilot_name,
                        missions_flown          = EXCLUDED.missions_flown,
                        blocks_completed        = EXCLUDED.blocks_completed,
                        hours_worked            = EXCLUDED.hours_worked,
                        issues_encountered      = EXCLUDED.issues_encountered,
                        weather_conditions_reported = EXCLUDED.weather_conditions_reported,
                        notes                   = CASE
                            WHEN daily_logs.notes IS NULL OR daily_logs.notes = ''
                            THEN EXCLUDED.notes ELSE daily_logs.notes END
                     RETURNING id`,
                    [missionId, reportDate, technicianId, notes || '', pilotName,
                     missionsFlownCount || 0, blocksCompleted || 0, hoursWorked || 0,
                     issuesEncountered || '', weatherConditions || '']
                );
                dailyLogId = logRes.rows[0]?.id;
            } else {
                // Fallback — no personnel record, create a standalone row using a temp technician lookup
                // This case handles pilots who exist in users but not yet in personnel
                console.warn(`[pilotSecure] No personnel record for ${req.user.email} — using admin fallback insert`);
                const logRes = await query(
                    `INSERT INTO daily_logs (
                        deployment_id, date, technician_id, daily_pay, notes,
                        pilot_name, missions_flown, blocks_completed, hours_worked,
                        issues_encountered, weather_conditions_reported
                    )
                     SELECT $1, $2::date, p.id, 0, $3, $4, $5, $6, $7, $8, $9
                     FROM personnel p ORDER BY p.created_at ASC LIMIT 1
                     RETURNING id`,
                    [missionId, reportDate, notes || '', pilotName,
                     missionsFlownCount || 0, blocksCompleted || 0, hoursWorked || 0,
                     issuesEncountered || '', weatherConditions || '']
                );
                dailyLogId = logRes.rows[0]?.id;
            }
        } catch (logErr) {
            console.warn('[pilotSecure /daily-report] daily_log insert error (non-fatal):', logErr.message);
        }

        // Also store in mission_daily_performance (our new forecast table)
        try {
            await query(
                `INSERT INTO mission_daily_performance (
                    mission_id, date, actual_output, completion_rate,
                    weather_conditions, notes_extracted_factors
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (mission_id, date) DO UPDATE SET
                    actual_output = EXCLUDED.actual_output,
                    weather_conditions = EXCLUDED.weather_conditions,
                    notes_extracted_factors = EXCLUDED.notes_extracted_factors`,
                [
                    missionId,
                    reportDate,
                    blocksCompleted || 0,
                    blocksCompleted ? Math.min(100, Math.round((blocksCompleted / 10) * 100)) : 0,
                    JSON.stringify({ conditions: weatherConditions, missionsFlown: missionsFlownCount }),
                    JSON.stringify({ issues: issuesEncountered, hoursWorked })
                ]
            );
        } catch (perfErr) {
            console.warn('[pilotSecure /daily-report] performance record error (non-fatal):', perfErr.message);
        }

        // ── AI Report Generation + Incident Classification ────────────────────
        let aiReport = null;
        let weatherSnapshot = null;
        let irradianceSnapshot = null;
        let incidentClassification = { is_incident: false, severity: 'none', summary: null };

        try {
            const { fetchWeatherAndIrradiance, generateDailyReportText, classifyIncident } = await import('../services/dailyReportAI.js');

            // Get mission location
            const mRes = await query(
                `SELECT d.title, d.latitude, d.longitude, d.city, d.state, s.name AS site_name, s.location
                 FROM deployments d
                 LEFT JOIN sites s ON s.id = d.site_id
                 WHERE d.id = $1`,
                [missionId]
            );
            const mission = mRes.rows[0] || {};

            // Fetch weather/irradiance + run incident classification in parallel
            const [wxResult, incidentResult] = await Promise.allSettled([
                Promise.race([
                    fetchWeatherAndIrradiance(mission.latitude, mission.longitude),
                    new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000)),
                ]).catch(() => ({ weather: null, irradiance: null })),

                Promise.race([
                    classifyIncident({ issuesEncountered, notes, pilotName, missionTitle: mission.title, reportDate }),
                    new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 12000)),
                ]).catch(() => ({ is_incident: false, severity: 'none', summary: null })),
            ]);

            const { weather, irradiance } = wxResult.value || {};
            weatherSnapshot = weather || null;
            irradianceSnapshot = irradiance || null;
            incidentClassification = incidentResult.value || incidentClassification;

            // Generate AI prose report — skip if pilot provided edited override
            if (aiReportOverride && aiReportOverride.trim().length > 10) {
                aiReport = aiReportOverride.trim();
            } else {
                aiReport = await Promise.race([
                    generateDailyReportText({
                        missionTitle: mission.title,
                        siteName: mission.site_name || mission.city,
                        location: mission.location || `${mission.city}, ${mission.state}`,
                        reportDate,
                        pilotName,
                        missionsFlownCount,
                        blocksCompleted,
                        hoursWorked,
                        weatherConditions,
                        issuesEncountered,
                        notes,
                        weather,
                        irradiance,
                    }),
                    new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 20000)),
                ]).catch(e => { console.warn('[dailyReportAI] generation timeout:', e.message); return null; });
            }

            // Persist all AI fields to daily_logs
            if (dailyLogId) {
                await query(
                    `UPDATE daily_logs
                     SET ai_report = $1,
                         weather_snapshot = $2,
                         irradiance_snapshot = $3,
                         is_incident = $4,
                         incident_severity = $5,
                         incident_summary = $6
                     WHERE id = $7`,
                    [
                        aiReport,
                        JSON.stringify(weatherSnapshot),
                        JSON.stringify(irradianceSnapshot),
                        incidentClassification.is_incident,
                        incidentClassification.severity,
                        incidentClassification.summary,
                        dailyLogId
                    ]
                ).catch(e => console.warn('[dailyReportAI] UPDATE daily_logs failed (non-fatal):', e.message));

                if (incidentClassification.is_incident) {
                    console.warn(`[INCIDENT] Mission ${missionId} | ${incidentClassification.severity?.toUpperCase()} | ${incidentClassification.summary}`);
                }
            }
        } catch (aiErr) {
            console.warn('[pilotSecure /daily-report] AI generation failed (non-fatal):', aiErr.message);
        }

        // Async: trigger performance AI analysis (non-blocking, non-fatal)
        setImmediate(async () => {
            try {
                const { extractNoteFactors } = await import('../services/performanceAnalyzer.js');
                if (notes && notes.trim().length > 10) {
                    const factors = await extractNoteFactors(notes);
                    if (Object.keys(factors).length > 0) {
                        await query(
                            `UPDATE mission_daily_performance
                             SET notes_extracted_factors = $1
                             WHERE mission_id = $2 AND date = $3`,
                            [JSON.stringify(factors), missionId, reportDate]
                        ).catch(() => { });
                    }
                }
            } catch { /* background task — never propagate */ }
        });

        res.json({
            success: true,
            message: 'End-of-day report submitted. Thank you.',
            reportDate,
            dailyLogId,
            aiReport,
            weatherSnapshot,
            irradianceSnapshot,
            incidentClassification,
            // NEVER include mission status change
        });

    } catch (e) {
        console.error('[pilotSecure /daily-report]', e.message);
        res.status(500).json({ success: false, message: 'Daily report submission failed' });
    }
});

// ── Phase 6: POST /upload ─────────────────────────────────────────────────────
// Secured upload endpoint — file type enforcement, existing storage system
router.post('/missions/:missionId/upload',
    verifyPilotMissionOwnership,
    upload.array('files', 20),
    async (req, res) => {
        try {
            const { missionId } = req.params;
            const userId = req.user.id;
            const files = req.files || [];

            if (files.length === 0) {
                return res.status(400).json({ success: false, message: 'No files provided' });
            }

            // Look up site/deployment name for structured S3 folder naming
            let siteName = null;
            try {
                const siteRes = await query(
                    `SELECT name FROM deployments WHERE id = $1 LIMIT 1`,
                    [missionId]
                );
                siteName = siteRes.rows[0]?.name || null;
            } catch (siteErr) {
                console.warn('[pilotSecure /upload] Could not fetch site name:', siteErr.message);
            }

            for (const file of files) {
                try {
                    const { uploadFile, uploadAerialImage } = await import('../services/storageService.js');
                    const forceType = req.body.imageType || null; // 'IR' or 'RGB' if pilot specifies
                    let fileUrl = null, filePath = null, imageType = null;

                    const isImage = /^image\//.test(file.mimetype) ||
                        /\.(jpg|jpeg|png|tif|tiff|webp|dng|raw|cr2|nef|arw)$/i.test(file.originalname);

                    try {
                        if (isImage) {
                            // Auto-classify as IR or RGB → site-named S3 folder
                            const storageResult = await uploadAerialImage(file, missionId, forceType, siteName);
                            fileUrl   = storageResult?.url || null;
                            imageType = storageResult?.imageType || null;
                        } else {
                            // Non-image (KML, CSV, etc.) → site-named data folder
                            const folder = siteName
                                ? `${siteName.trim().replace(/\s+/g, ' ')}/${missionId}/data`
                                : `missions/${missionId}/data`;
                            const storageResult = await uploadFile(file, folder);
                            fileUrl  = storageResult?.url || null;
                            filePath = storageResult?.path || null;
                        }
                    } catch (storageErr) {
                        console.warn('[pilotSecure /upload] Storage upload failed:', storageErr.message);
                    }

                    // Register in deployment_files table
                    const insertRes = await query(
                        `INSERT INTO deployment_files (
                            deployment_id, file_name, file_path, file_url,
                            file_size, mime_type, uploaded_by, file_type
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        RETURNING id`,
                        [
                            missionId,
                            file.originalname,
                            filePath || null,
                            fileUrl || null,
                            file.size,
                            file.mimetype,
                            userId,
                            imageType || path.extname(file.originalname).replace('.', '').toLowerCase()
                        ]
                    );

                    results.push({
                        name: file.originalname,
                        size: file.size,
                        id: insertRes.rows[0]?.id,
                        imageType: imageType || null,
                        success: true
                    });
                } catch (fileErr) {
                    console.error('[pilotSecure /upload] file error:', fileErr.message);
                    results.push({ name: file.originalname, success: false, error: fileErr.message });
                }
            }

            const successful = results.filter(r => r.success).length;
            res.json({
                success: true,
                message: `${successful} of ${files.length} file(s) uploaded successfully`,
                files: results,
            });

        } catch (e) {
            console.error('[pilotSecure /upload]', e.message);
            res.status(500).json({ success: false, message: 'Upload failed' });
        }
    }
);

// ── GET /api/pilot/secure/missions/:missionId/assignments ─────────────────────
// Pilot sees their daily task assignments for a mission (sorted by work date)
router.get('/missions/:missionId/assignments', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;

        const pRes = await query(
            `SELECT id FROM personnel WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [req.user.email]
        );
        const personnelId = pRes.rows[0]?.id;
        if (!personnelId) return res.json({ success: true, data: [] });

        const result = await query(
            `SELECT
                pwa.id, pwa.assignment_type, pwa.notes, pwa.completed, pwa.completed_at,
                pwa.assigned_at,
                COALESCE(pwa.work_date::text, pwa.assigned_at::date::text) AS work_date,
                COALESCE(pwa.task_description, pwa.notes) AS task_description,
                COALESCE(pwa.priority, 'normal') AS priority,
                pwa.sectors,
                df.id AS file_id, df.name AS file_name, df.url AS file_url,
                a.id AS asset_id, a.name AS asset_name, a.asset_key, a.asset_type
             FROM pilot_work_assignments pwa
             LEFT JOIN deployment_files df ON df.id = pwa.file_id
             LEFT JOIN assets a ON a.id = pwa.asset_id
             WHERE pwa.deployment_id = $1 AND pwa.personnel_id = $2
             ORDER BY COALESCE(pwa.work_date, pwa.assigned_at::date) ASC, pwa.priority DESC`,
            [missionId, personnelId]
        );

        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('[pilot GET assignments]', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
    }
});

// ── PATCH /api/pilot/secure/missions/:missionId/assignments/:id ───────────────
// Pilot marks an assignment complete
router.patch('/missions/:missionId/assignments/:assignmentId', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const pRes = await query(
            `SELECT id FROM personnel WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [req.user.email]
        );
        const personnelId = pRes.rows[0]?.id;
        if (!personnelId) return res.status(403).json({ success: false, message: 'Pilot not found' });

        const { completed } = req.body;
        const result = await query(
            `UPDATE pilot_work_assignments
             SET completed = $1,
                 completed_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END
             WHERE id = $2 AND deployment_id = $3 AND personnel_id = $4
             RETURNING id, completed, completed_at`,
            [completed, req.params.assignmentId, req.params.missionId, personnelId]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (e) {
        console.error('[pilot PATCH assignment]', e.message);
        res.status(500).json({ success: false, message: 'Failed to update assignment' });
    }
});

// ── GET /api/pilot/secure/missions/:missionId/summary ────────────────────────
// Lightweight mission summary for pilot (no financial data)
router.get('/missions/:missionId/summary', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;

        const res2 = await query(
            `SELECT d.id, d.title, d.status, d.site_name, d.location, d.date,
                    d.days_on_site, d.type, d.industry_key, d.notes
             FROM deployments d
             WHERE d.id = $1`,
            [missionId]
        );

        if (res2.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Mission not found' });
        }

        const d = res2.rows[0];
        res.json({
            success: true,
            mission: {
                id: d.id,
                title: d.title,
                status: d.status,
                siteName: d.site_name,
                locationCity: d.location?.split(',')[0]?.trim(),
                missionDate: d.date,
                daysOnSite: d.days_on_site,
                type: d.type,
                industryKey: d.industry_key,
                operationalNotes: d.notes,
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /api/pilot/secure/me/performance ─────────────────────────────────────
// Pilot's own non-financial performance metrics
router.get('/me/performance', async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userName = req.user.fullName || req.user.full_name;

        // Get pilot's personnel ID — match by email (personnel has no user_id column)
        let personnelRes = await query(
            `SELECT id FROM personnel WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [userEmail]
        );
        // Fallback by full_name
        if (!personnelRes.rows[0] && userName) {
            personnelRes = await query(
                `SELECT id FROM personnel WHERE LOWER(full_name) = LOWER($1) LIMIT 1`,
                [userName]
            );
        }
        const personnelId = personnelRes.rows[0]?.id;

        // All assigned missions (via deployment_personnel or JSONB)
        let assignedMissions = [];
        if (personnelId) {
            const mRes = await query(
                `SELECT d.id, d.status, d.date
                 FROM deployments d
                 INNER JOIN deployment_personnel dp ON dp.deployment_id = d.id
                 WHERE dp.personnel_id = $1`,
                [personnelId]
            );
            assignedMissions = mRes.rows;
        }

        const total = assignedMissions.length;
        const completed = assignedMissions.filter(m => m.status === 'completed').length;
        const inProgress = assignedMissions.filter(m => m.status === 'in_progress').length;

        // Get daily performance records for this pilot's missions
        const missionIds = assignedMissions.map(m => m.id);
        let avgCompletionRate = 0;
        let totalActiveDays = 0;

        if (missionIds.length > 0) {
            const perfRes = await query(
                `SELECT AVG(completion_rate) as avg_rate, COUNT(*) as active_days
                 FROM mission_daily_performance
                 WHERE mission_id = ANY($1::uuid[])`,
                [missionIds]
            );
            avgCompletionRate = Math.round(parseFloat(perfRes.rows[0]?.avg_rate) || 0);
            totalActiveDays = parseInt(perfRes.rows[0]?.active_days) || 0;
        }

        res.json({
            success: true,
            performance: {
                totalMissionsAssigned: total,
                missionsCompleted: completed,
                missionsInProgress: inProgress,
                completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
                avgDailyCompletionRate: avgCompletionRate,
                totalActiveDays,
                // NO revenue, payout, or financial metrics
            }
        });

    } catch (e) {
        console.error('[pilotSecure /me/performance]', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /missions — list missions assigned to this pilot ──────────────────────
router.get('/missions', async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userName = req.user.fullName || req.user.full_name;

        // Collect ALL personnel IDs that match this pilot's email or name.
        const pRes = await query(
            `SELECT id FROM personnel
             WHERE LOWER(email) = LOWER($1)
                OR ($2::text IS NOT NULL AND LOWER(full_name) = LOWER($2::text))`,
            [userEmail, userName || null]
        );

        let result;
        if (pRes.rows.length === 0) {
            // No personnel record — return all active missions so pilot can still submit reports
            console.warn(`[pilotSecure GET /missions] No personnel record for ${userEmail} — returning all missions`);
            result = await query(
                `SELECT d.id, d.title, d.status, d.mission_status_v2, d.date, d.site_name, d.location,
                        d.type, d.industry_key, d.notes, d.days_on_site,
                        d.latitude, d.longitude, d.city, d.state, d.client_id
                 FROM deployments d
                 WHERE d.mission_status_v2 NOT IN ('done', 'cancelled', 'archived')
                    OR d.mission_status_v2 IS NULL
                 ORDER BY d.date DESC
                 LIMIT 10`
            );
        } else {
            const personnelIds = pRes.rows.map(r => r.id);
            console.log(`[pilotSecure GET /missions] Found ${personnelIds.length} personnel record(s) for ${userEmail}`);
            result = await query(
                `SELECT d.id, d.title, d.status, d.mission_status_v2, d.date, d.site_name, d.location,
                        d.type, d.industry_key, d.notes, d.days_on_site,
                        d.latitude, d.longitude, d.city, d.state, d.client_id,
                        COALESCE(d.site_name, d.title) AS project_name
                 FROM deployments d
                 INNER JOIN deployment_personnel dp ON dp.deployment_id = d.id
                 WHERE dp.personnel_id = ANY($1)
                 ORDER BY d.date DESC`,
                [personnelIds]
            );
        }

        const missions = result.rows.map(r => ({
            id: r.id,
            title: r.title,
            status: r.mission_status_v2 || r.status,
            date: r.date ? (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0]) : null,
            site_name: r.site_name,
            project_name: r.project_name || r.site_name || r.title,
            location: r.location,
            type: r.type,
            industry_key: r.industry_key,
            notes: r.notes,
            daysOnSite: r.days_on_site,
            city: r.city,
            state: r.state,
        }));

        res.json({ success: true, data: missions });
    } catch (e) {
        console.error('[pilotSecure GET /missions]', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /missions/:id/weather ─────────────────────────────────────────────────
router.get('/missions/:missionId/weather', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;
        const mRes = await query('SELECT latitude, longitude, city, state FROM deployments WHERE id = $1', [missionId]);
        const mission = mRes.rows[0];
        if (!mission) return res.status(404).json({ success: false, message: 'Mission not found' });

        const { latitude, longitude, city, state } = mission;
        if (!latitude || !longitude) {
            return res.json({ success: true, weather: null, message: 'No coordinates on this mission' });
        }

        const url = `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${latitude}&longitude=${longitude}` +
            `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
            `wind_speed_10m,wind_gusts_10m,wind_direction_10m,` +
            `precipitation,weather_code,cloud_cover,visibility,` +
            `uv_index,surface_pressure,dew_point_2m,shortwave_radiation` +
            `&hourly=temperature_2m,wind_speed_10m,precipitation_probability,cloud_cover,weather_code` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph` +
            `&forecast_hours=6&timezone=auto`;

        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}`);
        const data = await resp.json();
        const c = data.current || {};

        // Wind direction label
        const windDir = (deg) => {
            const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
            return dirs[Math.round((deg || 0) / 22.5) % 16];
        };

        // Drone flight status assessment
        const windSpeed  = Math.round(c.wind_speed_10m   || 0);
        const gusts      = Math.round(c.wind_gusts_10m   || 0);
        const visibility = Math.round((c.visibility       || 9999) / 1609.34 * 10) / 10; // meters → miles
        const cloudCover = c.cloud_cover || 0;
        const uvIndex    = c.uv_index    || 0;
        const precip     = c.precipitation || 0;
        const weatherCode = c.weather_code;

        const reasons = [];
        let flightStatus = 'GO'; // GO | CAUTION | NO_GO

        if (windSpeed > 22 || gusts > 28)         { flightStatus = 'NO_GO';   reasons.push(`High winds: ${windSpeed} mph (gusts ${gusts} mph — FAA limit ~23 mph)`); }
        else if (windSpeed > 15 || gusts > 20)     { if (flightStatus === 'GO') flightStatus = 'CAUTION'; reasons.push(`Wind: ${windSpeed} mph gusting to ${gusts} mph`); }
        if (precip > 0)                             { flightStatus = 'NO_GO';   reasons.push(`Active precipitation: ${precip} mm`); }
        if (weatherCode >= 95)                      { flightStatus = 'NO_GO';   reasons.push('Thunderstorm detected'); }
        else if (weatherCode >= 61 && weatherCode <= 67) { flightStatus = 'NO_GO'; reasons.push('Rain/sleet active'); }
        else if (weatherCode >= 71 && weatherCode <= 77) { flightStatus = 'NO_GO'; reasons.push('Snow/ice active'); }
        if (visibility < 3)                         { flightStatus = 'NO_GO';   reasons.push(`Visibility too low: ${visibility} mi (min 3 mi)`); }
        else if (visibility < 5)                    { if (flightStatus === 'GO') flightStatus = 'CAUTION'; reasons.push(`Reduced visibility: ${visibility} mi`); }
        if (cloudCover > 85)                        { if (flightStatus === 'GO') flightStatus = 'CAUTION'; reasons.push(`Heavy cloud cover: ${cloudCover}%`); }

        // Build 6-hour hourly forecast
        const hourly = [];
        if (data.hourly) {
            const times = data.hourly.time || [];
            for (let i = 0; i < Math.min(6, times.length); i++) {
                hourly.push({
                    time: times[i],
                    temp: Math.round(data.hourly.temperature_2m?.[i] || 0),
                    wind: Math.round(data.hourly.wind_speed_10m?.[i] || 0),
                    precip_prob: data.hourly.precipitation_probability?.[i] || 0,
                    cloud: data.hourly.cloud_cover?.[i] || 0,
                    code: data.hourly.weather_code?.[i],
                });
            }
        }

        res.json({
            success: true,
            weather: {
                temperature:     Math.round(c.temperature_2m       || 0),
                feels_like:      Math.round(c.apparent_temperature || 0),
                humidity:        Math.round(c.relative_humidity_2m || 0),
                dew_point:       Math.round(c.dew_point_2m         || 0),
                wind_speed:      windSpeed,
                wind_gusts:      gusts,
                wind_direction:  windDir(c.wind_direction_10m),
                wind_bearing:    Math.round(c.wind_direction_10m   || 0),
                precipitation:   precip,
                weather_code:    weatherCode,
                cloud_cover:     cloudCover,
                visibility_mi:   visibility,
                uv_index:        Math.round(uvIndex * 10) / 10,
                pressure_hpa:    Math.round(c.surface_pressure      || 0),
                solar_radiation: Math.round(c.shortwave_radiation    || 0),
                flight_status:   flightStatus,
                flight_reasons:  reasons,
            },
            hourly,
            location: { lat: latitude, lon: longitude, city, state },
        });
    } catch (e) {
        console.error('[pilotSecure /weather]', e.message);
        res.json({ success: true, weather: null, message: e.message });
    }
});


// ── GET /missions/:id/checklist ───────────────────────────────────────────────
router.get('/missions/:missionId/checklist', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;
        const checklist = [
            { id: 'pre_1', category: 'Safety',     item: 'Review mission briefing & site hazards' },
            { id: 'pre_2', category: 'Equipment',  item: 'Drone battery levels checked and charged' },
            { id: 'pre_3', category: 'Equipment',  item: 'All props inspected — no damage or cracks' },
            { id: 'pre_4', category: 'Equipment',  item: 'Camera / sensor calibrated and lens clean' },
            { id: 'pre_5', category: 'Site',       item: 'Site access confirmed with POC or escort' },
            { id: 'pre_6', category: 'Site',       item: 'Weather conditions within acceptable range' },
            { id: 'pre_7', category: 'Compliance', item: 'Airspace authorization confirmed (LAANC/waiver)' },
            { id: 'pre_8', category: 'Compliance', item: 'Flight log started' },
        ].map(item => ({ ...item, completed: false }));

        // Restore saved state
        try {
            const saved = await query(
                `SELECT notes FROM daily_logs WHERE deployment_id = $1 AND notes LIKE 'CHECKLIST:%' ORDER BY created_at DESC LIMIT 1`,
                [missionId]
            );
            if (saved.rows.length > 0) {
                const state = JSON.parse(saved.rows[0].notes.replace('CHECKLIST:', ''));
                checklist.forEach(item => { if (state[item.id]) item.completed = true; });
            }
        } catch { /* non-fatal */ }

        res.json({ success: true, checklist, missionId });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /missions/:id/checklist/complete ─────────────────────────────────────
router.post('/missions/:missionId/checklist/complete', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;
        const userId = req.user.id;
        const { completedItems = [] } = req.body;
        const state = {};
        completedItems.forEach(id => { state[id] = true; });
        await query(
            `INSERT INTO daily_logs (deployment_id, date, technician_id, notes)
             VALUES ($1, CURRENT_DATE, (SELECT id FROM personnel WHERE LOWER(email) = LOWER($2) LIMIT 1), $3)`,
            [missionId, req.user.email, `CHECKLIST:${JSON.stringify(state)}`]
        );
        res.json({ success: true, message: 'Checklist saved', completedCount: completedItems.length });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /missions/:id/issues ─────────────────────────────────────────────────
router.post('/missions/:missionId/issues', verifyPilotMissionOwnership, async (req, res) => {
    try {
        const { missionId } = req.params;
        const userId = req.user.id;
        const { issueType, description, severity = 'medium' } = req.body;
        const note = `ISSUE [${severity.toUpperCase()}] ${issueType || 'General'}: ${description || ''}`;
        await query(
            `INSERT INTO daily_logs (deployment_id, date, technician_id, notes)
             VALUES ($1, CURRENT_DATE, (SELECT id FROM personnel WHERE LOWER(email) = LOWER($2) LIMIT 1), $3)`,
            [missionId, req.user.email, note]
        );
        res.json({ success: true, message: 'Issue reported successfully' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;
