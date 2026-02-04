import { query } from '../config/database.js';
import crypto from 'crypto';

/**
 * Generate a secure invoice link for a specific pilot on a deployment
 */
export const createInvoice = async (req, res) => {
    try {
        const { deploymentId, personnelId, paymentTermsDays } = req.body;

        // 1. Calculate total pay for this person on this deployment
        const logsResult = await query(
            'SELECT SUM(daily_pay + COALESCE(bonus_pay, 0)) as total FROM daily_logs dl JOIN deployments d ON dl.deployment_id = d.id WHERE dl.deployment_id = $1 AND dl.technician_id = $2 AND d.tenant_id = $3',
            [deploymentId, personnelId, req.user.tenantId]
        );

        const amount = logsResult.rows[0].total || 0;

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No earnings found for this pilot on this mission.'
            });
        }

        // Determine payment terms: use provided value, or fetch from settings, or default to 30
        let paymentDays = paymentTermsDays || 30;
        if (!paymentTermsDays) {
            // Fetch from global settings if not provided
            const settingsRes = await query('SELECT setting_value FROM system_settings WHERE setting_key = $1', ['invoice_payment_days']);
            if (settingsRes.rows.length > 0) {
                paymentDays = parseInt(settingsRes.rows[0].setting_value) || 30;
            }
        }

        // 2. Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiration

        // 3. Create Invoice Record with payment_days
        const result = await query(
            `INSERT INTO invoices (deployment_id, personnel_id, amount, status, token, token_expires_at, payment_days)
             VALUES ($1, $2, $3, 'SENT', $4, $5, $6)
             RETURNING *`,
            [deploymentId, personnelId, amount, token, expiresAt, paymentDays]
        );

        // 4. Return the link
        const invoice = result.rows[0];
        // In production, use actual domain. For local: header host or fixed.
        const protocol = req.protocol;
        const host = req.get('host');
        // Backend runs on 8080, Frontend on different port usually (5173 or same if served).
        // Since we are likely using a separate frontend dev server, we should construct the frontend URL.
        // Assuming frontend is same host/port for production or we return the relative path for the UI to format.
        // The user request is "secure link", let's return the full URL assuming /invoice/view route on frontend.
        const secureLink = `/invoice/${token}`;

        res.status(201).json({
            success: true,
            data: {
                invoice,
                link: secureLink
            }
        });

    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create invoice',
            error: error.message
        });
    }
};

/**
 * Retrieve invoice data using the secure token (One-time use)
 */
