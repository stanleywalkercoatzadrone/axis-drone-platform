/**
 * Onboarding Service
 * Business logic for pilot onboarding system
 */

import crypto from 'crypto';
import db from '../config/database.js';
import { sendOnboardingEmail, sendOnboardingReminder } from './emailService.js';

/**
 * Generate secure random token for portal access
 */
const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Create onboarding package for personnel
 * @param {string} personnelId 
 * @param {string} tenantId 
 * @param {string} userId - Admin who is sending
 * @returns {object} Package with token
 */
export const createOnboardingPackage = async (personnelId, tenantId, userId) => {
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // Generate secure token
        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

        // Create package
        const packageResult = await client.query(
            `INSERT INTO onboarding_packages 
            (personnel_id, tenant_id, sent_by, access_token, expires_at, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING *`,
            [personnelId, tenantId, userId, token, expiresAt]
        );

        const packageId = packageResult.rows[0].id;

        // Create default documents
        // Template PDFs are available in uploads directory
        const documents = [
            {
                type: 'nda',
                name: 'Non-Disclosure Agreement (NDA)',
                templateUrl: '/uploads/CoatzadroneUSA_NDA.pdf'
            },
            {
                type: 'pilot_agreement',
                name: 'Pilot Services Agreement',
                templateUrl: '/uploads/Coatzadrone_USA_Pilot_Agreement.pdf'
            },
            {
                type: 'onboarding_guide',
                name: 'Pilot Onboarding Guide',
                templateUrl: '/uploads/Coatzadrone_USA_Pilot_Onboarding_Guide_Polished.pdf'
            },
            {
                type: 'w9',
                name: 'W-9 Tax Form',
                templateUrl: null // Pilots can download from IRS.gov
            },
            {
                type: 'direct_deposit',
                name: 'Direct Deposit Authorization',
                templateUrl: null // TODO: Upload Direct Deposit form template
            }
        ];

        for (const doc of documents) {
            await client.query(
                `INSERT INTO onboarding_documents 
                (package_id, document_type, document_name, template_url, status)
                VALUES ($1, $2, $3, $4, 'pending')`,
                [packageId, doc.type, doc.name, doc.templateUrl]
            );
        }

        await client.query('COMMIT');

        return packageResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Send onboarding email to personnel
 * @param {string} packageId 
 * @param {string} frontendUrl 
 */
export const sendOnboardingPackage = async (packageId, frontendUrl) => {
    // Get package details
    const packageResult = await db.query(
        `SELECT op.*, p.full_name, p.email 
         FROM onboarding_packages op
         JOIN personnel p ON op.personnel_id = p.id
         WHERE op.id = $1`,
        [packageId]
    );

    if (packageResult.rows.length === 0) {
        throw new Error('Onboarding package not found');
    }

    const pkg = packageResult.rows[0];

    // Get documents
    const docsResult = await db.query(
        `SELECT document_name FROM onboarding_documents WHERE package_id = $1`,
        [packageId]
    );

    const documents = docsResult.rows.map(row => ({ name: row.document_name }));

    // Generate portal URL
    const portalUrl = `${frontendUrl}/onboarding/${pkg.access_token}`;

    // Send email
    await sendOnboardingEmail({
        to: pkg.email,
        personnelName: pkg.full_name,
        portalUrl,
        documents
    });

    // Update package status
    await db.query(
        `UPDATE onboarding_packages 
         SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [packageId]
    );

    // Update personnel onboarding status
    await db.query(
        `UPDATE personnel 
         SET onboarding_status = 'sent', onboarding_sent_at = NOW()
         WHERE id = $1`,
        [pkg.personnel_id]
    );

    return { success: true, portalUrl };
};

/**
 * Get onboarding package by token (for portal access)
 * @param {string} token 
 */
export const getPackageByToken = async (token) => {
    const result = await db.query(
        `SELECT op.*, p.full_name, p.email, p.role
         FROM onboarding_packages op
         JOIN personnel p ON op.personnel_id = p.id
         WHERE op.access_token = $1 AND op.expires_at > NOW()`,
        [token]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const pkg = result.rows[0];

    // Get documents
    const docsResult = await db.query(
        `SELECT * FROM onboarding_documents WHERE package_id = $1 ORDER BY created_at`,
        [pkg.id]
    );

    pkg.documents = docsResult.rows;

    return pkg;
};

/**
 * Mark document as completed
 * @param {string} documentId 
 * @param {string} fileUrl 
 */
export const completeDocument = async (documentId, fileUrl) => {
    await db.query(
        `UPDATE onboarding_documents 
         SET status = 'completed', completed_at = NOW(), completed_file_url = $1, updated_at = NOW()
         WHERE id = $2`,
        [fileUrl, documentId]
    );

    // Check if all documents in package are completed
    const docResult = await db.query(
        `SELECT package_id FROM onboarding_documents WHERE id = $1`,
        [documentId]
    );

    const packageId = docResult.rows[0].package_id;

    const pendingResult = await db.query(
        `SELECT COUNT(*) as count FROM onboarding_documents 
         WHERE package_id = $1 AND status = 'pending'`,
        [packageId]
    );

    // If no pending documents, mark package as completed
    if (parseInt(pendingResult.rows[0].count) === 0) {
        await db.query(
            `UPDATE onboarding_packages 
             SET status = 'completed', completed_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [packageId]
        );

        // Update personnel status
        const pkgResult = await db.query(
            `SELECT personnel_id FROM onboarding_packages WHERE id = $1`,
            [packageId]
        );

        await db.query(
            `UPDATE personnel 
             SET onboarding_status = 'completed', onboarding_completed_at = NOW()
             WHERE id = $1`,
            [pkgResult.rows[0].personnel_id]
        );
    } else {
        // Mark as in progress
        await db.query(
            `UPDATE onboarding_packages 
             SET status = 'in_progress', updated_at = NOW()
             WHERE id = $1`,
            [packageId]
        );

        const pkgResult = await db.query(
            `SELECT personnel_id FROM onboarding_packages WHERE id = $1`,
            [packageId]
        );

        await db.query(
            `UPDATE personnel 
             SET onboarding_status = 'in_progress'
             WHERE id = $1`,
            [pkgResult.rows[0].personnel_id]
        );
    }

    return { success: true };
};

