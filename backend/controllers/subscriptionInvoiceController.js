import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

// Plan pricing defaults (can be overridden per invoice)
const PLAN_PRICES = {
    free:       { monthly: 0,    annual: 0     },
    starter:    { monthly: 299,  annual: 2990  },
    pro:        { monthly: 599,  annual: 5990  },
    enterprise: { monthly: 1499, annual: 14990 },
};

/**
 * GET /api/subscription-invoices
 * List all subscription invoices across all tenants (Coatzadrone admin only)
 */
export const getAllSubscriptionInvoices = async (req, res, next) => {
    try {
        const { status, tenantSlug } = req.query;
        const params = [];
        let q = `
            SELECT si.*, t.name as tenant_name, t.plan as tenant_plan, t.owner_email
            FROM subscription_invoices si
            JOIN tenants t ON si.tenant_slug = t.slug
            WHERE 1=1
        `;
        if (status) { params.push(status); q += ` AND si.status = $${params.length}`; }
        if (tenantSlug) { params.push(tenantSlug); q += ` AND si.tenant_slug = $${params.length}`; }
        q += ` ORDER BY si.created_at DESC`;

        const result = await query(q, params);
        res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
};

/**
 * GET /api/subscription-invoices/tenants
 * Summary of all tenants with their billing status
 */
export const getTenantBillingSummary = async (req, res, next) => {
    try {
        const result = await query(`
            SELECT
                t.id, t.name, t.slug, t.plan, t.status, t.owner_email, t.created_at,
                COUNT(si.id) as invoice_count,
                MAX(si.created_at) as last_invoice_at,
                SUM(CASE WHEN si.status = 'paid' THEN si.amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN si.status IN ('sent','overdue') THEN si.amount ELSE 0 END) as total_outstanding,
                MAX(CASE WHEN si.status = 'paid' THEN si.paid_at END) as last_paid_at
            FROM tenants t
            LEFT JOIN subscription_invoices si ON si.tenant_slug = t.slug
            WHERE t.slug != 'coatzadrone'
            GROUP BY t.id, t.name, t.slug, t.plan, t.status, t.owner_email, t.created_at
            ORDER BY t.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
};

/**
 * GET /api/subscription-invoices/:tenantSlug
 * List all invoices for a specific tenant
 */
export const getTenantInvoices = async (req, res, next) => {
    try {
        const { tenantSlug } = req.params;
        const result = await query(
            `SELECT si.*, t.name as tenant_name, t.owner_email
             FROM subscription_invoices si
             JOIN tenants t ON si.tenant_slug = t.slug
             WHERE si.tenant_slug = $1
             ORDER BY si.created_at DESC`,
            [tenantSlug]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
};

/**
 * POST /api/subscription-invoices
 * Generate a new subscription invoice for a tenant
 */
export const createSubscriptionInvoice = async (req, res, next) => {
    try {
        const {
            tenantSlug,
            amount,
            billingCycle = 'monthly',   // monthly | annual
            description,
            periodStart,
            periodEnd,
            dueDays = 30,
            notes
        } = req.body;

        if (!tenantSlug) return next(new AppError('tenantSlug is required', 400));

        // Fetch tenant
        const tenantRes = await query('SELECT * FROM tenants WHERE slug = $1', [tenantSlug]);
        if (tenantRes.rows.length === 0) return next(new AppError('Tenant not found', 404));
        const tenant = tenantRes.rows[0];

        // Resolve amount
        // Block invoice generation for free plan tenants
        if (tenant.plan === 'free' && !amount) {
            return res.status(400).json({ success: false, message: 'This tenant is on a free plan. Override the amount to generate a custom invoice if needed.' });
        }
        const planPrices = PLAN_PRICES[tenant.plan] || PLAN_PRICES.starter;
        const finalAmount = amount || (billingCycle === 'annual' ? planPrices.annual : planPrices.monthly);

        // Auto-generate invoice number
        const numRes = await query(`SELECT generate_invoice_number() as num`);
        const invoiceNumber = numRes.rows[0].num;

        // Default period = current month
        const now = new Date();
        const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const end = periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);

        const defaultDescription = `Axis Platform — ${tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)} Plan (${billingCycle})`;

        const result = await query(
            `INSERT INTO subscription_invoices
                (tenant_slug, invoice_number, plan, amount, description, period_start, period_end, due_date, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
             RETURNING *`,
            [tenantSlug, invoiceNumber, tenant.plan, finalAmount, description || defaultDescription, start, end, dueDate.toISOString().slice(0, 10), notes || null]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) { next(err); }
};

/**
 * PUT /api/subscription-invoices/:id/status
 * Update invoice status (sent, paid, void, overdue)
 */
export const updateInvoiceStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const VALID = ['draft', 'sent', 'paid', 'overdue', 'void'];
        if (!VALID.includes(status)) return next(new AppError(`Status must be one of: ${VALID.join(', ')}`, 400));

        const updates = { status, updated_at: new Date() };
        if (status === 'paid') updates.paid_at = new Date();
        if (status === 'sent') updates.sent_at = new Date();

        const result = await query(
            `UPDATE subscription_invoices
             SET status = $1,
                 paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
                 sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) return next(new AppError('Invoice not found', 404));
        res.json({ success: true, data: result.rows[0] });
    } catch (err) { next(err); }
};

/**
 * DELETE /api/subscription-invoices/:id
 * Void/delete a draft invoice
 */
export const deleteSubscriptionInvoice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const check = await query('SELECT status FROM subscription_invoices WHERE id = $1', [id]);
        if (check.rows.length === 0) return next(new AppError('Invoice not found', 404));
        if (check.rows[0].status === 'paid') return next(new AppError('Cannot delete a paid invoice. Void it instead.', 400));

        await query('DELETE FROM subscription_invoices WHERE id = $1', [id]);
        res.json({ success: true, message: 'Invoice deleted' });
    } catch (err) { next(err); }
};
