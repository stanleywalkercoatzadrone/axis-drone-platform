import db from '../config/database.js';
import { sendMissionAssignmentEmail, isMockTransporter } from '../services/emailService.js';
import { eventBus, EVENT_TYPES } from '../events/eventBus.js';

/**
 * Geocode a city/location string using Open-Meteo geocoding API.
 * Returns { lat, lon, label } or null if not found.
 * Non-blocking — never throws, always resolves.
 */
async function geocodeLocation(text) {
    if (!text) return null;
    const searchTerm = text.split(',')[0].trim();
    if (!searchTerm || searchTerm.length < 2) return null;
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const r = data.results[0];
            return {
                lat: r.latitude,
                lon: r.longitude,
                label: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}`,
            };
        }
    } catch (e) {
        console.warn('[deploymentController] Geocoding failed for:', searchTerm, e.message);
    }
    return null;
}

/**
 * Get all deployments with optional filters
 */
export const getAllDeployments = async (req, res) => {
    try {
        const { status, startDate, endDate, industryKey } = req.query;
        const isPilot = req.user.role === 'pilot_technician';

        // For pilots: look up their personnel record to scope missions
        let pilotPersonnelId = null;
        if (isPilot) {
            const pilotRow = await db.query(
                `SELECT id FROM personnel WHERE email = $1 LIMIT 1`,
                [req.user.email]
            );
            pilotPersonnelId = pilotRow.rows[0]?.id || null;
        }

        let query = `
            SELECT d.*,
                   (SELECT COUNT(*) FROM deployment_files df WHERE df.deployment_id = d.id) as file_count,
                   (SELECT COUNT(*) FROM deployment_personnel dp WHERE dp.deployment_id = d.id) as personnel_count,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', dl.id,
                               'date', dl.date,
                               'technicianId', dl.technician_id,
                               'dailyPay', dl.daily_pay,
                               'bonusPay', dl.bonus_pay,
                               'notes', dl.notes
                           )
                       ) FILTER (WHERE dl.id IS NOT NULL),
                       '[]'
                   ) as daily_logs
            FROM deployments d
            LEFT JOIN daily_logs dl ON d.id = dl.deployment_id
        `;

        // Dynamic WHERE clauses — use 1=1 anchor so all ANDs are safe
        const params = [];
        query += ` WHERE 1=1`;

        // Tenant filter — skip if user has no tenant (null = null matches nothing in SQL)
        if (req.user.tenantId) {
            params.push(req.user.tenantId);
            query += ` AND (d.tenant_id = $${params.length} OR d.tenant_id IS NULL)`;
        }

        // Pilots: filter to their assigned missions (only when personnel record exists)
        if (isPilot && pilotPersonnelId) {
            params.push(pilotPersonnelId);
            query += ` AND EXISTS (
                SELECT 1 FROM deployment_personnel dp2
                WHERE dp2.deployment_id = d.id AND dp2.personnel_id = $${params.length}
            )`;
        }
        // Pilot with no personnel record: show all missions so they can still submit reports

        if (status) {
            params.push(status);
            query += ` AND d.status = $${params.length}`;
        }

        if (startDate) {
            params.push(startDate);
            query += ` AND d.date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            query += ` AND d.date <= $${params.length}`;
        }

        if (industryKey) {
            params.push(industryKey);
            query += ` AND d.industry_key = $${params.length}`;
        }

        // Filter by clientId when viewing missions under a specific client
        const { clientId, country_id } = req.query;
        if (clientId) {
            params.push(clientId);
            query += ` AND d.client_id = $${params.length}`;
        }

        // Filter by country: exact country_id match OR null country for US (all legacy missions)
        if (country_id) {
            params.push(country_id);
            query += ` AND (d.country_id = $${params.length} OR d.country_id IS NULL)`;
        }

        query += ' GROUP BY d.id ORDER BY d.date DESC, d.created_at DESC';


        const result = await db.query(query, params);

        // Transform snake_case to camelCase for frontend
        const deployments = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            type: row.type,
            status: row.status,
            missionStatusV2: row.mission_status_v2 || null,
            mission_status_v2: row.mission_status_v2 || null,
            industryKey: row.industry_key || null,
            siteName: row.site_name,
            siteId: row.site_id,
            countryId: row.country_id || null,
            date: new Date(row.date).toISOString().split('T')[0],
            location: row.location,
            notes: row.notes,
            daysOnSite: row.days_on_site,
            latitude: row.latitude != null ? parseFloat(row.latitude) : null,
            longitude: row.longitude != null ? parseFloat(row.longitude) : null,
            city: row.city || null,
            state: row.state || null,
            dailyLogs: row.daily_logs,
            fileCount: parseInt(row.file_count || 0),
            personnelCount: parseInt(row.personnel_count || 0),
            technicianIds: [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        res.json({
            success: true,
            data: deployments
        });
    } catch (error) {
        console.error('Error fetching deployments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch deployments',
            error: error.message
        });
    }
};

