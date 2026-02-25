import nodemailer from 'nodemailer';

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Mock transporter for development/logging only
        // This effectively just logs that we WOULD have sent an email
        return {
            sendMail: async (mailOptions) => {
                console.log('---------------------------------------------------');
                console.log('[Mock Email Service] Email would be sent:');
                console.log(`To: ${mailOptions.to}`);
                console.log(`From: ${mailOptions.from}`);
                console.log(`Subject: ${mailOptions.subject}`);
                console.log(`HTML Preview: ${mailOptions.html.substring(0, 100)}...`);
                console.log('---------------------------------------------------');
                return { messageId: 'mock-id-' + Date.now() };
            }
        };
    }
};

const transporter = createTransporter();

/**
 * Check if the transporter is a mock transporter (no SMTP config)
 */
export const isMockTransporter = () => {
    return !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS;
};

/**
 * Send a generic email
 * @param {string} to 
 * @param {string} subject 
 * @param {string} html 
 */
export const sendEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Coatzadrone Admin" <admin@coatzadroneusa.com>',
            to,
            subject,
            html,
        });
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

/**
 * Send Invoice Email to Pilot
 * @param {object} pilot { name, email }
 * @param {object} deployment { title, siteName }
 * @param {string} invoiceLink 
 * @param {number} amount 
 * @param {string} cc - Optional CC recipient
 */
export const sendInvoiceEmail = async (pilot, deployment, invoiceLink, amount, cc = null, note = null) => {
    const subject = `Invoice Ready: ${deployment.title}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Invoice Ready for Submission</h2>
            <p>Hi ${pilot.name},</p>
            <p>An invoice has been generated for your recent mission:</p>
            <ul>
                <li><strong>Mission:</strong> ${deployment.title}</li>
                <li><strong>Site:</strong> ${deployment.siteName}</li>
                <li><strong>Total Amount:</strong> $${amount.toLocaleString()}</li>
            </ul>
            <p>Please click the link below to view and acknowledge your invoice:</p>
            ${note ? `
            <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 14px 16px; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #0c4a6e; font-weight: 600;">Note from Operations:</p>
                <p style="margin: 6px 0 0; font-size: 14px; color: #1e293b; white-space: pre-wrap;">${note}</p>
            </div>` : ''}
            <p>
                <a href="${invoiceLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Invoice</a>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                If the button doesn't work, copy this link:<br>
                ${invoiceLink}
            </p>
        </div>
    `;

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Coatzadrone Admin" <admin@coatzadroneusa.com>',
            to: pilot.email,
            cc: cc,
            subject,
            html,
        });
        console.log('Invoice email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending invoice email:', error);
        throw error;
    }
};

/**
 * Send Summary Email to Admin
 * @param {object} deployment 
 * @param {Array} sentInvoices Array of { pilotName, amount }
 */
/**
 * Send Summary Email to Admin
 * @param {object} deployment 
 * @param {Array} sentInvoices Array of { pilotName, amount }
 * @param {object} recipients { to: string, cc: string[] }
 */
