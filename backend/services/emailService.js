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
export const sendInvoiceEmail = async (pilot, deployment, invoiceLink, amount, cc = null, note = null, customSubject = null, customBody = null) => {
    const subject = customSubject || `Invoice Ready: ${deployment.title}`;

    let html;
    if (customBody) {
        // Substitute tokens and wrap in a clean container
        const bodyText = customBody
            .replace(/\{PILOT_NAME\}/g, pilot.name)
            .replace(/\{AMOUNT\}/g, `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
            .replace(/\{INVOICE_LINK\}/g, invoiceLink);

        // Convert plain text to simple HTML paragraphs
        const bodyHtml = bodyText.split('\n').map(line =>
            line.trim() === '' ? '<br>' : `<p style="margin:4px 0;line-height:1.6;">${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
        ).join('\n');

        html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${bodyHtml}
            ${note ? `
            <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 14px 16px; margin: 16px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #0c4a6e; font-weight: 600;">Note from Operations:</p>
                <p style="margin: 6px 0 0; font-size: 14px; color: #1e293b; white-space: pre-wrap;">${note}</p>
            </div>` : ''}
            <p style="margin-top:20px;">
                <a href="${invoiceLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Invoice</a>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                If the button doesn't work, copy this link:<br>${invoiceLink}
            </p>
        </div>`;
    } else {
        // Default template
        html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Invoice Ready for Submission</h2>
            <p>Hi ${pilot.name},</p>
            <p>An invoice has been generated for your recent mission:</p>
            <ul>
                <li><strong>Mission:</strong> ${deployment.title}</li>
                <li><strong>Site:</strong> ${deployment.siteName}</li>
                <li><strong>Total Amount:</strong> $${Number(amount).toLocaleString()}</li>
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
    `}

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

/**
 * Send pre-onboarding documents as email attachments directly to a candidate
 * @param {object} params { to, documents }
 */
export const sendPreOnboardingEmail = async ({ to, documents }) => {
    const subject = 'CoatzadroneUSA - Pilot Onboarding Documents';
    const documentNames = documents.map(doc => `• ${doc.name}`).join('\n');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
                .documents { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; }
                .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to CoatzadroneUSA</h1>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    
                    <p>Thank you for your interest in joining the CoatzadroneUSA elite drone operations crew. Before we proceed with setting up your official profile, please review and complete the following attached documents:</p>
                    
                    <div class="documents">
                        <h3>Attached Documents:</h3>
                        <pre>${documentNames}</pre>
                    </div>
                    
                    <p>Please reply directly to this email with the completed forms.</p>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
                    
                    <p>Best regards,<br><strong>CoatzadroneUSA Team</strong></p>
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply to this email, except to return the forms.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Map the selected document templates to Nodemailer's attachment array format
    const attachments = documents.map(doc => ({
        filename: doc.filename,
        path: doc.templateUrl,
        contentType: 'application/pdf'
    }));

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Coatzadrone Admin" <admin@coatzadroneusa.com>',
            to,
            subject,
            html,
            attachments
        });
        console.log('Pre-onboarding documents sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending pre-onboarding documents:', error);
        throw error;
    }
};/**
 * Send pilot application status notification emails.
 * Called after admin updates a pilot network application status.
 *
 * @param {object} params
 * @param {string} params.to          - Applicant email
 * @param {string} params.firstName   - Applicant first name
 * @param {string} params.status      - 'approved' | 'rejected' | 'waitlisted'
 * @param {string} [params.adminNotes] - Optional admin notes to include
 */