/**
 * Get deployment by ID with daily logs
 */
export const getDeploymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT d.*,
            (SELECT COUNT(*) FROM deployment_files df WHERE df.deployment_id = d.id) as file_count,
                COALESCE(
                    (SELECT json_agg(personnel_id) FROM deployment_personnel WHERE deployment_id = d.id),
                '[]'
                   ) as technician_ids,
    COALESCE(
        json_agg(
            json_build_object(
                'id', dl.id,
                'date', dl.date,
                'technicianId', dl.technician_id,
                'dailyPay', dl.daily_pay,
                'bonusPay', dl.bonus_pay,
                'notes', dl.notes
            )
        ) FILTER(WHERE dl.id IS NOT NULL),
        '[]'
    ) as daily_logs
            FROM deployments d
            LEFT JOIN daily_logs dl ON d.id = dl.deployment_id
            WHERE d.id = $1 AND d.tenant_id = $2
            GROUP BY d.id
        `;

        const result = await db.query(query, [id, req.user.tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Deployment not found'
            });
        }

        const row = result.rows[0];

        // Fetch monitoring users
        const monitoringResult = await db.query(
            `SELECT u.id, u.full_name, u.email, u.role, dmu.role as mission_role
             FROM users u
             JOIN deployment_monitoring_users dmu ON u.id = dmu.user_id
             WHERE dmu.deployment_id = $1`,
            [id]
        );

        const deployment = {
            id: row.id,
            title: row.title,
            type: row.type,
            status: row.status,
            siteName: row.site_name,
            siteId: row.site_id,
            date: new Date(row.date).toISOString().split('T')[0],
            location: row.location,
            notes: row.notes,
            daysOnSite: row.days_on_site,
            city: row.city || null,
            state: row.state || null,
            dailyLogs: row.daily_logs,
            fileCount: parseInt(row.file_count || 0),
            technicianIds: row.technician_ids,
            monitoringTeam: monitoringResult.rows.map(u => ({
                id: u.id,
                fullName: u.full_name,
                email: u.email,
                role: u.role,
                missionRole: u.mission_role
            })),
            latitude: row.latitude != null ? parseFloat(row.latitude) : null,
            longitude: row.longitude != null ? parseFloat(row.longitude) : null,
            city: row.city || null,
            state: row.state || null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };

        res.json({
            success: true,
            data: deployment
        });
    } catch (error) {
        console.error('Error fetching deployment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch deployment',
            error: error.message
        });
    }
};

/**
 * Create new deployment
 */
export const createDeployment = async (req, res) => {
    try {
        const {
            title,
            type,
            status,
            siteName,
            siteId,
            date,
            location,
            notes,
            daysOnSite,
            industryKey,
            latitude,
            longitude
        } = req.body;

        // Base field validation
        if (!title || !type || !siteName || !date) {
            return res.status(400).json({
                success: false,
                message: 'Title, type, site name, and date are required'
            });
        }

        // Resolve coordinates: use provided → auto-geocode from location/siteName → null (never block)
        let lat = null, lon = null;
        if (latitude !== undefined && latitude !== null && latitude !== '' &&
            longitude !== undefined && longitude !== null && longitude !== '') {
            lat = parseFloat(latitude);
            lon = parseFloat(longitude);
            if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
                return res.status(400).json({ success: false, message: 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180' });
            }
        } else {
            // Auto-geocode from location or site name
            const geocoded = await geocodeLocation(location) || await geocodeLocation(siteName);
            if (geocoded) {
                lat = geocoded.lat;
                lon = geocoded.lon;
                console.log(`[deploymentController] Auto-geocoded "${location || siteName}" → ${geocoded.label} (${lat}, ${lon})`);
            }
        }

        const result = await db.query(
            `INSERT INTO deployments
    (title, type, status, site_name, site_id, date, location, notes, days_on_site, industry_key, tenant_id, latitude, longitude)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *`,
            [
                title,
                type,
                status || 'Scheduled',
                siteName,
                siteId || null,
                date,
                location || null,
                notes || null,
                daysOnSite || 1,
                industryKey || null,
                req.user.tenantId,
                lat,
                lon
            ]
        );

        const row = result.rows[0];
        const deployment = {
            id: row.id,
            title: row.title,
            type: row.type,
            status: row.status,
            siteName: row.site_name,
            siteId: row.site_id,
            date: new Date(row.date).toISOString().split('T')[0],
            location: row.location,
            notes: row.notes,
            daysOnSite: row.days_on_site,
            latitude: row.latitude ? parseFloat(row.latitude) : null,
            longitude: row.longitude ? parseFloat(row.longitude) : null,
            dailyLogs: [],
            technicianIds: []
        };

        res.status(201).json({
            success: true,
            data: deployment,
            message: 'Deployment created successfully'
        });

        // §3 Emit mission.created event (non-blocking, after response sent)
        eventBus.emit(EVENT_TYPES.MISSION_CREATED, {
            missionId:  row.id,
            title:      row.title,
            userId:     req.user?.id,
            tenantId:   req.user?.tenantId,
            requestId:  req.requestId,
            after: deployment,
        });
    } catch (error) {
        console.error('Error creating deployment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create deployment',
            error: error.message
        });
    }
};

/**
 * Update deployment
 */
export const updateDeployment = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            type,
            status,
            siteName,
            siteId,
            date,
            location,
            notes,
            daysOnSite,
            latitude,
            longitude,
            state
        } = req.body;

        // Check current status for transition validation
        const currentCheck = await db.query('SELECT status FROM deployments WHERE id = $1', [id]);
        if (currentCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Deployment not found' });
        }
        const currentStatus = currentCheck.rows[0].status;

        // Lifecycle Enforcement logic
        if (status && status !== currentStatus) {
            const allowed = {
                'Draft': ['Scheduled', 'Archived'],
                'Scheduled': ['Active', 'Cancelled', 'Delayed', 'Draft'],
                'Active': ['Review', 'Completed', 'Delayed', 'Cancelled'],
                'Review': ['Completed', 'Active'], // Can go back to active if review fails
                'Completed': ['Archived', 'Review'], // Reactivate for review?
                'Archived': [] // Terminal
            };

            // Bypass for simple "Draft" or if Logic not strictly defined for custom flow
            // But enforce basic "Draft" -> "Active"
            if (allowed[currentStatus] && !allowed[currentStatus].includes(status)) {
                // Determine if user is Admin/Ops? (Req object doesn't have user here usually, need middleware)
                // For now, allow but LOG WARNING? Or strict?
                // Strict:
                // return res.status(400).json({ success: false, message: `Invalid status transition from ${ currentStatus } to ${ status } ` });
            }
        }

        // Resolve coordinates: use provided → auto-geocode from location/siteName → keep existing (null = no change)
        let lat = undefined;
        let lon = undefined;
        if (latitude !== undefined && latitude !== null && latitude !== '' &&
            longitude !== undefined && longitude !== null && longitude !== '') {
            lat = parseFloat(latitude);
            lon = parseFloat(longitude);
            if (isNaN(lat) || lat < -90 || lat > 90) {
                return res.status(400).json({ success: false, message: 'Invalid latitude. Must be -90 to 90.' });
            }
            if (isNaN(lon) || lon < -180 || lon > 180) {
                return res.status(400).json({ success: false, message: 'Invalid longitude. Must be -180 to 180.' });
            }
        } else if (location || siteName) {
            // No explicit coords — try to geocode from the location/siteName being set
            const geocoded = await geocodeLocation(location) || await geocodeLocation(siteName);
            if (geocoded) {
                lat = geocoded.lat;
                lon = geocoded.lon;
                console.log(`[deploymentController] Auto-geocoded on update: "${location || siteName}" → ${geocoded.label} (${lat}, ${lon})`);
            }
        }

        const result = await db.query(
            `UPDATE deployments 
            SET title = COALESCE($1, title),
    type = COALESCE($2, type),
    status = COALESCE($3, status),
    site_name = COALESCE($4, site_name),
    site_id = COALESCE($5, site_id),
    date = COALESCE($6, date),
    location = COALESCE($7, location),
    notes = COALESCE($8, notes),
    days_on_site = COALESCE($9, days_on_site),
    latitude = CASE WHEN $12::numeric IS NOT NULL THEN $12::numeric ELSE latitude END,
    longitude = CASE WHEN $13::numeric IS NOT NULL THEN $13::numeric ELSE longitude END,
    updated_at = CURRENT_TIMESTAMP
            WHERE id = $10 AND tenant_id = $11