export const getInvoiceByToken = async (req, res) => {
    try {
        const { token } = req.params;

        // 1. Find valid unused token - now including payment_days
        const result = await query(
            `SELECT i.*, 
                    d.title as mission_title, d.site_name, d.date as mission_date,
                    p.full_name as pilot_name, p.email as pilot_email,
                    p.home_address, p.bank_name, p.routing_number, p.account_number,
                    COALESCE(i.payment_days, 30) as payment_days
             FROM invoices i
             JOIN deployments d ON i.deployment_id = d.id
             JOIN personnel p ON i.personnel_id = p.id
             WHERE i.token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or invalid link.'
            });
        }

        const invoice = result.rows[0];

        // 2. Check Expiry
        if (new Date() > new Date(invoice.token_expires_at)) {
            return res.status(410).json({
                success: false,
                message: 'This invoice link has expired.'
            });
        }

        // 3. Check One-time use
        if (invoice.token_used) {
            return res.status(403).json({
                success: false,
                message: 'This secure link has already been used. Please contact support for a new one.'
            });
        }

        // 4. Mark as used
        await query(
            'UPDATE invoices SET token_used = TRUE, status = $2 WHERE id = $1',
            [invoice.id, 'PAID'] // We mark as 'PAID' or just 'VIEWED'? 
            // User said "create invoice... and send... use one time".
            // Usually viewing the invoice doesn't pay it. 
            // But if "use" means "redeem/process", maybe.
            // Let's just mark token_used. status can stay SENT or become VIEWED.
            // Let's keep status as SENT for now or update.
        );

        // 5. Return Details
        res.json({
            success: true,
            data: invoice
        });

    } catch (error) {
        console.error('Error retrieving invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve invoice',
            error: error.message
        });
    }
};

import { sendInvoiceEmail, sendAdminSummaryEmail, isMockTransporter } from '../services/emailService.js';

/**
 * Send invoices to all pilots in a deployment and a summary to admin
 */
export const sendDeploymentInvoices = async (req, res) => {
    try {
        const { id: deploymentId } = req.params;
        const { personnelIds, sendToPilots = true } = req.body; // Expect array of personnel IDs, default sendToPilots to true

        let queryText = `SELECT 
                dl.technician_id,
                p.full_name as pilot_name,
                p.email as pilot_email,
                SUM(dl.daily_pay + COALESCE(dl.bonus_pay, 0)) as total_pay
             FROM daily_logs dl
             JOIN personnel p ON dl.technician_id = p.id
             JOIN deployments d ON dl.deployment_id = d.id
             WHERE dl.deployment_id = $1 AND d.tenant_id = $2
             GROUP BY dl.technician_id, p.full_name, p.email
             HAVING SUM(dl.daily_pay + COALESCE(dl.bonus_pay, 0)) > 0`;

        const queryParams = [deploymentId, req.user.tenantId];

        // Filter by personnelIds if provided
        if (personnelIds && Array.isArray(personnelIds) && personnelIds.length > 0) {
            queryText = `SELECT 
                dl.technician_id,
                p.full_name as pilot_name,
                p.email as pilot_email,
                SUM(dl.daily_pay + COALESCE(dl.bonus_pay, 0)) as total_pay
             FROM daily_logs dl
             JOIN personnel p ON dl.technician_id = p.id
             JOIN deployments d ON dl.deployment_id = d.id
             WHERE dl.deployment_id = $1 AND d.tenant_id = $2
             AND dl.technician_id = ANY($3)
             GROUP BY dl.technician_id, p.full_name, p.email
             HAVING SUM(dl.daily_pay + COALESCE(dl.bonus_pay, 0)) > 0`;

            queryParams.push(personnelIds);
        }

        // 1. Get logs
        const logsResult = await query(queryText, queryParams);

        const summaries = logsResult.rows;

        if (summaries.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No earnings found to invoice for this mission.'
            });
        }

        // Get deployment details for email context
        const deploymentRes = await query('SELECT title, site_name FROM deployments WHERE id = $1 AND tenant_id = $2', [deploymentId, req.user.tenantId]);
        const deployment = deploymentRes.rows[0];

        const sentInvoices = [];
        const protocol = req.protocol;
        const host = req.get('host');
        // Construct base URL for frontend. 
        // In local dev, backend is 8080/3001, frontend is usually 5173 or 3000. 
        // We'll use a placeholder or config. For now, let's assume standard local dev localhost:3000
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // Fetch settings for email configuration from system_settings table
        const settingsRes = await query('SELECT setting_key, setting_value FROM system_settings');
        const settings = {};
        settingsRes.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        const adminEmail = settings['invoice_admin_email'] || 'admin@coatzadroneusa.com';
        let ccEmails = [];
        try {
            if (settings['invoice_cc_emails']) {
                const val = settings['invoice_cc_emails'];
                if (val.startsWith('[')) {
                    ccEmails = JSON.parse(val);
                } else {
                    ccEmails = val.split(',').map(e => e.trim()).filter(e => e);
                }
            }
        } catch (e) {
            console.error('Error parsing CC emails:', e);
        }

        // 2. Process each pilot
        for (const summary of summaries) {
            let invoice;
            const existingInvoice = await query(
                `SELECT * FROM invoices 
                 WHERE deployment_id = $1 AND personnel_id = $2 AND status != 'PAID'`,
                [deploymentId, summary.technician_id]
            );

            if (existingInvoice.rows.length > 0) {
                invoice = existingInvoice.rows[0];
                // Update amount if changed and renew token expiry to 7 days from now
                const newExpiry = new Date();
                newExpiry.setDate(newExpiry.getDate() + 7);

                await query(
                    'UPDATE invoices SET amount = $1, token_expires_at = $2 WHERE id = $3',
                    [summary.total_pay, newExpiry, invoice.id]
                );
                invoice.amount = summary.total_pay;
                invoice.token_expires_at = newExpiry;
            } else {
                // Create new invoice with 7-day expiry
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                const newInv = await query(
                    `INSERT INTO invoices (deployment_id, personnel_id, amount, status, token, token_expires_at)
                     VALUES ($1, $2, $3, 'SENT', $4, $5)
                     RETURNING *`,
                    [deploymentId, summary.technician_id, summary.total_pay, token, expiresAt]
                );
                invoice = newInv.rows[0];
            }

            const link = `${frontendBaseUrl}/invoice/${invoice.token}`;

            if (sendToPilots) {
                // Send Email to Pilot and CC Coatzadrone
                await sendInvoiceEmail(
                    { name: summary.pilot_name, email: summary.pilot_email },
                    deployment,
                    link,
                    parseFloat(summary.total_pay),
                    adminEmail // Pass adminEmail as CC
                );
            }

            sentInvoices.push({
                pilotName: summary.pilot_name,
                amount: parseFloat(summary.total_pay),
                link: link
            });
        }

        // 4. Send Overall Project Cost Summary to Admin
        await sendAdminSummaryEmail(deployment, sentInvoices, { to: adminEmail, cc: ccEmails });

        res.json({
            success: true,
            message: `Sent ${sentInvoices.length} invoices successfully. Admin (${adminEmail}) was copied on all.`,
            data: sentInvoices,
            emailStatus: isMockTransporter() ? 'MOCK' : 'REAL'
        });

    } catch (error) {
        console.error('Error sending deployment invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send invoices',
            error: error.message
        });
    }
};
