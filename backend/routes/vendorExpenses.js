import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/', async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;
        const result = await query(
            `SELECT *
             FROM vendor_expenses
             WHERE ($1::uuid IS NULL OR tenant_id = $1)
             ORDER BY inv_date DESC, created_at DESC
             LIMIT 500`,
            [tenantId || null]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            vendorName, projectName, invNumber, invDate, invStatus = 'Unpaid',
            paymentDate, invoiceAmount = 0, stanleyAddon = 0,
            paidToVendor = 0, paidToStanley = 0, notes,
        } = req.body || {};

        if (!vendorName || !projectName || !invDate) {
            return res.status(400).json({ success: false, message: 'vendorName, projectName, and invDate are required' });
        }

        const result = await query(
            `INSERT INTO vendor_expenses
                (vendor_name, project_name, inv_number, inv_date, inv_status,
                 payment_date, invoice_amount, stanley_addon, paid_to_vendor,
                 paid_to_stanley, notes, tenant_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
                vendorName, projectName, invNumber || null, invDate, invStatus,
                paymentDate || null, invoiceAmount, stanleyAddon, paidToVendor,
                paidToStanley, notes || null, req.user?.tenantId || null,
            ]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const allowed = {
            vendorName: 'vendor_name',
            projectName: 'project_name',
            invNumber: 'inv_number',
            invDate: 'inv_date',
            invStatus: 'inv_status',
            paymentDate: 'payment_date',
            invoiceAmount: 'invoice_amount',
            stanleyAddon: 'stanley_addon',
            paidToVendor: 'paid_to_vendor',
            paidToStanley: 'paid_to_stanley',
            notes: 'notes',
        };
        const entries = Object.entries(req.body || {}).filter(([key]) => allowed[key]);
        if (!entries.length) {
            return res.status(400).json({ success: false, message: 'No valid fields provided' });
        }

        const sets = entries.map(([key], idx) => `${allowed[key]} = $${idx + 1}`);
        const params = entries.map(([, value]) => value);
        params.push(req.params.id, req.user?.tenantId || null);

        const result = await query(
            `UPDATE vendor_expenses
             SET ${sets.join(', ')}, updated_at = NOW()
             WHERE id = $${params.length - 1}
               AND ($${params.length}::uuid IS NULL OR tenant_id = $${params.length})
             RETURNING *`,
            params
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Vendor expense not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await query(
            `DELETE FROM vendor_expenses
             WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)
             RETURNING id`,
            [req.params.id, req.user?.tenantId || null]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Vendor expense not found' });
        res.json({ success: true, message: 'Vendor expense deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