RETURNING * `,
            [title, type, status, siteName, siteId, date, location, notes, daysOnSite, id, req.user.tenantId, lat ?? null, lon ?? null]
        );

        // Audit Log
        if (req.user) { // Ensure auth middleware populated user
            await db.query(
                `INSERT INTO audit_logs(user_id, action, resource_type, resource_id, metadata)
VALUES($1, $2, $3, $4, $5)`,
                [req.user.id, 'DEPLOYMENT_UPDATED', 'deployment', id, JSON.stringify({ status_change: status ? `${currentStatus} -> ${status} ` : 'No status change' })]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Deployment not found'
            });
        }

        const row = result.rows[0];
        const deployment = {
            id: row.id,
            title: row.title,
            type: row.type,
            status: row.status,
            siteName: row.site_name,
            siteId: row.site_id,
            date: new Date(row.date).toISOString().split('T')[0],
            location: row.location,
            notes: row.notes,
            daysOnSite: row.days_on_site,
            latitude: row.latitude ? parseFloat(row.latitude) : null,
            longitude: row.longitude ? parseFloat(row.longitude) : null,
        };

        // Save state and city separately — safe even if columns don't exist yet
        if (state !== undefined || location) {
            try {
                await db.query(
                    `UPDATE deployments SET state = $1 WHERE id = $2`,
                    [state || null, id]
                );
            } catch (_) { /* state column may not exist yet — non-fatal */ }
        }

        res.json({
            success: true,
            data: deployment,
            message: 'Deployment updated successfully'
        });

        // §3 Emit mission.updated event (non-blocking)
        eventBus.emit(EVENT_TYPES.MISSION_UPDATED, {
            missionId:      id,
            userId:         req.user?.id,
            tenantId:       req.user?.tenantId,
            requestId:      req.requestId,
            previousStatus: currentStatus,
            newStatus:      status || currentStatus,
            after:          deployment,
            entityType:     'deployment',
            entityId:       id,
            resourceType:   'deployment',
            resourceId:     id,
        });
    } catch (error) {
        console.error('Error updating deployment:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to update deployment',
            error: error.message
        });
    }
};

/**
 * Delete deployment
 */
export const deleteDeployment = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM deployments WHERE id = $1 AND tenant_id = $2 RETURNING id',
            [id, req.user.tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Deployment not found'
            });
        }

        res.json({
            success: true,
            message: 'Deployment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting deployment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete deployment',
            error: error.message
        });
    }
};

/**
 * Add daily log to deployment
 */
export const addDailyLog = async (req, res) => {
    try {
        const { id: deploymentId } = req.params;
        const { date, technicianId, dailyPay, bonusPay, notes } = req.body;

        // Validation
        if (!date || !technicianId || dailyPay === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Date, technician ID, and daily pay are required'
            });
        }

        // Check if deployment exists
        const deploymentCheck = await db.query(
            'SELECT id FROM deployments WHERE id = $1',
            [deploymentId]
        );

        if (deploymentCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Deployment not found'
            });
        }

        const result = await db.query(
            `INSERT INTO daily_logs(deployment_id, date, technician_id, daily_pay, bonus_pay, notes)
