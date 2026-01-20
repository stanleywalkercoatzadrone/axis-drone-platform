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
 */
export const sendInvoiceEmail = async (pilot, deployment, invoiceLink, amount) => {
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
            <p>
                <a href="${invoiceLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Invoice</a>
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                If the button doesn't work, copy this link:<br>
                ${invoiceLink}
            </p>
        </div>
    `;

    return sendEmail(pilot.email, subject, html);
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
