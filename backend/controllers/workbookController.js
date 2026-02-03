import * as XLSX from 'xlsx';
import { query, transaction } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { findUserBySearch } from '../services/userService.js';

export const uploadWorkbook = async (req, res, next) => {
    try {
        if (!req.file) throw new AppError('No file uploaded', 400);

        const { scopeType, scopeId, mappingTemplateId } = req.body;

        // Parse workbook
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rows.length === 0) throw new AppError('Spreadsheet is empty', 400);

        // Fetch mapping template if provided
        let mapping = null;
        if (mappingTemplateId) {
            const tempResult = await query('SELECT mapping_json FROM mapping_templates WHERE id = $1', [mappingTemplateId]);
            if (tempResult.rows.length > 0) mapping = tempResult.rows[0].mapping_json;
        }

        res.status(200).json({
            success: true,
            data: {
                rowCount: rows.length,
                columns: Object.keys(rows[0]),
                preview: rows.slice(0, 5),
                mapping
            }
        });
    } catch (error) {
        next(error);
    }
};

export const processWorkbook = async (req, res, next) => {
    try {
        const { rows, mapping, scopeType, scopeId, filename, storageUrl, mappingTemplateId } = req.body;

        if (!rows || !mapping) throw new AppError('Missing data for processing', 400);

        const summary = {
            total: rows.length,
            imported: 0,
            skipped: 0,
            unassigned: 0,
            errors: []
        };

        await transaction(async (client) => {
            // 1. Create workbook record
            const wbResult = await client.query(
                `INSERT INTO workbooks (scope_type, scope_id, filename, storage_url, mapping_template_id, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [scopeType, scopeId, filename, storageUrl, mappingTemplateId || null, req.user.id]
            );
            const workbookId = wbResult.rows[0].id;

            // 2. Process rows
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                try {
                    const title = row[mapping.title];
                    const description = row[mapping.description] || '';
                    const assignedTo = row[mapping.assignedTo];
                    const externalId = mapping.externalId ? row[mapping.externalId] : null;
                    const dueDate = mapping.dueDate ? row[mapping.dueDate] : null;
                    const priority = mapping.priority ? row[mapping.priority] : 'medium';

                    if (!title) {
                        summary.skipped++;
                        summary.errors.push(`Row ${i + 1}: Missing title`);
                        continue;
                    }

                    // Resolve assignment
                    let userId = null;
                    if (assignedTo) {
                        userId = await findUserBySearch(assignedTo);
                        if (!userId) summary.unassigned++;
                    } else {
                        summary.unassigned++;
                    }

                    await client.query(
                        `INSERT INTO work_items (
                            workbook_id, scope_type, scope_id, row_number, external_row_id,
                            title, description, assigned_user_id, due_date, priority
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            workbookId, scopeType, scopeId, i + 1, externalId,
                            title, description, userId, dueDate, priority
                        ]
                    );
                    summary.imported++;
                } catch (rowError) {
                    summary.skipped++;
                    summary.errors.push(`Row ${i + 1}: ${rowError.message}`);
                }
            }
        });

        res.status(201).json({
            success: true,
            data: summary
        });
    } catch (error) {
        next(error);
    }
};

export const getMappingTemplates = async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM mapping_templates ORDER BY created_at DESC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

export const saveMappingTemplate = async (req, res, next) => {
    try {
        const { name, scopeType, scopeId, mappingJson } = req.body;
        const result = await query(
            'INSERT INTO mapping_templates (name, scope_type, scope_id, mapping_json) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, scopeType, scopeId, JSON.stringify(mappingJson)]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

export const getWorkbookHistory = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM workbooks ORDER BY created_at DESC'
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};