VALUES($1, $2, $3, $4, $5, $6)
RETURNING * `,
            [deploymentId, date, technicianId, dailyPay, bonusPay || 0, notes || null]
        );

        const log = {
            id: result.rows[0].id,
            date: result.rows[0].date,
            technicianId: result.rows[0].technician_id,
            dailyPay: parseFloat(result.rows[0].daily_pay),
            bonusPay: parseFloat(result.rows[0].bonus_pay || 0),
            notes: result.rows[0].notes
        };

        res.status(201).json({
            success: true,
            data: log,
            message: 'Daily log added successfully'
        });
    } catch (error) {
        console.error('Error adding daily log:', error);

        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Daily log already exists for this technician on this date'
            });
        }

        // Handle foreign key constraint violation
        if (error.code === '23503') {
            return res.status(404).json({
                success: false,
                message: 'Technician not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to add daily log',
            error: error.message
        });
    }
};

/**
 * Update daily log
 */
export const updateDailyLog = async (req, res) => {
    try {
        const { id: deploymentId, logId } = req.params;
        const { dailyPay, bonusPay, notes } = req.body;

        const result = await db.query(
            `UPDATE daily_logs 
            SET daily_pay = COALESCE($1, daily_pay),
    bonus_pay = COALESCE($2, bonus_pay),
    notes = COALESCE($3, notes)
            WHERE id = $4 AND deployment_id = $5
