import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Claims Pricing Engine Controller
 * Manages the Xactimate-style pricing catalog and claims report line items
 */

// --- CATALOG MANAGEMENT ---

// Get all pricing categories
export const getPricingCategories = async (req, res, next) => {
    try {
        const result = await query(`SELECT * FROM claim_pricing_categories ORDER BY code ASC`);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

// Get items in a category or search all items
export const getPricingItems = async (req, res, next) => {
    try {
        const { categoryCode, search } = req.query;
        let queryStr = `
            SELECT i.*, c.code as category_code, c.name as category_name
            FROM claim_pricing_items i
            JOIN claim_pricing_categories c ON i.category_id = c.id
        `;
        const params = [];

        if (categoryCode) {
            params.push(categoryCode);
            queryStr += ` WHERE c.code = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            queryStr += params.length === 1 ? ' WHERE ' : ' AND ';
            queryStr += `(i.item_code ILIKE $${params.length} OR i.description ILIKE $${params.length})`;
        }

        queryStr += ` ORDER BY i.item_code ASC`;

        const result = await query(queryStr, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};


// --- REPORT LINE ITEMS MANAGEMENT ---

// Get line items for a specific report
export const getReportLineItems = async (req, res, next) => {
    try {
        const { reportId } = req.params;

        // Ensure user has access to this report
        const authCheck = await query(`SELECT id FROM claims_reports WHERE id = $1 AND tenant_id = $2`, [reportId, req.user.tenantId]);
        if (authCheck.rows.length === 0) throw new AppError('Report not found or access denied', 404);

        const result = await query(
            `SELECT * FROM claims_report_line_items WHERE report_id = $1 ORDER BY created_at ASC`,
            [reportId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

// Add a line item to a report
export const addReportLineItem = async (req, res, next) => {
    try {
        const { reportId } = req.params;
        const { pricingItemId, itemCode, description, unit, quantity, unitCost, note } = req.body;

        // Ensure user has access
        const authCheck = await query(`SELECT id FROM claims_reports WHERE id = $1 AND tenant_id = $2`, [reportId, req.user.tenantId]);
        if (authCheck.rows.length === 0) throw new AppError('Report not found or access denied', 404);

        // If pricingItemId is provided, we could look up default values here, 
        // but typically the frontend will pass them in so we just save exactly what they approve.

        const result = await query(
            `INSERT INTO claims_report_line_items 
            (report_id, pricing_item_id, item_code, description, unit, quantity, unit_cost, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [reportId, pricingItemId || null, itemCode, description, unit, quantity, unitCost, note || null]
        );

        // Update the total estimate on the report
        await updateTotalEstimate(reportId);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

// Update an existing line item (e.g., change quantity)
export const updateReportLineItem = async (req, res, next) => {
    try {
        const { reportId, itemId } = req.params;
        const { quantity, unitCost, note } = req.body;

        const authCheck = await query(`SELECT id FROM claims_reports WHERE id = $1 AND tenant_id = $2`, [reportId, req.user.tenantId]);
        if (authCheck.rows.length === 0) throw new AppError('Report not found or access denied', 404);

        const result = await query(
            `UPDATE claims_report_line_items 
             SET quantity = COALESCE($1, quantity),
                 unit_cost = COALESCE($2, unit_cost),
                 note = COALESCE($3, note),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND report_id = $5
             RETURNING *`,
            [quantity, unitCost, note, itemId, reportId]
        );

        if (result.rows.length === 0) throw new AppError('Line item not found', 404);

        await updateTotalEstimate(reportId);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

// Delete a line item
export const deleteReportLineItem = async (req, res, next) => {
    try {
        const { reportId, itemId } = req.params;

        const authCheck = await query(`SELECT id FROM claims_reports WHERE id = $1 AND tenant_id = $2`, [reportId, req.user.tenantId]);
        if (authCheck.rows.length === 0) throw new AppError('Report not found or access denied', 404);

        const result = await query(
            `DELETE FROM claims_report_line_items WHERE id = $1 AND report_id = $2 RETURNING id`,
            [itemId, reportId]
        );

        if (result.rows.length === 0) throw new AppError('Line item not found', 404);

        await updateTotalEstimate(reportId);

        res.json({ success: true, message: 'Line item deleted' });
    } catch (error) {
        next(error);
    }
};

// Helper function to recalculate and update the claims_reports table's total_damage_estimate
const updateTotalEstimate = async (reportId) => {
    await query(
        `UPDATE claims_reports 
         SET total_damage_estimate = (
             SELECT COALESCE(SUM(total_cost), 0) 
             FROM claims_report_line_items 
             WHERE report_id = $1
         )
         WHERE id = $1`,
        [reportId]
    );
};
