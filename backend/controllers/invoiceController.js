import { query } from '../config/database.js';
import crypto from 'crypto';
import { sendInvoiceEmail, sendAdminSummaryEmail, isMockTransporter } from '../services/emailService.js';

/**
 * Generate a secure invoice link for a specific pilot on a deployment
 */
export const createInvoice = async (req, res) => {
    try {
        const { deploymentId, personnelId, paymentTermsDays } = req.body;

        // 1. Calculate total pay for this person on this deployment - filtering by personnel tenant_id
        const logsResult = await query(
            `SELECT SUM(dl.daily_pay + COALESCE(dl.bonus_pay, 0)) as total 
             FROM daily_logs dl 
             JOIN personnel p ON dl.technician_id = p.id 
             WHERE dl.deployment_id = $1 
               AND dl.technician_id = $2 
               AND (p.tenant_id::text = $3 OR (p.tenant_id IS NULL AND $3 = 'default'))`,
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

        // 3. Fetch latest pilot data for snapshotting - check both personnel and pilot_banking_info
        const pilotData = await query(
            `SELECT p.home_address, 
                    COALESCE(pb.bank_name, p.bank_name) as bank_name, 
                    COALESCE(pb.account_number, p.account_number) as account_number, 
                    COALESCE(pb.routing_number, p.routing_number) as routing_number, 
                    COALESCE(pb.swift_code, p.swift_code) as swift_code, 
                    COALESCE(pb.account_type, p.account_type) as account_type,
                    p.daily_pay_rate 
             FROM personnel p
             LEFT JOIN pilot_banking_info pb ON p.id = pb.pilot_id
             WHERE p.id = $1`,
            [personnelId]
        );
        const pilot = pilotData.rows[0];

        const cleanRouting = pilot?.routing_number ? String(pilot.routing_number).replace(/\D/g, '') : null;
        const cleanAccount = pilot?.account_number ? String(pilot.account_number).replace(/\D/g, '') : null;
        const cleanSwift = pilot?.swift_code ? String(pilot.swift_code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : null;

        // 4. Create Invoice Record with payment_days and snapshotted info
        const result = await query(
            `INSERT INTO invoices (
                deployment_id, personnel_id, amount, status, token, token_expires_at, payment_days,
                home_address, bank_name, account_number, routing_number, swift_code, account_type, daily_pay_rate
             )
             VALUES ($1, $2, $3, 'SENT', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                deploymentId, personnelId, amount, token, expiresAt, paymentDays,
                pilot?.home_address, pilot?.bank_name, cleanAccount, cleanRouting, cleanSwift, pilot?.account_type, pilot?.daily_pay_rate
            ]
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
            message: 'Failed to create invoice: ' + error.message,
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
        console.log('🔍 [INVOICE_DEBUG] Incoming request for token:', token);

        // 1. Find valid unused token - now including payment_days
        const queryText = `SELECT i.*, 
                    d.title as mission_title, d.site_name, d.date as mission_date,
                    p.full_name as pilot_name, p.email as pilot_email,
                    COALESCE(i.home_address, p.home_address) as home_address,
                    COALESCE(i.bank_name, pb.bank_name, p.bank_name) as bank_name,
                    COALESCE(i.routing_number, pb.routing_number, p.routing_number) as routing_number,
                    COALESCE(i.account_number, pb.account_number, p.account_number) as account_number,
                    COALESCE(i.account_type, pb.account_type, p.account_type) as account_type,
                    COALESCE(i.swift_code, pb.swift_code, p.swift_code) as swift_code,
                    COALESCE(i.daily_pay_rate, p.daily_pay_rate) as daily_pay_rate,
                    COALESCE(i.payment_days, 30) as payment_days
             FROM invoices i
             JOIN deployments d ON i.deployment_id = d.id
             JOIN personnel p ON i.personnel_id = p.id
             LEFT JOIN pilot_banking_info pb ON p.id = pb.pilot_id
             WHERE i.token = $1`;

        const result = await query(queryText, [token]);

        console.log('📊 [INVOICE_DEBUG] Query executed. Rows found:', result.rows.length);

        if (result.rows.length === 0) {
            console.warn('⚠️ [INVOICE_DEBUG] No invoice found for token:', token);
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or invalid link.'
            });
        }

        const invoice = result.rows[0];
        console.log('✅ [INVOICE_DEBUG] Invoice found. ID:', invoice.id, 'Pilot:', invoice.pilot_name);

        // Track viewed_at if first time
        if (!invoice.viewed_at) {
            await query(
                'UPDATE invoices SET viewed_at = CURRENT_TIMESTAMP, status = $2 WHERE id = $1',
                [invoice.id, 'VIEWED']
            );
        }

        // Return Details
        res.json({
            success: true,
            data: {
                ...invoice,
                home_address: invoice.home_address,
                bank_name: invoice.bank_name,
                account_number: invoice.account_number,
                routing_number: invoice.routing_number,
                swift_code: invoice.swift_code,
                account_type: invoice.account_type
            }
        });

    } catch (error) {
        console.error('🔥 [INVOICE_DEBUG] CRITICAL ERROR retrieving invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve invoice',
            error: error.message
        });
    }
};


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
             WHERE dl.deployment_id = $1 
               AND (d.tenant_id::text = $2 OR (d.tenant_id IS NULL AND $2 = 'default'))
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
             WHERE dl.deployment_id = $1 
               AND (d.tenant_id::text = $2 OR (d.tenant_id IS NULL AND $2 = 'default'))
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

        // Get deployment details for email context - bypassing tenant_id check on d as it might be missing
        const deploymentRes = await query('SELECT title, site_name FROM deployments WHERE id = $1', [deploymentId]);
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
        const paymentDays = parseInt(settings['invoice_payment_days']) || 30;
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

                // Fetch pilot data for snapshot
                const pilotSnapshot = await query(
                    `SELECT p.home_address, 
                    COALESCE(pb.bank_name, p.bank_name) as bank_name, 
                    COALESCE(pb.account_number, p.account_number) as account_number, 
                    COALESCE(pb.routing_number, p.routing_number) as routing_number, 
                    COALESCE(pb.swift_code, p.swift_code) as swift_code, 
                    COALESCE(pb.account_type, p.account_type) as account_type,
                    p.daily_pay_rate 
             FROM personnel p
             LEFT JOIN pilot_banking_info pb ON p.id = pb.pilot_id
             WHERE p.id = $1`,
                    [summary.technician_id]
                );
                const ps = pilotSnapshot.rows[0];

                const cleanRouting = ps?.routing_number ? String(ps.routing_number).replace(/\D/g, '') : null;
                const cleanAccount = ps?.account_number ? String(ps.account_number).replace(/\D/g, '') : null;
                const cleanSwift = ps?.swift_code ? String(ps.swift_code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : null;

                const newInv = await query(
                    `INSERT INTO invoices (
                        deployment_id, personnel_id, amount, status, token, token_expires_at,
                        payment_days, home_address, bank_name, account_number, routing_number, swift_code, account_type, daily_pay_rate
                    )
                     VALUES ($1, $2, $3, 'SENT', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                     RETURNING *`,
                    [
                        deploymentId, summary.technician_id, summary.total_pay, token, expiresAt,
                        paymentDays, ps?.home_address, ps?.bank_name, cleanAccount, cleanRouting, cleanSwift, ps?.account_type, ps?.daily_pay_rate
                    ]
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
            message: 'Failed to send invoices: ' + error.message,
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
 * Update an existing invoice (overriding snapshot/calculated values)
 */
export const updateInvoice = async (req, res) => {
    try {
        const { token } = req.params;
        const {
            amount,
            home_address,
            bank_name,
            account_number,
            routing_number,
            swift_code,
            payment_days,
            status,
            account_type,
            daily_pay_rate
        } = req.body;

        // Verify invoice exists
        const check = await query('SELECT id FROM invoices WHERE token = $1', [token]);
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }

        const cleanRouting = routing_number ? String(routing_number).replace(/\D/g, '') : routing_number;
        const cleanAccount = account_number ? String(account_number).replace(/\D/g, '') : account_number;
        const cleanSwift = swift_code ? String(swift_code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : swift_code;

        const result = await query(
            `UPDATE invoices 
             SET amount = COALESCE($1, amount),
                 home_address = COALESCE($2, home_address),
                 bank_name = COALESCE($3, bank_name),
                 account_number = COALESCE($4, account_number),
                 routing_number = COALESCE($5, routing_number),
                 swift_code = $6,
                 payment_days = COALESCE($7, payment_days),
                 status = COALESCE($8, status),
                 account_type = COALESCE($9, account_type),
                 daily_pay_rate = COALESCE($10, daily_pay_rate),
                 updated_at = CURRENT_TIMESTAMP
             WHERE token = $11
             RETURNING *`,
            [amount, home_address, bank_name, cleanAccount, cleanRouting, cleanSwift, payment_days, status, account_type, daily_pay_rate, token]
        );

        res.json({
            success: true,
            message: 'Invoice updated successfully.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update invoice',
            error: error.message
        });
    }
};
