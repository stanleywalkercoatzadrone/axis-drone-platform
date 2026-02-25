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

        // Fetch pilot's daily pay rate
        const personnelRes = await query(
            'SELECT daily_pay_rate FROM personnel WHERE id = $1',
            [personnelId]
        );
        const dailyPayRate = personnelRes.rows.length > 0 ? parseFloat(personnelRes.rows[0].daily_pay_rate) || 0 : 0;

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

        // 3. Create Invoice Record with payment_days and daily_pay_rate
        const result = await query(
            `INSERT INTO invoices (deployment_id, personnel_id, amount, status, token, token_expires_at, payment_days, daily_pay_rate)
             VALUES ($1, $2, $3, 'SENT', $4, $5, $6, $7)
             RETURNING *`,
            [deploymentId, personnelId, amount, token, expiresAt, paymentDays, dailyPayRate]
        );

        // 4. Return the link
        const invoice = result.rows[0];
        const protocol = req.protocol;
        const host = req.get('host');
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

        // 1. Find invoice with full personnel banking data from pilot_banking_info
        const result = await query(
            `SELECT i.*, 
                    d.title as mission_title, d.site_name, d.date as mission_date,
                    p.full_name as pilot_name, p.email as pilot_email,
                    p.home_address,
                    COALESCE(pbi.bank_name, p.bank_name) as bank_name,
                    COALESCE(pbi.routing_number, p.routing_number) as routing_number,
                    COALESCE(pbi.account_number, p.account_number) as account_number,
                    COALESCE(pbi.swift_code, p.swift_code) as swift_code,
                    COALESCE(pbi.account_type, p.account_type, 'Checking') as account_type,
                    COALESCE(i.payment_days, 30) as payment_days,
                    COALESCE(i.daily_pay_rate, pbi.daily_rate, p.daily_pay_rate, 0) as daily_pay_rate,
                    (SELECT COUNT(*) FROM daily_logs dl 
                     WHERE dl.deployment_id = i.deployment_id 
                     AND dl.technician_id = i.personnel_id) as days_worked
             FROM invoices i
             JOIN deployments d ON i.deployment_id = d.id
             JOIN personnel p ON i.personnel_id = p.id
             LEFT JOIN pilot_banking_info pbi ON pbi.pilot_id = p.id
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

        // Invoice links are now reusable - removed expiration and single-use checks

        // Return Details
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
        const { personnelIds, sendToPilots = true, adminNote } = req.body;

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
                    adminEmail, // CC
                    adminNote || null // Note
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

/**
 * Get all created invoices for a specific deployment
 */
export const getInvoicesByDeployment = async (req, res) => {
    try {
        const { deploymentId } = req.params;

        const result = await query(
            `SELECT i.*, p.full_name as pilot_name, p.email as pilot_email 
             FROM invoices i 
             JOIN personnel p ON i.personnel_id = p.id 
             WHERE i.deployment_id = $1 AND (i.status = 'SENT' OR i.status = 'PAID' OR i.status = 'VIEWED')
             ORDER BY p.full_name ASC`,
            [deploymentId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching deployment invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
            error: error.message
        });
    }
};

/**
 * Generate a Master Invoice for a Deployment (Aggregating multiple pilot invoices)
 */
export const createMasterInvoice = async (req, res) => {
    try {
        const { deploymentId, invoiceIds } = req.body;

        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No invoices selected for Master Invoice.'
            });
        }

        // 1. Fetch Deployment Details
        const deploymentRes = await query(
            'SELECT * FROM deployments WHERE id = $1 AND tenant_id = $2',
            [deploymentId, req.user.tenantId]
        );

        if (deploymentRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Deployment not found' });
        }
        const deployment = deploymentRes.rows[0];

        // 2. Fetch Selected Invoices with details
        const invoicesRes = await query(
            `SELECT i.*, p.full_name as pilot_name 
             FROM invoices i
             JOIN personnel p ON i.personnel_id = p.id
             WHERE i.id = ANY($1) AND i.deployment_id = $2`,
            [invoiceIds, deploymentId]
        );

        const invoices = invoicesRes.rows;

        // Calculate Total
        const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

        // 3. Return Data for Rendering
        res.json({
            success: true,
            data: {
                deployment,
                invoices,
                totalAmount,
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Error creating master invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create master invoice',
            error: error.message
        });
    }
};

/**
 * Update invoice fields via token (admin only via auth header)
 * PUT /api/invoices/:token
 */
export const updateInvoiceByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const {
            created_at,
            amount,
            payment_days,
            daily_pay_rate,
            days_worked,
            pilot_name,
            home_address,
            mission_title,
            site_name,
            service_description,
            bank_name,
            routing_number,
            account_number,
            swift_code,
            account_type,
        } = req.body;

        // Find invoice by token
        const findRes = await query('SELECT i.id, i.personnel_id FROM invoices i WHERE i.token = $1', [token]);
        if (findRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }

        const invoiceId = findRes.rows[0].id;
        const personnelId = findRes.rows[0].personnel_id;

        // Update invoice record
        await query(`
            UPDATE invoices SET
                created_at = COALESCE($1, created_at),
                amount = COALESCE($2, amount),
                payment_days = COALESCE($3, payment_days),
                daily_pay_rate = COALESCE($4, daily_pay_rate),
                updated_at = NOW()
            WHERE id = $5
        `, [created_at, amount, payment_days, daily_pay_rate, invoiceId]);

        // Update personnel name/address if provided
        if (pilot_name || home_address) {
            const nameUpdates = [];
            const nameParams = [];
            let idx = 1;
            if (pilot_name) { nameUpdates.push(`full_name = $${idx++}`); nameParams.push(pilot_name); }
            if (home_address) { nameUpdates.push(`home_address = $${idx++}`); nameParams.push(home_address); }
            if (nameUpdates.length > 0) {
                nameParams.push(personnelId);
                await query(`UPDATE personnel SET ${nameUpdates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, nameParams);
            }
        }

        // Upsert banking info into pilot_banking_info (the correct table)
        const hasBanking = bank_name || routing_number || account_number || swift_code || account_type;
        if (hasBanking) {
            await query(`
                INSERT INTO pilot_banking_info (pilot_id, bank_name, routing_number, account_number, swift_code, account_type, currency)
                VALUES ($1, $2, $3, $4, $5, $6, 'USD')
                ON CONFLICT (pilot_id) DO UPDATE SET
                    bank_name = COALESCE(EXCLUDED.bank_name, pilot_banking_info.bank_name),
                    routing_number = COALESCE(EXCLUDED.routing_number, pilot_banking_info.routing_number),
                    account_number = COALESCE(EXCLUDED.account_number, pilot_banking_info.account_number),
                    swift_code = COALESCE(EXCLUDED.swift_code, pilot_banking_info.swift_code),
                    account_type = COALESCE(EXCLUDED.account_type, pilot_banking_info.account_type)
            `, [personnelId, bank_name, routing_number, account_number, swift_code, account_type]);
        }

        // Return updated invoice with fresh banking data
        const updated = await query(
            `SELECT i.*, 
                    d.title as mission_title, d.site_name, d.date as mission_date,
                    p.full_name as pilot_name, p.email as pilot_email,
                    p.home_address,
                    COALESCE(pbi.bank_name, p.bank_name) as bank_name,
                    COALESCE(pbi.routing_number, p.routing_number) as routing_number,
                    COALESCE(pbi.account_number, p.account_number) as account_number,
                    COALESCE(pbi.swift_code, p.swift_code) as swift_code,
                    COALESCE(pbi.account_type, p.account_type, 'Checking') as account_type,
                    COALESCE(i.payment_days, 30) as payment_days,
                    COALESCE(i.daily_pay_rate, pbi.daily_rate, p.daily_pay_rate, 0) as daily_pay_rate,
                    (SELECT COUNT(*) FROM daily_logs dl 
                     WHERE dl.deployment_id = i.deployment_id 
                     AND dl.technician_id = i.personnel_id) as days_worked
             FROM invoices i
             JOIN deployments d ON i.deployment_id = d.id
             JOIN personnel p ON i.personnel_id = p.id
             LEFT JOIN pilot_banking_info pbi ON pbi.pilot_id = p.id
             WHERE i.token = $1`,
            [token]
        );

        res.json({ success: true, data: updated.rows[0] });

    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ success: false, message: 'Failed to update invoice', error: error.message });
    }
};
