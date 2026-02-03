import { query, transaction } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { io } from '../app.js';
import { uploadFile } from '../services/storageService.js';
import { v4 as uuidv4 } from 'uuid';
// Helper to map DB columns to frontend camelCase
const mapReportToFrontend = (row) => ({
    id: row.id,
    rootId: row.id, // Assuming same for now
    version: row.version,
    title: row.title,
    client: row.client,
    industry: row.industry,
    theme: row.theme,
    status: row.status,
    approvalStatus: row.approval_status || 'Draft',
    date: row.created_at,
    summary: row.summary,
    siteContext: row.site_context,
    strategicAssessment: row.strategic_assessment,
    config: row.config,
    branding: row.branding,
    images: (row.images || []).map(img => ({
        id: img.id,
        url: img.storage_url || img.url,
        annotations: img.annotations || [],
        summary: img.summary
    })),
    history: row.history || [],
    authorName: row.author_name
});
export const getReports = async (req, res, next) => {
    try {
        const { status, industry } = req.query;

        let queryText = `
      SELECT r.*, u.full_name as author_name,
             (SELECT COUNT(*) FROM images WHERE report_id = r.id) as image_count
      FROM reports r
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
        const params = [];

        if (req.user.role !== 'ADMIN') {
            params.push(req.user.id);
            queryText += ` AND r.user_id = $${params.length}`;
        }

        // Mandatory Tenant Isolation
        params.push(req.user.tenantId);
        queryText += ` AND r.tenant_id = $${params.length}`;

        if (status) {
            params.push(status);
            queryText += ` AND r.status = $${params.length}`;
        }

        if (industry) {
            params.push(industry);
            queryText += ` AND r.industry = $${params.length}`;
        }

        queryText += ' ORDER BY r.created_at DESC';

        const result = await query(queryText, params);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows.map(mapReportToFrontend)
        });
    } catch (error) {
        next(error);
    }
};

export const getReport = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT r.*, u.full_name as author_name,
              (SELECT json_agg(i.*) FROM images i WHERE i.report_id = r.id) as images,
              (SELECT json_agg(h.*) FROM report_history h WHERE h.report_id = r.id ORDER BY h.timestamp DESC) as history
       FROM reports r
       JOIN users u ON r.user_id = u.id
       FROM reports r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1 AND r.tenant_id = $2`,
            [id, req.user.tenantId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Report not found', 404);
        }

        const report = result.rows[0];

        if (req.user.role !== 'ADMIN' && report.user_id !== req.user.id) {
            throw new AppError('Not authorized to access this report', 403);
        }

        res.json({
            success: true,
            data: mapReportToFrontend(report)
        });
    } catch (error) {
        next(error);
    }
};

