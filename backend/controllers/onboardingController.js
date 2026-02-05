/**
 * Onboarding Controller
 * Handles HTTP requests for onboarding system (Personnel & Client Wizard)
 */

import db from '../config/database.js';
import * as onboardingService from '../services/onboardingService.js';
import { upload } from '../utils/fileUpload.js';
import { AppError } from '../middleware/errorHandler.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * ==========================================
 * PERSONNEL ONBORADING (Legacy/Portal)
 * ==========================================
 */

/**
 * Create and send onboarding package
 * POST /api/onboarding/send
 */
export const sendOnboardingPackage = async (req, res) => {
    try {
        const { personnelId } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        if (!personnelId) {
            return res.status(400).json({
                success: false,
                message: 'Personnel ID is required'
            });
        }

        // Create package
        const pkg = await onboardingService.createOnboardingPackage(
            personnelId,
            tenantId,
            userId
        );

        // Send email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const result = await onboardingService.sendOnboardingPackage(pkg.id, frontendUrl);

        res.json({
            success: true,
            message: 'Onboarding package sent successfully',
            data: {
                packageId: pkg.id,
                portalUrl: result.portalUrl
            }
        });
    } catch (error) {
        console.error('Error sending onboarding package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send onboarding package',
            error: error.message
        });
    }
};

/**
 * Get onboarding portal (public - no auth required)
 * GET /api/onboarding/portal/:token
 */
export const getOnboardingPortal = async (req, res) => {
    try {
        const { token } = req.params;

        const pkg = await onboardingService.getPackageByToken(token);

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Onboarding package not found or expired'
            });
        }

        res.json({
            success: true,
            data: {
                personnelName: pkg.full_name,
                email: pkg.email,
                role: pkg.role,
                status: pkg.status,
                documents: pkg.documents.map(doc => ({
                    id: doc.id,
                    type: doc.document_type,
                    name: doc.document_name,
                    status: doc.status,
                    completedAt: doc.completed_at
                })),
                expiresAt: pkg.expires_at
            }
        });
    } catch (error) {
        console.error('Error fetching onboarding portal:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load onboarding portal',
            error: error.message
        });
    }
};

/**
 * Upload completed document
 * POST /api/onboarding/portal/:token/upload
 */
export const uploadDocument = async (req, res) => {
    try {
        const { token } = req.params;
        const { documentId } = req.body;

        // Verify token is valid
        const pkg = await onboardingService.getPackageByToken(token);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // File should be uploaded via multer middleware
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Save file to onboarding directory
        const uploadDir = path.join(process.cwd(), 'uploads', 'onboarding', pkg.tenant_id, pkg.personnel_id);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${documentId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, req.file.buffer);

        // Generate file URL (relative path for serving)
        const fileUrl = `/uploads/onboarding/${pkg.tenant_id}/${pkg.personnel_id}/${fileName}`;

        // Mark document as completed
        await onboardingService.completeDocument(documentId, fileUrl);

        res.json({
            success: true,
            message: 'Document uploaded successfully',
            data: {
                fileUrl
            }
        });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload document',
            error: error.message
        });
    }
};

/**
 * Get all onboarding packages (admin)
 * GET /api/onboarding/packages
 */
export const getAllPackages = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const packages = await onboardingService.getAllPackages(tenantId);

        res.json({
            success: true,
            data: packages
        });
    } catch (error) {
        console.error('Error fetching onboarding packages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch onboarding packages',
            error: error.message
        });
    }
};

/**
 * Get onboarding package for specific personnel
 * GET /api/onboarding/packages/:personnelId
 */
export const getPackageByPersonnelId = async (req, res) => {
    try {
        const { personnelId } = req.params;
        const tenantId = req.user.tenantId;

        const pkg = await onboardingService.getPackageByPersonnelId(personnelId);

        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'No onboarding package found for this personnel'
            });
        }

        // Verify tenant isolation
        if (pkg.tenant_id !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: pkg
        });
    } catch (error) {
        console.error('Error fetching personnel onboarding package:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch onboarding package',
            error: error.message
        });
    }
};

/**
 * ==========================================
 * CLIENT ONBOARDING (New Wizard)
 * ==========================================
 */

/**
 * Handle Onboarding Configs
 */
