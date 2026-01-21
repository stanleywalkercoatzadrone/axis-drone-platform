import { query, transaction } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { io } from '../server.js';
import { uploadFile } from '../services/storageService.js';
import { v4 as uuidv4 } from 'uuid';

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
            data: result.rows
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
       WHERE r.id = $1`,
            [id]
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
            data: report
        });
    } catch (error) {
        next(error);
    }
};

export const createReport = async (req, res, next) => {
    try {
        const { title, client, industry, theme, config, branding, images } = req.body;

        if (!title || !client || !industry) {
            throw new AppError('Please provide title, client, and industry', 400);
        }

        const report = await transaction(async (clientQuery) => {
            // 1. Create Report
            const reportResult = await clientQuery(
                `INSERT INTO reports (user_id, title, client, industry, theme, config, branding, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [req.user.id, title, client, industry, theme || 'TECHNICAL', JSON.stringify(config || {}), JSON.stringify(branding || {}), 'DRAFT']
            );

            const newReport = reportResult.rows[0];

            // 2. Handle Images if present
            if (images && Array.isArray(images)) {
                for (const img of images) {
                    let storageUrl = img.url;
                    let storageKey = null;

                    // If it's a base64 string, upload it
                    if (img.base64 && img.base64.startsWith('data:image')) {
                        const buffer = Buffer.from(img.base64.split(',')[1], 'base64');
                        const file = {
                            buffer,
                            originalname: `report_img_${Date.now()}.jpg`,
                            mimetype: img.base64.split(';')[0].split(':')[1]
                        };
                        const uploadResult = await uploadFile(file, `reports/${newReport.id}`);
                        storageUrl = uploadResult.url;
                        storageKey = uploadResult.key;
                    }

                    await clientQuery(
                        `INSERT INTO images (report_id, url, annotations, summary)
                         VALUES ($1, $2, $3, $4)`,
                        [newReport.id, storageUrl, JSON.stringify(img.annotations || []), img.summary || null]
                    );
                }
            }

            // 3. Create initial history entry
            await clientQuery(
                `INSERT INTO report_history (report_id, version, author, summary)
                 VALUES ($1, $2, $3, $4)`,
                [newReport.id, 1, req.user.full_name, 'Report created']
            );

            // 4. Log Audit
            await clientQuery(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.user.id, 'REPORT_CREATED', 'report', newReport.id, JSON.stringify({ title, industry })]
            );

            return newReport;
        });

        // Emit real-time event
        io.emit('report:created', { reportId: report.id, userId: req.user.id });

        res.status(201).json({
            success: true,
            data: report
        });
    } catch (error) {
        next(error);
    }
};

export const updateReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, client, summary, siteContext, strategicAssessment, config, branding, images, status } = req.body;

        const updatedReport = await transaction(async (clientQuery) => {
            // 1. Check if finalized (Locking)
            const currentReport = await clientQuery('SELECT status, version FROM reports WHERE id = $1', [id]);
            if (currentReport.rows.length > 0 && currentReport.rows[0].status === 'FINALIZED') {
                throw new AppError('Cannot edit a finalized report. Please create a new version.', 403);
            }

            // 2. Update Report info & Increment Version
            const result = await clientQuery(
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
                 WHERE id = $9 AND user_id = $10
                 RETURNING *`,
                [
                    title, client, summary,
                    siteContext ? JSON.stringify(siteContext) : null,
                    strategicAssessment ? JSON.stringify(strategicAssessment) : null,
                    config ? JSON.stringify(config) : null,
                    branding ? JSON.stringify(branding) : null,
                    status,
                    id, req.user.id
                ]
            );

            if (result.rows.length === 0) {
                throw new AppError('Report not found or not authorized', 404);
            }

            const report = result.rows[0];

            // 3. Log History Entry
            await clientQuery(
                `INSERT INTO report_history (report_id, version, author, summary)
                 VALUES ($1, $2, $3, $4)`,
                [id, report.version, req.user.full_name, 'Report updated']
            );

            // 4. Synchronize Images if provided
            if (images && Array.isArray(images)) {
                // For simplicity in draft saving, we'll clear and re-insert or update
                // Finer-grained diffing can be added later
                await clientQuery('DELETE FROM images WHERE report_id = $1', [id]);

                for (const img of images) {
                    let storageUrl = img.url;

                    if (img.base64 && img.base64.startsWith('data:image')) {
                        const buffer = Buffer.from(img.base64.split(',')[1], 'base64');
                        const file = {
                            buffer,
                            originalname: `report_img_${Date.now()}.jpg`,
                            mimetype: img.base64.split(';')[0].split(':')[1]
                        };
                        const uploadResult = await uploadFile(file, `reports/${id}`);
                        storageUrl = uploadResult.url;
                    }

                    await clientQuery(
                        `INSERT INTO images (report_id, url, annotations, summary)
                         VALUES ($1, $2, $3, $4)`,
                        [id, storageUrl, JSON.stringify(img.annotations || []), img.summary || null]
                    );
                }
            }

            // 3. Log Audit
            await clientQuery(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
                 VALUES ($1, $2, $3, $4)`,
                [req.user.id, 'REPORT_UPDATED', 'report', id]
            );

            return report;
        });

        io.emit('report:updated', { reportId: id, userId: req.user.id });

        res.json({
            success: true,
            data: updatedReport
        });
    } catch (error) {
        next(error);
    }
};

export const finalizeReport = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE reports
       SET status = 'FINALIZED',
           finalized_at = CURRENT_TIMESTAMP,
           version = version + 1
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Report not found or not authorized', 404);
        }

        const report = result.rows[0];

        await query(
            `INSERT INTO report_history (report_id, version, author, summary)
       VALUES ($1, $2, $3, $4)`,
            [id, report.version, req.user.full_name, 'Report finalized']
        );

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, $2, $3, $4)`,
            [req.user.id, 'REPORT_FINALIZED', 'report', id]
        );

        io.emit('report:finalized', { reportId: id, userId: req.user.id });

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        next(error);
    }
};

export const deleteReport = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(
            'DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, req.user.id]
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