RETURNING * `,
            [dailyPay, bonusPay, notes, logId, deploymentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Daily log not found'
            });
        }

        const log = {
            id: result.rows[0].id,
            date: result.rows[0].date,
            technicianId: result.rows[0].technician_id,
            dailyPay: parseFloat(result.rows[0].daily_pay),
            bonusPay: parseFloat(result.rows[0].bonus_pay || 0),
            notes: result.rows[0].notes
        };

        res.json({
            success: true,
            data: log,
            message: 'Daily log updated successfully'
        });
    } catch (error) {
        console.error('Error updating daily log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update daily log',
            error: error.message
        });
    }
};

/**
 * Delete daily log
 */
export const deleteDailyLog = async (req, res) => {
    try {
        const { id: deploymentId, logId } = req.params;

        const result = await db.query(
            'DELETE FROM daily_logs WHERE id = $1 AND deployment_id = $2 RETURNING id',
            [logId, deploymentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Daily log not found'
            });
        }

        res.json({
            success: true,
            message: 'Daily log deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting daily log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete daily log',
            error: error.message
        });
    }
};

/**
 * Get total cost for deployment
 */
export const getDeploymentCost = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT COALESCE(SUM(daily_pay + COALESCE(bonus_pay, 0)), 0) as total_cost
            FROM daily_logs
            WHERE deployment_id = $1`,
            [id]
        );

        res.json({
            success: true,
            data: {
                deploymentId: id,
                totalCost: parseFloat(result.rows[0].total_cost)
            }
        });
    } catch (error) {
        console.error('Error calculating deployment cost:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate deployment cost',
            error: error.message
        });
    }
};

/**
 * Upload file to deployment
 */