export const createOnboardingConfig = async (req, res, next) => {
    try {
        const { templateName, industry, config } = req.body;
        const result = await db.query(
            'INSERT INTO client_onboarding_configs (template_name, industry, config, created_by_user_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [templateName, industry, config, req.user.id]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

export const getOnboardingConfig = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM client_onboarding_configs WHERE id = $1', [id]);
        if (result.rows.length === 0) return next(new AppError('Config not found', 404));
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

export const updateOnboardingConfig = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { config, clientId } = req.body;
        const result = await db.query(
            'UPDATE client_onboarding_configs SET config = COALESCE($1, config), client_id = COALESCE($2, client_id), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [config, clientId, id]
        );
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * Handle Client Settings
 */
export const getClientSettings = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const result = await db.query('SELECT * FROM client_settings WHERE client_id = $1', [clientId]);
        res.status(200).json({ success: true, data: result.rows[0] || null });
    } catch (error) {
        next(error);
    }
};

export const updateClientSettings = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const settings = req.body;

        // Upsert logic
        const query = `
            INSERT INTO client_settings (
                client_id, work_structure, default_sla_hours, preferred_contact_method, 
                escalation_contact_email, notification_preferences, deliverable_formats, 
                deliverable_notes, qa_required, data_destination_type, data_destination_value, 
                data_destination_instructions, billing_contact_name, billing_contact_email, 
                billing_contact_phone, billing_address_line1, billing_address_line2, 
                billing_city, billing_state, billing_zip, billing_country, po_required, 
                invoice_delivery_method, invoice_email_list, tax_notes, lbd_template_type, 
                block_id_convention_notes, kml_usage, client_asset_editing
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
            ON CONFLICT (client_id) DO UPDATE SET
                work_structure = EXCLUDED.work_structure,
                default_sla_hours = EXCLUDED.default_sla_hours,
                preferred_contact_method = EXCLUDED.preferred_contact_method,
                escalation_contact_email = EXCLUDED.escalation_contact_email,
                notification_preferences = EXCLUDED.notification_preferences,
                deliverable_formats = EXCLUDED.deliverable_formats,
                deliverable_notes = EXCLUDED.deliverable_notes,
                qa_required = EXCLUDED.qa_required,
                data_destination_type = EXCLUDED.data_destination_type,
                data_destination_value = EXCLUDED.data_destination_value,
                data_destination_instructions = EXCLUDED.data_destination_instructions,
                billing_contact_name = EXCLUDED.billing_contact_name,
                billing_contact_email = EXCLUDED.billing_contact_email,
                billing_contact_phone = EXCLUDED.billing_contact_phone,
                billing_address_line1 = EXCLUDED.billing_address_line1,
                billing_address_line2 = EXCLUDED.billing_address_line2,
                billing_city = EXCLUDED.billing_city,
                billing_state = EXCLUDED.billing_state,
                billing_zip = EXCLUDED.billing_zip,
                billing_country = EXCLUDED.billing_country,
                po_required = EXCLUDED.po_required,
                invoice_delivery_method = EXCLUDED.invoice_delivery_method,
                invoice_email_list = EXCLUDED.invoice_email_list,
                tax_notes = EXCLUDED.tax_notes,
                lbd_template_type = EXCLUDED.lbd_template_type,
                block_id_convention_notes = EXCLUDED.block_id_convention_notes,
                kml_usage = EXCLUDED.kml_usage,
                client_asset_editing = EXCLUDED.client_asset_editing,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const values = [
            clientId, settings.work_structure, settings.default_sla_hours, settings.preferred_contact_method,
            settings.escalation_contact_email, JSON.stringify(settings.notification_preferences), JSON.stringify(settings.deliverable_formats),
            settings.deliverable_notes, settings.qa_required, settings.data_destination_type, settings.data_destination_value,
            settings.data_destination_instructions, settings.billing_contact_name, settings.billing_contact_email,
            settings.billing_contact_phone, settings.billing_address_line1, settings.billing_address_line2,
            settings.billing_city, settings.billing_state, settings.billing_zip, settings.billing_country, settings.po_required,
            settings.invoice_delivery_method, JSON.stringify(settings.invoice_email_list), settings.tax_notes, settings.lbd_template_type,
            settings.block_id_convention_notes, settings.kml_usage, settings.client_asset_editing
        ];

        const result = await db.query(query, values);
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

export const updateOnboardingStep = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { step, status } = req.body;
        await db.query(
            'UPDATE clients SET onboarding_step = $1, onboarding_status = $2 WHERE id = $3',
            [step, status || 'IN_PROGRESS', id]
        );
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};
