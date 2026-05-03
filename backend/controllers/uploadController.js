import { query, transaction } from '../config/database.js';

const tenantIdOf = (req) => req.user?.tenantId ? String(req.user.tenantId) : null;

const ensureIngestionTenantColumn = async () => {
    await query(`ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS tenant_id TEXT`).catch(() => {});
};

const getScopedJob = async (jobId, req) => {
    await ensureIngestionTenantColumn();
    const tenantId = tenantIdOf(req);
    const result = await query(
        `SELECT *
         FROM ingestion_jobs
         WHERE id = $1
           AND (
             created_by = $2
             OR $3::text IS NULL
             OR tenant_id::text = $3::text
           )
         LIMIT 1`,
        [jobId, req.user.id, tenantId]
    );
    return result.rows[0] || null;
};

/**
 * createJob - Starts a new upload batch
 * POST /api/uploads/jobs
 */
export const createJob = async (req, res) => {
    const { industry, clientId, siteId, totalFiles } = req.body;
    const userId = req.user.id; // Assumes auth middleware
    const tenantId = tenantIdOf(req);

    if (!clientId || !siteId) {
        return res.status(400).json({ success: false, message: 'Client ID and Site ID are required' });
    }

    try {
        await ensureIngestionTenantColumn();

        const scopeCheck = await query(
            `SELECT c.id AS client_id, s.id AS site_id
             FROM clients c
             JOIN sites s ON s.id = $2 AND s.client_id = c.id
             WHERE c.id = $1
               AND ($3::text IS NULL OR c.tenant_id::text = $3::text)
               AND ($3::text IS NULL OR s.tenant_id::text = $3::text)
             LIMIT 1`,
            [clientId, siteId, tenantId]
        );

        if (scopeCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Client/site is outside your tenant scope' });
        }

        const result = await query(
            `INSERT INTO ingestion_jobs 
            (industry, client_id, site_id, status, total_files, created_by, progress, tenant_id)
            VALUES ($1, $2, $3, 'queued', $4, $5, 0, $6)
            RETURNING *`,
            [industry || 'Solar', clientId, siteId, totalFiles || 0, userId, tenantId]
        );

        const job = result.rows[0];

        // Log creation event
        await query(
            `INSERT INTO ingestion_events (job_id, level, message, meta) VALUES ($1, 'info', 'Upload job created', $2)`,
            [job.id, JSON.stringify({ user: userId, totalFiles })]
        );

        res.status(201).json({ success: true, data: job });
    } catch (err) {
        console.error('Error creating upload job:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * addFiles - Adds file metadata to a job (Multipart upload would handle binary storage separately)
 * POST /api/uploads/jobs/:id/files
 */
export const addFiles = async (req, res) => {
    const { id: jobId } = req.params;
    const { files } = req.body; // Expecting array of file metadata objects

    if (!files || !Array.isArray(files)) {
        return res.status(400).json({ success: false, message: 'Files array is required' });
    }

    try {
        const job = await getScopedJob(jobId, req);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Upload job not found' });
        }

        const insertedFiles = [];

        await transaction(async (client) => {
            for (const file of files) {
                const res = await client.query(
                    `INSERT INTO ingestion_files 
                    (job_id, filename, relative_path, file_size, mime_type, status)
                    VALUES ($1, $2, $3, $4, $5, 'uploaded')
                    RETURNING *`,
                    [jobId, file.name, file.path || '', file.size, file.type]
                );
                insertedFiles.push(res.rows[0]);
            }

            // Update job status if it was queued
            await client.query(
                `UPDATE ingestion_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1 AND status = 'queued'`,
                [jobId]
            );
        });

        res.status(201).json({ success: true, ui_message: `Registered ${insertedFiles.length} files`, data: insertedFiles });
    } catch (err) {
        console.error('Error adding files to job:', err);
        res.status(500).json({ success: false, message: 'Failed to record files' });
    }
};

/**
 * createException - Logs an exception and creates a finding/work item
 * POST /api/uploads/jobs/:id/exceptions
 */
export const createException = async (req, res) => {
    const { id: jobId } = req.params;
    const { fileId, type, severity, description, remediationSteps } = req.body;
    const userId = req.user.id;

    try {
        const job = await getScopedJob(jobId, req);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Upload job not found' });
        }

        await transaction(async (client) => {
            // 1. Create Ingestion Exception (Table name kept as is)
            const exResult = await client.query(
                `INSERT INTO ingestion_exceptions 
                (job_id, file_id, type, severity, description, remediation_steps, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'open')
                RETURNING *`,
                [jobId, fileId, type, severity, description, remediationSteps]
            );
            const exception = exResult.rows[0];

            // 2. Create Linked Work Item (Task for a human)
            // We assume work_items table exists from previous context
            await client.query(
                `INSERT INTO work_items 
                (title, description, status, priority, scope_type, scope_id, assigned_user_id, created_by_user_id)
                VALUES ($1, $2, 'todo', $3, 'upload_exception', $4, $5, $6)`,
                [
                    `Upload Exception: ${type}`,
                    `${description}\n\nRemediation: ${remediationSteps}`,
                    severity === 'critical' ? 'critical' : 'medium',
                    exception.id, // scope_id links to exception
                    userId, // Assign to creator for now, or null
                    userId
                ]
            );

            // 3. Log Event
            await client.query(
                `INSERT INTO ingestion_events (job_id, level, message, meta) VALUES ($1, 'error', 'Exception raised', $2)`,
                [jobId, JSON.stringify({ type, severity })]
            );
        });

        res.status(201).json({ success: true, message: 'Exception recorded and work item created' });
    } catch (err) {
        console.error('Error creating exception:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * getJob - Get job details
 * GET /api/uploads/jobs/:id
 */
export const getJob = async (req, res) => {
    const { id } = req.params;

    try {
        const job = await getScopedJob(id, req);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const filesRes = await query('SELECT * FROM ingestion_files WHERE job_id = $1 ORDER BY uploaded_at DESC', [id]);
        const eventsRes = await query('SELECT * FROM ingestion_events WHERE job_id = $1 ORDER BY created_at DESC', [id]);
        const exceptionsRes = await query('SELECT * FROM ingestion_exceptions WHERE job_id = $1 ORDER BY created_at DESC', [id]);

        res.json({
            success: true,
            data: {
                ...job,
                files: filesRes.rows,
                events: eventsRes.rows,
                exceptions: exceptionsRes.rows
            }
        });
    } catch (err) {
        console.error('Error fetching job:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * listJobs - List recent jobs
 * GET /api/uploads/jobs
 */
export const listJobs = async (req, res) => {
    const { clientId, siteId, start, limit = 20 } = req.query;
    const tenantId = tenantIdOf(req);

    // Basic filtering logic
    let queryText = 'SELECT * FROM ingestion_jobs WHERE (created_by = $1 OR $2::text IS NULL OR tenant_id::text = $2::text)';
    const queryParams = [req.user.id, tenantId];

    if (clientId) {
        queryParams.push(clientId);
        queryText += ` AND client_id = $${queryParams.length}`;
    }

    if (siteId) {
        queryParams.push(siteId);
        queryText += ` AND site_id = $${queryParams.length}`;
    }

    queryText += ' ORDER BY created_at DESC LIMIT $' + (queryParams.length + 1);
    queryParams.push(limit);

    try {
        await ensureIngestionTenantColumn();
        const result = await query(queryText, queryParams);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error listing jobs:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
