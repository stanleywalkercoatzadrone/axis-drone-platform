import { query } from '../config/database.js';
import { logger } from '../services/logger.js';
import { extractBankDetailsFromForm } from '../services/geminiService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get documents with optional filters
 * GET /api/documents?missionId=...&personnelId=...&type=...
 */
export const getDocuments = async (req, res) => {
    try {
        const { missionId, personnelId, type } = req.query;
        let queryText = `
            SELECT d.*, u.full_name as uploaded_by_name 
            FROM documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (missionId) {
            queryText += ` AND d.mission_id = $${paramCount}`;
            params.push(missionId);
            paramCount++;
        }

        if (personnelId) {
            queryText += ` AND d.personnel_id = $${paramCount}`;
            params.push(personnelId);
            paramCount++;
        }

        if (type) {
            queryText += ` AND d.type = $${paramCount}`;
            params.push(type);
            paramCount++;
        }

        // Add sorting
        queryText += ` ORDER BY d.created_at DESC`;

        const result = await query(queryText, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        logger.error('Error fetching documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: error.message
        });
    }
};

/**
 * Upload a document
 * POST /api/documents/upload
 */
export const uploadDocument = async (req, res) => {
    try {
        const { missionId, personnelId, type } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const id = uuidv4();
        const filename = file.originalname;
        const size = file.size;
        const buffer = file.buffer;
        const uploadedBy = req.user?.id;

        // 1. Save to Database (Simplified for now, assuming local storage or similar)
        // In a real app, you'd upload to S3/GCS here
        const storageUrl = `/uploads/${id}_${filename}`;

        const insertQuery = `
            INSERT INTO documents (id, mission_id, personnel_id, type, filename, size, storage_url, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const result = await query(insertQuery, [id, missionId, personnelId, type, filename, size, storageUrl, uploadedBy]);

        // 2. AI Auto-Populate if this is a Direct Deposit form
        if (type === 'direct_deposit_form' && personnelId) {
            try {
                const bankInfo = await extractBankDetailsFromForm(buffer);
                if (bankInfo) {
                    await query(
                        `UPDATE personnel SET 
                        bank_name = COALESCE($1, bank_name),
                        routing_number = COALESCE($2, routing_number),
                        account_number = COALESCE($3, account_number)
                        WHERE id = $4`,
                        [bankInfo.bankName, bankInfo.routingNumber, bankInfo.accountNumber, personnelId]
                    );
                }
            } catch (aiError) {
                logger.error('AI Bank Extraction error (continuing):', aiError);
            }
        }

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        logger.error('Error uploading document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document',
            error: error.message
        });
    }
};

/**
 * Delete a document
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query('DELETE FROM documents WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        logger.error('Error deleting document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document',
            error: error.message
        });
    }
};
