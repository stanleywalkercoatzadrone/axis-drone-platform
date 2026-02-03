-- Onboarding System Migration
-- Adds tables for tracking pilot onboarding packages and document completion

-- Onboarding Packages Table
CREATE TABLE IF NOT EXISTS onboarding_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    sent_at TIMESTAMP,
    sent_by UUID REFERENCES users(id),
    access_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'in_progress', 'completed')),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Onboarding Documents Table
CREATE TABLE IF NOT EXISTS onboarding_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID REFERENCES onboarding_packages(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- 'nda', 'w9', 'direct_deposit', 'emergency_contact'
    document_name VARCHAR(255) NOT NULL,
    template_url TEXT, -- URL to blank PDF template
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    completed_at TIMESTAMP,
    completed_file_url TEXT, -- URL to completed/signed document
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_packages_personnel ON onboarding_packages(personnel_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_packages_token ON onboarding_packages(access_token);
CREATE INDEX IF NOT EXISTS idx_onboarding_packages_tenant ON onboarding_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_package ON onboarding_documents(package_id);

-- Add onboarding status to personnel table
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'not_sent' 
    CHECK (onboarding_status IN ('not_sent', 'sent', 'in_progress', 'completed'));
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS onboarding_sent_at TIMESTAMP;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;