export const sendPilotApplicationStatusEmail = async ({ to, firstName, status, adminNotes }) => {
    const portalUrl = process.env.FRONTEND_URL || 'https://axisplatform.app';
    const year = new Date().getFullYear();

    const configs = {
        approved: {
            subject: '🎉 You\'ve Been Accepted — Axis Pilot Network',
            accent: '#10b981',       // emerald
            accentLight: '#d1fae5',
            icon: '✅',
            headline: 'Application Approved',
            intro: `Congratulations, <strong>${firstName}</strong>! We're excited to welcome you to the Axis Pilot Network.`,
            body: `
                <p>Your application has been reviewed and <strong>approved</strong>. You are now an active member of our certified drone pilot network.</p>
                <p>Here's what to expect next:</p>
                <ul style="padding-left:20px; color:#374151;">
                    <li style="margin-bottom:8px;">Your pilot profile has been created in our system</li>
                    <li style="margin-bottom:8px;">Our operations team will be in touch with mission assignments</li>
                    <li style="margin-bottom:8px;">You may be asked to complete onboarding documentation</li>
                </ul>
            `,
            cta: 'Visit Axis Platform',
            ctaUrl: portalUrl,
            ctaColor: '#10b981',
        },
        rejected: {
            subject: 'Axis Pilot Network — Application Update',
            accent: '#ef4444',       // red
            accentLight: '#fee2e2',
            icon: '📋',
            headline: 'Application Status Update',
            intro: `Hi <strong>${firstName}</strong>, thank you for applying to the Axis Pilot Network.`,
            body: `
                <p>After careful review of your application, we are unable to move forward at this time.</p>
                <p>This decision may be based on current operational needs, certification requirements, or coverage area availability. We encourage you to reapply in the future as our network continues to expand.</p>
                <p>If you believe this decision was made in error or would like feedback, please reach out to our team directly.</p>
            `,
            cta: 'Contact Our Team',
            ctaUrl: `mailto:${process.env.SMTP_FROM_ADDRESS || 'operations@coatzadroneusa.com'}`,
            ctaColor: '#6b7280',
        },
        waitlisted: {
            subject: 'Axis Pilot Network — You\'re on the Waitlist',
            accent: '#f59e0b',       // amber
            accentLight: '#fef3c7',
            icon: '⏳',
            headline: 'Added to Waitlist',
            intro: `Hi <strong>${firstName}</strong>, thank you for your interest in the Axis Pilot Network.`,
            body: `
                <p>Your application has been reviewed and you've been placed on our <strong>priority waitlist</strong>.</p>
                <p>This means your application meets our standards, but we don't have an immediate opening in your area or specialty at this time.</p>
                <p>What happens next:</p>
                <ul style="padding-left:20px; color:#374151;">
                    <li style="margin-bottom:8px;">We'll keep your application on file</li>
                    <li style="margin-bottom:8px;">You'll be contacted as soon as a position becomes available</li>
                    <li style="margin-bottom:8px;">No action is required from you at this time</li>
                </ul>
            `,
            cta: 'Learn More About Axis',
            ctaUrl: portalUrl,
            ctaColor: '#f59e0b',
        },
    };

    const cfg = configs[status];
    if (!cfg) {
        console.warn(`[emailService] Unknown pilot application status: ${status}`);
        return;
    }

    const notesBlock = adminNotes ? `
        <div style="background:#f8fafc; border-left:4px solid ${cfg.accent}; padding:14px 16px; margin:20px 0; border-radius:4px;">
            <p style="margin:0 0 4px; font-size:12px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em;">Note from Operations</p>
            <p style="margin:0; font-size:14px; color:#374151; white-space:pre-wrap;">${adminNotes}</p>
        </div>
    ` : '';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
            <div style="max-width:600px;margin:40px auto;padding:0 20px;">

                <!-- Header -->
                <div style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px;text-align:center;">
                    <div style="font-size:28px;font-weight:900;color:#38bdf8;letter-spacing:-0.05em;margin-bottom:4px;">AXIS</div>
                    <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.2em;text-transform:uppercase;">by CoatzaDrone</div>
                </div>

                <!-- Status Banner -->
                <div style="background:${cfg.accentLight};border-left:none;border-bottom:3px solid ${cfg.accent};padding:20px 32px;text-align:center;">
                    <div style="font-size:28px;margin-bottom:6px;">${cfg.icon}</div>
                    <div style="font-size:18px;font-weight:800;color:${cfg.accent};">${cfg.headline}</div>
                </div>

                <!-- Body -->
                <div style="background:#ffffff;padding:36px 32px;border:1px solid #e2e8f0;border-top:none;">
                    <p style="font-size:16px;line-height:1.6;margin-bottom:16px;">${cfg.intro}</p>
                    <div style="font-size:15px;line-height:1.7;color:#374151;">
                        ${cfg.body}
                    </div>

                    ${notesBlock}

                    <div style="text-align:center;margin:32px 0;">
                        <a href="${cfg.ctaUrl}"
                           style="display:inline-block;background:${cfg.ctaColor};color:#ffffff;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">
                            ${cfg.cta}
                        </a>
                    </div>

                    <p style="font-size:13px;color:#64748b;line-height:1.6;">
                        If you have any questions, please contact us at
                        <a href="mailto:${process.env.SMTP_FROM_ADDRESS || 'operations@coatzadroneusa.com'}"
                           style="color:#38bdf8;text-decoration:none;">
                            ${process.env.SMTP_FROM_ADDRESS || 'operations@coatzadroneusa.com'}
                        </a>
                    </p>
                </div>

                <!-- Footer -->
                <div style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px;text-align:center;">
                    <p style="font-size:11px;color:#475569;margin:0;">
                        &copy; ${year} CoatzaDrone. All rights reserved.<br>
                        This is an automated notification — please do not reply to this email.
                    </p>
                </div>

            </div>
        </body>
        </html>
    `;

    return sendEmail(to, cfg.subject, html);
};

/**
 * Send a mission interest inquiry to a pilot.
 * @param {object} pilot  { name, email }
 * @param {object} mission { title, siteName, date, location, type, notes, dailyPayRate, estimatedDurationDays, industry }
 * @param {string} customMessage - Optional extra message from admin
 */
export const sendMissionInterestEmail = async (pilot, mission, customMessage = '') => {
    const year = new Date().getFullYear();
    const replyTo = process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || 'operations@coatzadroneusa.com';

    // Use AI-generated subject if provided, else fall back to static
    const subject = mission.aiGeneratedSubject || `Mission Opportunity — ${mission.title}`;

    const detailRows = [
        { label: 'Mission', value: mission.title },
        mission.siteName  && { label: 'Site',          value: mission.siteName },
        mission.date      && { label: 'Date',           value: mission.date },
        mission.location  && { label: 'Location',       value: mission.location },
        mission.type      && { label: 'Type',            value: mission.type },
        mission.industry  && { label: 'Industry',       value: mission.industry },
        mission.estimatedDurationDays && { label: 'Est. Duration', value: `${mission.estimatedDurationDays} day${mission.estimatedDurationDays > 1 ? 's' : ''}` },
    ].filter(Boolean);

    const detailsHtml = detailRows.map(r => `
        <tr>
            <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#64748b;border-bottom:1px solid #f1f5f9;white-space:nowrap;width:130px;">${r.label}</td>
            <td style="padding:10px 12px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${r.value}</td>
        </tr>`).join('');

    // Prominent pay banner — shown above detail card
    // Only show the green banner if we actually have a real pay rate (> 0)
    const rate = parseFloat(mission.dailyPayRate) || 0;
    const days = parseInt(mission.estimatedDurationDays) || 1;
    const totalEstimated = rate * days;

    const payBannerHtml = rate > 0 ? `
        <div style="background:linear-gradient(135deg,#064e3b,#065f46);border-radius:10px;padding:16px 20px;margin:20px 0;display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div>
                <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#6ee7b7;text-transform:uppercase;letter-spacing:0.12em;">Your Daily Rate</p>
                <p style="margin:0;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">$${rate.toLocaleString()}<span style="font-size:14px;font-weight:500;color:#a7f3d0;margin-left:4px;">/day</span></p>
            </div>
            <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:10px 16px;text-align:center;min-width:120px;">
                <p style="margin:0 0 2px;font-size:10px;color:#a7f3d0;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Est. Total (${days} day${days !== 1 ? 's' : ''})</p>
                <p style="margin:0;font-size:20px;font-weight:900;color:#ffffff;">$${totalEstimated.toLocaleString()}</p>
            </div>
        </div>` : `
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px 20px;margin:20px 0;text-align:center;">
            <p style="margin:0;font-size:13px;color:#64748b;">Compensation will be confirmed by the operations team based on scope and availability.</p>
        </div>`;

    const customBlock = customMessage ? `
        <div style="background:#f0f9ff;border-left:4px solid #38bdf8;padding:14px 16px;margin:24px 0;border-radius:6px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Message from Operations</p>
            <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${customMessage}</p>
        </div>` : '';

    const notesBlock = mission.notes ? `
        <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px;margin-top:16px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Mission Notes</p>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">${mission.notes}</p>
        </div>` : '';

    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
        <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
            <div style="max-width:600px;margin:40px auto;padding:0 20px;">

                <!-- Header -->
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">Axis Enterprise Platform</div>
                    <div style="font-size:28px;font-weight:900;color:#38bdf8;letter-spacing:-0.05em;">Mission Opportunity</div>
                    <div style="width:48px;height:3px;background:linear-gradient(90deg,#38bdf8,#818cf8);border-radius:999px;margin:12px auto 0;"></div>
                </div>

                <!-- Body -->
                <div style="background:#ffffff;padding:36px 32px;border:1px solid #e2e8f0;border-top:none;">
                    ${mission.aiGeneratedBody ? `
                    <!-- AI-written narrative body — pilot name personalized from [Name] placeholder -->
                    <div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap;">${
                        mission.aiGeneratedBody.replace(/Hi \[Name\],?/i, `Hi <strong>${pilot.name}</strong>,`)
                    }</div>
                    ${customMessage ? `
                    <div style="background:#f0f9ff;border-left:4px solid #38bdf8;padding:14px 16px;margin:24px 0;border-radius:6px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Additional Note from Operations</p>
                        <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${customMessage}</p>
                    </div>` : ''}
                    ` : `
                    <p style="font-size:16px;line-height:1.6;margin-bottom:4px;">Hi <strong>${pilot.name}</strong>,</p>
                    <p style="font-size:14px;color:#475569;line-height:1.6;margin-top:0;">Our operations team has an upcoming mission and would like to know if you're available and interested. Details are below:</p>
                    ${customBlock}
                    `}

                    <!-- Pay Banner — prominent, shown above detail card -->
                    ${payBannerHtml}

                    <!-- Mission Detail Card — always shown as a structured reference -->
                    <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:24px 0;">
                        <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                            <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Mission Details</p>
                        </div>
                        <table style="width:100%;border-collapse:collapse;">
                            <tbody>${detailsHtml}</tbody>
                        </table>
                    </div>

                    ${notesBlock}

                    <p style="font-size:14px;color:#475569;line-height:1.6;margin-top:24px;">
                        Please let us know if you're available and interested by clicking one of the buttons below — our operations team will follow up right away.
                    </p>

                    <!-- Two-button response CTA -->
                    <div style="text-align:center;margin:28px 0 16px;">
                        <a href="${mission.interestedUrl || `mailto:${replyTo}?subject=Interested: ${encodeURIComponent(mission.title)}`}"
                           style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.01em;margin:0 6px 8px;">
                            ✅ &nbsp; I'm Interested
                        </a>
                        <a href="${mission.unavailableUrl || `mailto:${replyTo}?subject=Not Available: ${encodeURIComponent(mission.title)}`}"
                           style="display:inline-block;background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.01em;margin:0 6px 8px;">
                            ❌ &nbsp; Not Available
                        </a>
                    </div>

                    <p style="font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
                        Or simply reply to this email to reach the operations team directly.
                    </p>
                </div>

                <!-- Footer -->
                <div style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px;text-align:center;">
                    <p style="font-size:11px;color:#475569;margin:0;">
                        &copy; ${year} CoatzaDrone / Axis Platform. All rights reserved.<br>
                        This inquiry was sent by the Axis operations team. To stop receiving these, contact your operations manager.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail(pilot.email, subject, html);
};

/**
 * Send "Not Selected" notification to a pilot/technician
 * @param {object} pilot - { name, email }
 * @param {object} mission - { title, siteName, date, location }
 */
export const sendMissionNotSelectedEmail = async (pilot, mission) => {
    const subject = `Mission Update: ${mission.title}`;
    const year = new Date().getFullYear();
    const siteDisplay = mission.siteName || mission.title;
    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
        <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
            <div style="max-width:600px;margin:40px auto;padding:0 20px;">
                <!-- Header -->
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">Axis Enterprise Platform</div>
                    <div style="font-size:26px;font-weight:900;color:#f8fafc;letter-spacing:-0.05em;">Mission Update</div>
                    <div style="width:48px;height:3px;background:linear-gradient(90deg,#64748b,#94a3b8);border-radius:999px;margin:12px auto 0;"></div>
                </div>

                <!-- Body -->
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
                    <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hi <strong>${pilot.name}</strong>,</p>

                    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px;">
                        Thank you for your interest and availability for the <strong>${mission.title}</strong> mission${mission.siteName ? ` at <strong>${mission.siteName}</strong>` : ''}.
                        We truly appreciate your responsiveness and professionalism.
                    </p>

                    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
                        After careful review, we have filled all required positions for this mission with other personnel. 
                        <strong>You have not been selected for this particular assignment.</strong>
                    </p>

                    <!-- Mission card -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
                        <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;">Mission Details</p>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;">
                            <tr><td style="padding:5px 0;color:#64748b;font-weight:700;width:80px;">Mission</td><td style="padding:5px 0;color:#1e293b;">${mission.title}</td></tr>
                            ${mission.siteName ? `<tr><td style="padding:5px 0;color:#64748b;font-weight:700;">Site</td><td style="padding:5px 0;color:#1e293b;">${mission.siteName}</td></tr>` : ''}
                            ${mission.date     ? `<tr><td style="padding:5px 0;color:#64748b;font-weight:700;">Date</td><td style="padding:5px 0;color:#1e293b;">${mission.date}</td></tr>` : ''}
                            ${mission.location ? `<tr><td style="padding:5px 0;color:#64748b;font-weight:700;">Location</td><td style="padding:5px 0;color:#1e293b;">${mission.location}</td></tr>` : ''}
                        </table>
                    </div>

                    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 8px;">
                        This does <strong>not</strong> reflect your standing in our network. We have additional missions coming up and will be reaching out when your skills and availability are a match.
                    </p>

                    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0;">
                        Thank you again for your time and commitment to the Coatza Drone team.
                    </p>
                </div>

                <!-- Footer -->
                <div style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px;text-align:center;margin-top:-16px;">
                    <p style="font-size:11px;color:#475569;margin:0;">
                        &copy; ${year} CoatzaDrone / Axis Platform. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
    return sendEmail(pilot.email, subject, html);
};