/**
 * Get all onboarding packages for a tenant
 * @param {string} tenantId 
 */
export const getAllPackages = async (tenantId) => {
    const result = await db.query(
        `SELECT op.*, p.full_name, p.email, p.role,
         (SELECT COUNT(*) FROM onboarding_documents WHERE package_id = op.id AND status = 'completed') as completed_docs,
         (SELECT COUNT(*) FROM onboarding_documents WHERE package_id = op.id) as total_docs
         FROM onboarding_packages op
         JOIN personnel p ON op.personnel_id = p.id
         WHERE op.tenant_id = $1
         ORDER BY op.created_at DESC`,
        [tenantId]
    );

    return result.rows;
};

/**
 * Get onboarding package for specific personnel
 * @param {string} personnelId 
 */
export const getPackageByPersonnelId = async (personnelId) => {
    const result = await db.query(
        `SELECT op.*,
         (SELECT COUNT(*) FROM onboarding_documents WHERE package_id = op.id AND status = 'completed') as completed_docs,
         (SELECT COUNT(*) FROM onboarding_documents WHERE package_id = op.id) as total_docs
         FROM onboarding_packages op
         WHERE op.personnel_id = $1
         ORDER BY op.created_at DESC
         LIMIT 1`,
        [personnelId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const pkg = result.rows[0];

    // Get documents
    const docsResult = await db.query(
        `SELECT * FROM onboarding_documents WHERE package_id = $1 ORDER BY created_at`,
        [pkg.id]
    );

    pkg.documents = docsResult.rows;

    return pkg;
};
