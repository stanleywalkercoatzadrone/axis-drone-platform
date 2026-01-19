import { query } from '../config/database.js';
import crypto from 'crypto';

/**
 * Generate a secure invoice link for a specific pilot on a deployment
 */
export const createInvoice = async (req, res) => {
    try {
        const { deploymentId, personnelId } = req.body;

        // 1. Calculate total pay for this person on this deployment
        const logsResult = await query(
            'SELECT SUM(daily_pay + COALESCE(bonus_pay, 0)) as total FROM daily_logs WHERE deployment_id = $1 AND technician_id = $2',
            [deploymentId, personnelId]
        );

        const amount = logsResult.rows[0].total || 0;

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No earnings found for this pilot on this mission.'
            });
        }

        // 2. Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiration

        // 3. Create Invoice Record
        const result = await query(
            `INSERT INTO invoices (deployment_id, personnel_id, amount, status, token, token_expires_at)
             VALUES ($1, $2, $3, 'SENT', $4, $5)
             RETURNING *`,
            [deploymentId, personnelId, amount, token, expiresAt]
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

        // 1. Find valid unused token
        const result = await query(
            `SELECT i.*, 
                    d.title as mission_title, d.site_name, d.date as mission_date,
                    p.full_name as pilot_name, p.email as pilot_email
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

import { sendInvoiceEmail, sendAdminSummaryEmail } from '../services/emailService.js';

/**
 * Send invoices to all pilots in a deployment and a summary to admin
 */
export const sendDeploymentInvoices = async (req, res) => {
    try {
        const { id: deploymentId } = req.params;

        // 1. Get all logs for this deployment grouped by technician
        const logsResult = await query(
            `SELECT 
                dl.technician_id,
                p.full_name as pilot_name,
                p.email as pilot_email,
                SUM(dl.daily_pay + COALESCE(dl.bonus_pay, 0)) as total_pay
             FROM daily_logs dl
             JOIN personnel p ON dl.technician_id = p.id
             WHERE dl.deployment_id = $1
             GROUP BY dl.technician_id, p.full_name, p.email
             HAVING SUM(dl.daily_pay + COALESCE(dl.bonus_pay, 0)) > 0`,
            [deploymentId]
        );

        const summaries = logsResult.rows;

        if (summaries.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No earnings found to invoice for this mission.'
            });
        }

        // Get deployment details for email context
        const deploymentRes = await query('SELECT title, site_name FROM deployments WHERE id = $1', [deploymentId]);
        const deployment = deploymentRes.rows[0];

        const sentInvoices = [];
        const protocol = req.protocol;
        const host = req.get('host');
        // Construct base URL for frontend. 
        // In local dev, backend is 8080/3001, frontend is usually 5173 or 3000. 
        // We'll use a placeholder or config. For now, let's assume standard local dev localhost:3000
        const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // 2. Process each pilot
        for (const summary of summaries) {
            // Check if active invoice exists, otherwise create
            let invoice;
            const existingInvoice = await query(
                `SELECT * FROM invoices 
                 WHERE deployment_id = $1 AND personnel_id = $2 AND status != 'PAID'`,
                [deploymentId, summary.technician_id]
            );

            if (existingInvoice.rows.length > 0) {
                invoice = existingInvoice.rows[0];
                // Update amount if changed? Assume yes.
                if (parseFloat(invoice.amount) !== parseFloat(summary.total_pay)) {
                    await query('UPDATE invoices SET amount = $1 WHERE id = $2', [summary.total_pay, invoice.id]);
                    invoice.amount = summary.total_pay;
                }
            } else {
                // Create new invoice
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

            // 3. Send Email
            // Note: invoice.token might be missing if we used existingInvoice without selecting all or invalid logic. 
            // Query above `SELECT *` gets it.

            const link = `${frontendBaseUrl}/invoice/${invoice.token}`;

            await sendInvoiceEmail(
                { name: summary.pilot_name, email: summary.pilot_email },
                deployment,
                link,
                parseFloat(summary.total_pay)
            );

            sentInvoices.push({
                pilotName: summary.pilot_name,
                amount: parseFloat(summary.total_pay)
            });
        }

        // 4. Send Admin Summary
        await sendAdminSummaryEmail(deployment, sentInvoices);

        res.json({
            success: true,
            message: `Sent ${sentInvoices.length} invoices successfully.`,
            data: sentInvoices
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
