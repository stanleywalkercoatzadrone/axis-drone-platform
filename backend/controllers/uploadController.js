import { query, transaction } from '../config/database.js';

/**
 * createJob - Starts a new upload batch
 * POST /api/uploads/jobs
 */
export const createJob = async (req, res) => {
    const { industry, clientId, siteId, totalFiles } = req.body;
    const userId = req.user.id; // Assumes auth middleware

    if (!clientId || !siteId) {
        return res.status(400).json({ success: false, message: 'Client ID and Site ID are required' });
    }

    try {
        const result = await query(
            `INSERT INTO ingestion_jobs 
            (industry, client_id, site_id, status, total_files, created_by, progress)
            VALUES ($1, $2, $3, 'queued', $4, $5, 0)
            RETURNING *`,
            [industry || 'Solar', clientId, siteId, totalFiles || 0, userId]
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
        const jobRes = await query('SELECT * FROM ingestion_jobs WHERE id = $1', [id]);

        if (jobRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const filesRes = await query('SELECT * FROM ingestion_files WHERE job_id = $1 ORDER BY uploaded_at DESC', [id]);
        const eventsRes = await query('SELECT * FROM ingestion_events WHERE job_id = $1 ORDER BY created_at DESC', [id]);
        const exceptionsRes = await query('SELECT * FROM ingestion_exceptions WHERE job_id = $1 ORDER BY created_at DESC', [id]);

        res.json({
            success: true,
            data: {
                ...jobRes.rows[0],
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

    // Basic filtering logic
    let queryText = 'SELECT * FROM ingestion_jobs WHERE 1=1';
    const queryParams = [];

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
        const result = await query(queryText, queryParams);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error listing jobs:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
