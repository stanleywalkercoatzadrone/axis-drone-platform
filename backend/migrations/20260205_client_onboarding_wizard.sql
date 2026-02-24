-- Migration 20260205: Client Onboarding Wizard & Settings
-- Created: 2026-02-05

-- 1. Client Onboarding Configs (For Pre-Wizard Setup)
CREATE TABLE IF NOT EXISTS client_onboarding_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    industry VARCHAR(50),
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store enabled/required field toggles
    created_by_user_id UUID REFERENCES users(id),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Client Settings (Operational, Deliverables, Billing)
CREATE TABLE IF NOT EXISTS client_settings (
    client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Operations Defaults
    work_structure VARCHAR(20) DEFAULT 'site', -- 'site', 'project', 'both'
    default_sla_hours INTEGER DEFAULT 48,
    preferred_contact_method VARCHAR(20) DEFAULT 'email', -- 'email', 'sms', 'both'
    escalation_contact_email VARCHAR(255),
    notification_preferences JSONB DEFAULT '{"notify_on_upload_complete": true, "notify_on_deliverable_ready": true, "notify_on_overdue": true}'::jsonb,
    
    -- Deliverables
    deliverable_formats JSONB DEFAULT '["pdf"]'::jsonb,
    deliverable_notes TEXT,
    qa_required BOOLEAN DEFAULT TRUE,
    
    -- Delivery Destination
    data_destination_type VARCHAR(50) DEFAULT 'google_drive',
    data_destination_value TEXT,
    data_destination_instructions TEXT,
    
    -- Billing
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_contact_phone VARCHAR(50),
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_zip VARCHAR(20),
    billing_country VARCHAR(100) DEFAULT 'US',
    po_required BOOLEAN DEFAULT FALSE,
    invoice_delivery_method VARCHAR(20) DEFAULT 'email',
    invoice_email_list JSONB DEFAULT '[]'::jsonb,
    tax_notes TEXT,
    
    -- Solar Specific (Conditional)
    lbd_template_type VARCHAR(50) DEFAULT 'unknown',
    block_id_convention_notes TEXT,
    kml_usage VARCHAR(50) DEFAULT 'unknown',
    client_asset_editing VARCHAR(50) DEFAULT 'read_only',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add Onboarding progress to Clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'IN_PROGRESS';

-- 4. Triggers for updated_at
CREATE TRIGGER update_client_onboarding_configs_updated_at BEFORE UPDATE ON client_onboarding_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_settings_updated_at BEFORE UPDATE ON client_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