export const sendAdminSummaryEmail = async (deployment, sentInvoices, recipients = {}) => {
    const subject = `Invoices Sent: ${deployment.title}`;
    const to = recipients.to || 'admin@coatzadroneusa.com';
    const cc = recipients.cc || [];

    const rows = sentInvoices.map(inv =>
        `<tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${inv.pilotName}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">$${inv.amount.toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><a href="${inv.link}">View</a></td>
         </tr>`
    ).join('');

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Invoices Dispatched</h2>
            <p>Invoices for <strong>${deployment.title}</strong> have been sent to the following pilots:</p>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Pilot</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Amount</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Link</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <p>Total Invoiced: <strong>$${sentInvoices.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</strong></p>
        </div>
    `;

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Coatzadrone Admin" <admin@coatzadroneusa.com>',
            to,
            cc,
            subject,
            html,
        });
        console.log('Admin summary sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending admin summary:', error);
        // Don't throw here to avoid failing the whole invoice process if admin email fails
        return null;
    }
};

/**
 * Send welcome onboarding email to new personnel
 * @param {object} params { to, personnelName, portalUrl, documents }
 */
export const sendOnboardingEmail = async ({ to, personnelName, portalUrl, documents }) => {
    const documentList = documents.map(doc => `✓ ${doc.name}`).join('\n');

    const subject = 'Welcome to CoatzadroneUSA - Complete Your Onboarding';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
                .documents { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; }
                .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to CoatzadroneUSA!</h1>
                </div>
                <div class="content">
                    <p>Hi <strong>${personnelName}</strong>,</p>
                    
                    <p>Welcome to the CoatzadroneUSA team! We're excited to have you on board as part of our elite drone operations crew.</p>
                    
                    <p>To complete your onboarding, please access your secure onboarding portal:</p>
                    
                    <center>
                        <a href="${portalUrl}" class="button">Access Onboarding Portal</a>
                    </center>
                    
                    <div class="documents">
                        <h3>Required Documents:</h3>
                        <pre>${documentList}</pre>
                    </div>
                    
                    <p><strong>Important:</strong> This link will expire in 30 days. Please complete your onboarding as soon as possible.</p>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                    
                    <p>Best regards,<br><strong>CoatzadroneUSA Team</strong></p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(to, subject, html);
};

/**
 * Send reminder email for incomplete onboarding
 * @param {object} params { to, personnelName, portalUrl, pendingDocuments }
 */
export const sendOnboardingReminder = async ({ to, personnelName, portalUrl, pendingDocuments }) => {
    const documentList = pendingDocuments.map(doc => `• ${doc.name}`).join('\n');

    const subject = 'Reminder: Complete Your CoatzadroneUSA Onboarding';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .content { background: #fff3cd; padding: 30px; border-radius: 8px; border: 2px solid #ffc107; }
                .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    <h2>⏰ Onboarding Reminder</h2>
                    <p>Hi <strong>${personnelName}</strong>,</p>
                    
                    <p>We noticed you haven't completed your onboarding yet. Please complete the following documents:</p>
                    
                    <pre>${documentList}</pre>
                    
                    <center>
                        <a href="${portalUrl}" class="button">Complete Onboarding</a>
                    </center>
                    
                    <p>Thank you!</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(to, subject, html);
};

/**
 * Send welcome email to new user
 * @param {object} params { to, fullName, password, role }
 */
export const sendUserWelcomeEmail = async ({ to, fullName, password, role }) => {
    const subject = 'Welcome to Axis Drone Platform - Your Account is Ready';
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Format role for display (convert SNAKE_CASE to Title Case)
    const displayRole = role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #f8fafc; }
                .card { background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                .header { text-align: center; margin-bottom: 32px; }
                .logo { font-size: 24px; font-weight: 800; color: #2563eb; letter-spacing: -0.025em; }
                .content { margin-bottom: 32px; }
                .greeting { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
                .credentials { background: #f1f5f9; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0; }
                .credential-row { display: flex; margin-bottom: 8px; font-size: 14px; }
                .credential-label { font-weight: 600; width: 80px; color: #64748b; }
                .credential-value { font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #0f172a; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; text-align: center; width: calc(100% - 32px); margin: 0 auto; }
                .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; }
                .warning { font-size: 13px; color: #ef4444; margin-top: 16px; font-style: italic; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">AXIS DRONE PLATFORM</div>
                </div>
                <div class="card">
                    <div class="content">
                        <p class="greeting">Hi ${fullName},</p>
                        <p>Welcome to Axis! An account has been created for you on our enterprise drone inspection platform. You have been assigned the role of <strong>${displayRole}</strong>.</p>
                        
                        <p>Please use the credentials below to log in to your dashboard:</p>
                        
                        <div class="credentials">
                            <div class="credential-row">
                                <span class="credential-label">Email:</span>
                                <span class="credential-value">${to}</span>
                            </div>
                            <div class="credential-row">
                                <span class="credential-label">Password:</span>
                                <span class="credential-value">${password}</span>
                            </div>
                        </div>
                        
                        <center>
                            <a href="${loginUrl}" class="button">Log In to Dashboard</a>
                        </center>
                        
                        <p class="warning">For security reasons, we strongly recommend changing your password after your first login.</p>
                    </div>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} CoatzadroneUSA. All rights reserved.<br>
                    This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(to, subject, html);
};

/**
 * Send mission assignment notification to pilot or monitoring user
 * @param {object} person { name, email }
 * @param {object} deployment { title, siteName, date, location }
 * @param {string} missionRole - Assigned role for this person on the mission
 */
export const sendMissionAssignmentEmail = async (person, deployment, missionRole) => {
    const subject = `Mission Assignment: ${deployment.title}`;
    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
            <div style="background-color: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 20px;">Mission Assignment</h1>
            </div>
            <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background-color: #f8fafc;">
                <p>Hi <strong>${person.name}</strong>,</p>
                <p>You have been assigned to an upcoming mission on the Axis Drone Platform.</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Mission:</strong> ${deployment.title}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Site:</strong> ${deployment.siteName}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${deployment.date}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${deployment.location || 'N/A'}</p>
                    <p style="margin: 0;"><strong>Your Role:</strong> ${missionRole}</p>
                </div>

                <p>Please log in to your dashboard to review the mission details and access any required assets.</p>
                
                <center style="margin: 30px 0;">
                    <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Mission Dashboard</a>
                </center>
                
                <p style="font-size: 13px; color: #64748b; font-style: italic;">
                    If you believe this assignment is an error, please contact your operations manager.
                </p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} CoatzadroneUSA. All rights reserved.
            </div>
        </div>
    `;

    return sendEmail(person.email, subject, html);
};

/**
 * Send invitation email to new user to set their password
 * @param {object} params { to, fullName, invitationUrl, role }
 */
export const sendUserInvitationEmail = async ({ to, fullName, invitationUrl, role }) => {
    const subject = 'Invitation to join Axis Drone Platform';
    const displayRole = role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 40px auto; padding: 40px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                .header { text-align: center; margin-bottom: 32px; }
                .logo { font-size: 24px; font-weight: 800; color: #2563eb; letter-spacing: -0.025em; }
                .greeting { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; text-align: center; margin: 24px 0; }
                .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">AXIS DRONE PLATFORM</div>
                </div>
                <div class="content">
                    <p class="greeting">Hello ${fullName},</p>
                    <p>You have been invited to join the Axis Drone Platform as a <strong>${displayRole}</strong>.</p>
                    <p>To get started and set up your account, please click the button below to create your password:</p>
                    
                    <center>
                        <a href="${invitationUrl}" class="button">Set Up Your Account</a>
                    </center>
                    
                    <p>The link will expire in 7 days for security reasons.</p>
                    <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} CoatzadroneUSA. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(to, subject, html);
};