export const createReport = async (req, res, next) => {
    try {
        const { title, client, industry, theme, config, branding, images, status } = req.body;

        if (!title || !client || !industry) {
            throw new AppError('Please provide title, client, and industry', 400);
        }

        // --- Security Hardenings & Payload Limits ---
        const MAX_IMAGES = 50;
        const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
        const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

        if (images && images.length > MAX_IMAGES) {
            throw new AppError(`Maximum ${MAX_IMAGES} images allowed per report`, 413);
        }

        const processedImages = [];
        const uploadedKeys = []; // Track for compensating deletes

        try {
            if (images && Array.isArray(images)) {
                for (const img of images) {
                    let storageUrl = img.url;
                    let storageKey = img.key || null;

                    if (img.base64 && img.base64.startsWith('data:image')) {
                        // 1. Validate Size (Pre-decode Guard)
                        const [header, base64Data] = img.base64.split(',');
                        const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_SIZE * 4 / 3) + 1024;
                        if (base64Data.length > MAX_BASE64_CHARS) {
                            throw new AppError('Image payload too large (DoS protection)', 413);
                        }

                        // 1b. Validate Type
                        const mimeMatch = header.match(/data:([^;]+);base64/);
                        const mimeType = mimeMatch ? mimeMatch[1] : null;

                        if (!ALLOWED_MIMES.includes(mimeType)) {
                            throw new AppError(`Unsupported image type: ${mimeType}`, 400);
                        }

                        const buffer = Buffer.from(base64Data, 'base64');
                        if (buffer.length > MAX_IMAGE_SIZE) {
                            throw new AppError('Image size exceeds 10MB limit', 413);
                        }

                        // 2. Magic Byte Sniffing
                        const signatures = {
                            'image/jpeg': [0xFF, 0xD8, 0xFF],
                            'image/png': [0x89, 0x50, 0x4E, 0x47],
                            'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF container
                        };

                        const expectedSig = signatures[mimeType];
                        if (expectedSig) {
                            for (let i = 0; i < expectedSig.length; i++) {
                                if (buffer[i] !== expectedSig[i]) {
                                    throw new AppError('Malicious image content detected (magic byte mismatch)', 400);
                                }
                            }
                        }

                        // Extra check for WebP WEBP header at bytes 8-11
                        if (mimeType === 'image/webp' && (
                            buffer[8] !== 0x57 || buffer[9] !== 0x45 ||
                            buffer[10] !== 0x42 || buffer[11] !== 0x50
                        )) {
                            throw new AppError('Invalid WebP container (missing WEBP header)', 400);
                        }

                        try {
                            const file = {
                                buffer,
                                originalname: `img_${uuidv4()}.jpg`, // UUID for safety
                                mimetype: mimeType
                            };

                            // User-specific staging path
                            const uploadResult = await uploadFile(file, `reports/staging/${req.user.id}`);
                            storageUrl = uploadResult.url;
                            storageKey = uploadResult.key;
                            uploadedKeys.push(storageKey);
                        } catch (uploadErr) {
                            console.error('Failed to upload image', uploadErr);
                            throw new AppError('Failed to upload image: ' + uploadErr.message, 500);
                        }
                    }

                    processedImages.push({
                        url: storageUrl,
                        key: storageKey,
                        annotations: img.annotations || [],
                        summary: img.summary
                    });
                }
            }

            const report = await transaction(async (client) => {
                // 3. Create Report (Tenant-Scoped)
                const reportResult = await client.query(
                    `INSERT INTO reports (user_id, tenant_id, title, client, industry, theme, config, branding, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING *`,
                    [
                        req.user.id,
                        req.user.tenantId || 'default',
                        title, client, industry,
                        theme || 'TECHNICAL',
                        JSON.stringify(config || {}),
                        JSON.stringify(branding || {}),
                        status || 'DRAFT'
                    ]
                );

                const newReport = reportResult.rows[0];

                // 4. Handle Images (DB inserts)
                if (processedImages.length > 0) {
                    for (const img of processedImages) {
                        await client.query(
                            `INSERT INTO images (report_id, url, storage_key, annotations, summary)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [newReport.id, img.url, img.key, JSON.stringify(img.annotations), img.summary || null]
                        );
                    }
                }

                // 5. Create initial history entry (using req.user.id/fullName from protect)
                await client.query(
                    `INSERT INTO report_history (report_id, version, author, author_id, summary)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [newReport.id, 1, req.user.fullName, req.user.id, 'Report created']
                );

                // 6. Log Audit
                await client.query(
                    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [req.user.id, 'REPORT_CREATED', 'report', newReport.id, JSON.stringify({ title, industry })]
                );

                return newReport;
            });

            // Emit scoped real-time event
            io.to(`user:${req.user.id}`).emit('report:created', { reportId: report.id });
            if (req.user.tenantId) {
                io.to(`tenant:${req.user.tenantId}`).emit('report:created', { reportId: report.id, author: req.user.fullName });
            }

            res.status(201).json({
                success: true,
                data: mapReportToFrontend(report)
            });

        } catch (error) {
            // --- Compensating Deletes on Failure ---
            console.error('⚠️ Transaction failed, cleaning up orphan storage objects...');
            const { deleteFile } = await import('../services/storageService.js');
            for (const key of uploadedKeys) {
                try {
                    await deleteFile(key);
                } catch (delErr) {
                    console.error(`Failed to delete orphan key ${key}:`, delErr);
                }
            }
            throw error; // Re-throw for global error handler
        }
    } catch (error) {
        next(error);
    }
};

export const updateReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, client, summary, siteContext, strategicAssessment, config, branding, images, status } = req.body;

        // 1. Process Images BEFORE Transaction (Pre-upload)
        let processedImages = null;
        if (images && Array.isArray(images)) {
            processedImages = [];
            for (const img of images) {
                let storageUrl = img.url;

                if (img.base64 && img.base64.startsWith('data:image')) {
                    try {
                        const buffer = Buffer.from(img.base64.split(',')[1], 'base64');
                        const file = {
                            buffer,
                            originalname: `report_img_${Date.now()}.jpg`,
                            mimetype: img.base64.split(';')[0].split(':')[1]
                        };
                        const uploadResult = await uploadFile(file, `reports/${id}`);
                        storageUrl = uploadResult.url;
                    } catch (uploadErr) {
                        console.error('Failed to upload image', uploadErr);
                        throw new AppError('Failed to upload image: ' + uploadErr.message, 500);
                    }
                }

                processedImages.push({
                    url: storageUrl,
                    annotations: img.annotations || [],
                    summary: img.summary
                });
            }
        }

        const updatedReport = await transaction(async (client) => {
            // 2. Check if finalized (Locking)
            const currentReport = await client.query('SELECT status, version FROM reports WHERE id = $1', [id]);
            if (currentReport.rows.length === 0) {
                throw new AppError('Report not found', 404);
            }
            const currentStatus = currentReport.rows[0].status;

            if (currentStatus === 'FINALIZED') {
                throw new AppError('Cannot edit a finalized report. Please create a new version.', 403);
            }

            // 2b. Enforce Status Flow & RBAC
            if (status && status !== currentStatus) {
                const role = req.user.role;

                // Prevent backward transitions for non-admins (optional, but good practice)
                if (currentStatus === 'APPROVED' && status === 'DRAFT' && role !== 'ADMIN') {
                    throw new AppError('Only Admins can revert an Approved report to Draft.', 403);
                }

                // DRAFT -> REVIEW
                if (status === 'REVIEW') {
                    // Allowed for everyone with edit access
                }

                // REVIEW -> APPROVED
                if (status === 'APPROVED') {
                    if (role !== 'ADMIN' && role !== 'SENIOR_INSPECTOR') {
                        throw new AppError('Only Senior Inspectors or Admins can approve reports.', 403);
                    }
                }

                // APPROVED -> FINALIZED
                if (status === 'FINALIZED') {
                    throw new AppError('Use the finalize endpoint to finalize reports.', 400);
                }
            }

            // 3. Update Report info & Increment Version
            const result = await client.query(
                `UPDATE reports
                 SET title = COALESCE($1, title),
                     client = COALESCE($2, client),
                     summary = COALESCE($3, summary),
                     site_context = COALESCE($4, site_context),
                     strategic_assessment = COALESCE($5, strategic_assessment),
                     config = COALESCE($6, config),
                     branding = COALESCE($7, branding),
                     status = COALESCE($8, status),
                     version = version + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $9 AND tenant_id = $12 AND (user_id = $10 OR $11 = 'ADMIN')
                 RETURNING *`,
                [
                    title, client, summary,
                    siteContext ? JSON.stringify(siteContext) : null,
                    strategicAssessment ? JSON.stringify(strategicAssessment) : null,
                    config ? JSON.stringify(config) : null,
                    branding ? JSON.stringify(branding) : null,
                    status,
                    status,
                    id, req.user.id, req.user.role, req.user.tenantId
                ]
            );

            if (result.rows.length === 0) {
                throw new AppError('Report not found or not authorized', 404);
            }

            const report = result.rows[0];

            // 4. Log History Entry
            await client.query(
                `INSERT INTO report_history (report_id, version, author, summary)
                 VALUES ($1, $2, $3, $4)`,
                [id, report.version, req.user.full_name, 'Report updated']
            );

            // 5. Synchronize Images (using pre-processed list)
            if (processedImages) {
                // Clear existing
                await client.query('DELETE FROM images WHERE report_id = $1', [id]);

                // Insert new/kept
                for (const img of processedImages) {
                    await client.query(
                        `INSERT INTO images (report_id, url, annotations, summary)
                         VALUES ($1, $2, $3, $4)`,
                        [id, img.url, JSON.stringify(img.annotations), img.summary || null]
                    );
                }
            }

            // 3. Log Audit
            await client.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
                 VALUES ($1, $2, $3, $4)`,
                [req.user.id, 'REPORT_UPDATED', 'report', id]
            );

            return report;
        });

        io.emit('report:updated', { reportId: id, userId: req.user.id });

        res.json({
            success: true,
            data: mapReportToFrontend(updatedReport)
        });
    } catch (error) {
        next(error);
    }
};

export const finalizeReport = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Permission Check (Allow Admin OR Owner with finalize permission)
        const canFinalizeAny = req.user.role === 'ADMIN' || req.user.role === 'SENIOR_INSPECTOR' || req.user.permissions?.includes('FINALIZE_REPORT_ANY');
        const hasPermission = canFinalizeAny || req.user.permissions?.includes('FINALIZE_REPORT');

        if (!hasPermission) {
            throw new AppError('You do not have permission to finalize reports', 403);
        }

        if (!req.user.tenantId) {
            throw new AppError('Tenant context is required to finalize reports', 400);
        }

        const updated = await transaction(async (client) => {
            const check = await client.query(
                `SELECT status, user_id
         FROM reports
         WHERE id = $1 AND tenant_id = $2`,
                [id, req.user.tenantId]
            );

            if (check.rows.length === 0) throw new AppError('Report not found or tenant mismatch', 404);

            const current = check.rows[0];

            if (!canFinalizeAny && current.user_id !== req.user.id) {
                throw new AppError('Not authorized to finalize this report', 403);
            }

            if (!['REVIEW', 'APPROVED'].includes(current.status)) {
                throw new AppError(`Cannot finalize report in ${current.status} status`, 400);
            }

            const updateResult = await client.query(
                `UPDATE reports
         SET status = 'FINALIZED',
             finalized_at = CURRENT_TIMESTAMP,
             version = version + 1
         WHERE id = $1
           AND tenant_id = $2
           AND status IN ('REVIEW', 'APPROVED')
         RETURNING *`,
                [id, req.user.tenantId]
            );

            if (updateResult.rows.length === 0) {
                console.warn(`P1: FINALIZE_CONFLICT user=${req.user.id} report=${id} tenant=${req.user.tenantId} status=${current.status}`);
                throw new AppError('Finalization conflict (it may have been updated by another process)', 409);
            }

            const report = updateResult.rows[0];

            // 5. Sync Version History (Transactional)
            await client.query(
                `INSERT INTO report_history (report_id, version, author, author_id, summary)
         VALUES ($1, $2, $3, $4, $5)`,
                [id, report.version, req.user.fullName, req.user.id, 'Report finalized']
            );

            // 6. Log Audit (Transactional)
            await client.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
                [req.user.id, 'REPORT_FINALIZED', 'report', id, JSON.stringify({ version: report.version })]
            );

            return report;
        });

        // 7. Scoped real-time events
        io.to(`user:${req.user.id}`).emit('report:finalized', { reportId: id, version: updated.version });
        if (req.user.tenantId) {
            io.to(`tenant:${req.user.tenantId}`).emit('report:finalized', { reportId: id, author: req.user.fullName, version: updated.version });
        }

        res.json({
            success: true,
            data: mapReportToFrontend(updated)
        });
    } catch (error) {
        next(error);
    }
};

export const deleteReport = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(
            'DELETE FROM reports WHERE id = $1 AND tenant_id = $2 AND (user_id = $3 OR $4 = \'ADMIN\') RETURNING id',
            [id, req.user.tenantId, req.user.id, req.user.role]
        );

        if (result.rows.length === 0) {
            throw new AppError('Report not found or not authorized', 404);
        }

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'REPORT_DELETED', 'report', id]
        );

        res.json({
            success: true,
            message: 'Report deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