export const uploadDeploymentFile = async (req, res) => {
    try {
        const { id } = req.params;
        const file = req.file ?? req.files?.[0];

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const check = await db.query('SELECT id FROM deployments WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Deployment not found'
            });
        }

        const fs = await import('fs/promises');
        const path = await import('path');
        const uploadDir = path.resolve('uploads');

        try {
            await fs.access(uploadDir);
        } catch {
            await fs.mkdir(uploadDir, { recursive: true });
        }

        const filename = `${id}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filepath = path.join(uploadDir, filename);

        await fs.writeFile(filepath, file.buffer);

        const fileUrl = `/uploads/${filename}`;

        const result = await db.query(
            `INSERT INTO deployment_files(deployment_id, name, url, type, size, content)
             VALUES($1, $2, $3, $4, $5, $6)
             RETURNING id, deployment_id, name, url, type, size, created_at`,
            [id, file.originalname, fileUrl, file.mimetype, file.size, file.buffer]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'File uploaded successfully'
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
            error: error.message
        });
    }
};

/**
 * Get files for deployment
 */
// File types allowed for pilots: KML files, data spreadsheets, and images (for evidence)
const PILOT_ALLOWED_MIME_TYPES = new Set([
    'application/vnd.google-earth.kml+xml',
    'application/vnd.google-earth.kmz',
    'application/octet-stream', // generic KMZ/KML fallback
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/webp'
]);

// Also allow by file extension for files without proper MIME types
const isPilotAllowedFile = (file) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.kml') || name.endsWith('.kmz')) return true;
    if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) return true;
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.heic') || name.endsWith('.webp')) return true;
    return PILOT_ALLOWED_MIME_TYPES.has(file.type);
};

export const getDeploymentFiles = async (req, res) => {
    try {
        const { id } = req.params;
        const isPilot = req.user.role === 'pilot_technician';

        const result = await db.query(
            'SELECT * FROM deployment_files WHERE deployment_id = $1 ORDER BY created_at DESC',
            [id]
        );

        let files = result.rows;

        // Pilots only see KML and spreadsheet files (LBD data packages)
        if (isPilot) {
            files = files.filter(isPilotAllowedFile);
        }

        res.json({
            success: true,
            data: files
        });
    } catch (error) {
        console.error('Error fetching deployment files:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch deployment files',
            error: error.message
        });
    }
};

/**
 * Delete deployment file
 */
export const deleteDeploymentFile = async (req, res) => {
    try {
        const { id, fileId } = req.params;

        const result = await db.query(
            'DELETE FROM deployment_files WHERE id = $1 AND deployment_id = $2 RETURNING *',
            [fileId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting deployment file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete deployment file',
            error: error.message
        });
    }
};

/**
 * Assign personnel to deployment
 */
export const assignPersonnel = async (req, res) => {
    try {
        const { id: deploymentId } = req.params;
        const { personnelId } = req.body;

        console.log(`[assignPersonnel] Called by ${req.user?.email} (role=${req.user?.role}) | deploymentId=${deploymentId} | personnelId=${personnelId}`);

        if (!personnelId) {
            return res.status(400).json({
                success: false,
                message: 'Personnel ID is required'
            });
        }

        // Verify personnel ID exists in the personnel table
        const personCheck = await db.query(
            'SELECT id, full_name, email FROM personnel WHERE id = $1',
            [personnelId]
        );
        console.log(`[assignPersonnel] Personnel lookup: found=${personCheck.rows.length > 0} name=${personCheck.rows[0]?.full_name || 'N/A'} email=${personCheck.rows[0]?.email || 'N/A'}`);

        if (personCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Personnel record not found' });
        }

        const result = await db.query(
            'INSERT INTO deployment_personnel (deployment_id, personnel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING deployment_id, personnel_id',
            [deploymentId, personnelId]
        );

        if (result.rows.length === 0) {
            console.log(`[assignPersonnel] Already assigned (ON CONFLICT DO NOTHING) — deploymentId=${deploymentId} personnelId=${personnelId}`);
        } else {
            console.log(`[assignPersonnel] ✅ INSERT succeeded — ${personCheck.rows[0]?.full_name} assigned to deployment ${deploymentId}`);
        }

        res.json({
            success: true,
            message: result.rows.length > 0 ? 'Personnel assigned successfully' : 'Already assigned',
            personnelName: personCheck.rows[0]?.full_name
        });
    } catch (error) {
        console.error('[assignPersonnel] Error:', error.message, '| deploymentId:', req.params.id, '| personnelId:', req.body?.personnelId);
        res.status(500).json({
            success: false,
            message: 'Failed to assign personnel',
            error: error.message
        });
    }
};

/**
 * Unassign personnel from deployment
 */
export const unassignPersonnel = async (req, res) => {
    try {
        const { id: deploymentId, personnelId } = req.params;

        await db.query(
            'DELETE FROM deployment_personnel WHERE deployment_id = $1 AND personnel_id = $2',
            [deploymentId, personnelId]
        );

        res.json({
            success: true,
            message: 'Personnel unassigned successfully'
        });
    } catch (error) {
        console.error('Error unassigning personnel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unassign personnel',
            error: error.message
        });
    }
};

/**
 * Assign monitoring user to deployment
 */
export const assignMonitoringUser = async (req, res) => {
    try {
        const { id: deploymentId } = req.params;
        const { userId, role } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        await db.query(
            'INSERT INTO deployment_monitoring_users (deployment_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (deployment_id, user_id) DO UPDATE SET role = EXCLUDED.role',
            [deploymentId, userId, role || 'Monitor']
        );

        res.json({
            success: true,
            message: 'Monitoring user assigned successfully'
        });
    } catch (error) {
        console.error('Error assigning monitoring user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign monitoring user',
            error: error.message
        });
    }
};

/**
 * Unassign monitoring user from deployment
 */
export const unassignMonitoringUser = async (req, res) => {
    try {
        const { id: deploymentId, userId } = req.params;

        await db.query(
            'DELETE FROM deployment_monitoring_users WHERE deployment_id = $1 AND user_id = $2',
            [deploymentId, userId]
        );

        res.json({
            success: true,
            message: 'Monitoring user unassigned successfully'
        });
    } catch (error) {
        console.error('Error unassigning monitoring user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unassign monitoring user',
            error: error.message
        });
    }
};

/**
 * Notify personnel of mission assignment
 */
export const notifyAssignment = async (req, res) => {
    try {
        const { id: deploymentId } = req.params;
        const { personId, type } = req.body; // type: 'CREW' | 'MONITOR'

        if (!personId || !type) {
            return res.status(400).json({ success: false, message: 'Person ID and type are required' });
        }

        // Get deployment details
        const deployResult = await db.query('SELECT title, site_name, date, location FROM deployments WHERE id = $1', [deploymentId]);
        if (deployResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Deployment not found' });
        }
        const deployment = {
            title: deployResult.rows[0].title,
            siteName: deployResult.rows[0].site_name,
            date: new Date(deployResult.rows[0].date).toLocaleDateString(),
            location: deployResult.rows[0].location
        };

        let person = null;
        let role = '';

        if (type === 'CREW') {
            const pResult = await db.query('SELECT full_name, email, role FROM personnel WHERE id = $1', [personId]);
            if (pResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Personnel not found' });
            person = { name: pResult.rows[0].full_name, email: pResult.rows[0].email };
            role = pResult.rows[0].role;
        } else if (type === 'MONITOR') {
            const uResult = await db.query(
                `SELECT u.full_name, u.email, dmu.role 
                 FROM users u 
                 JOIN deployment_monitoring_users dmu ON u.id = dmu.user_id 
                 WHERE u.id = $1 AND dmu.deployment_id = $2`,
                [personId, deploymentId]
            );
            if (uResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Monitoring user not found on this mission' });
            person = { name: uResult.rows[0].full_name, email: uResult.rows[0].email };
            role = uResult.rows[0].role;
        }

        await sendMissionAssignmentEmail(person, deployment, role);

        res.json({
            success: true,
            message: `Assignment email sent to ${person.name}`,
            emailStatus: isMockTransporter() ? 'MOCK' : 'REAL'
        });
    } catch (error) {
        console.error('Error notifying assignment:', error);
        res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
    }
};
