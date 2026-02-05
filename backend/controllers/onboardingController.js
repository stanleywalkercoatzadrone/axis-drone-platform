import db from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

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
