-- Migration: Enhanced Pilot Profile & Compliance
-- Description: Adds detailed profile fields and document compliance tracking

-- 1. Enhance Personnel Profile
ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_classification VARCHAR(50), -- W9, W8-BEN, etc.
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- 2. Enhance Pilot Documents
-- Ensure table exists (it might be in previous migrations, but good to ensure)
CREATE TABLE IF NOT EXISTS pilot_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    country_id UUID, -- Optional link to country specific docs
    document_type VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    validation_status VARCHAR(50) DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pilot_documents
ADD COLUMN IF NOT EXISTS expiration_date DATE,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verified_by UUID, -- References users(id)
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Pilot Notes (History)
CREATE TABLE IF NOT EXISTS pilot_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id),
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pilot_documents_pilot ON pilot_documents(pilot_id);
CREATE INDEX IF NOT EXISTS idx_pilot_notes_pilot ON pilot_notes(pilot_id);
