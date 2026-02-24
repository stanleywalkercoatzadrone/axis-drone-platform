-- Migration: AXIS PLATFORM – SAFE ADDITIVE UPDATE (v2.4.0)
-- Description: Add site tracking fields, pilot profile enhancements, and document tracking.

-- 1. Enhance Sites table with LBD tracking
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS total_lbd_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scanned_lbd_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS issue_lbd_count INTEGER DEFAULT 0;

-- 2. Enhance Personnel table for Pilot Profiles
ALTER TABLE personnel
ADD COLUMN IF NOT EXISTS town VARCHAR(255),
ADD COLUMN IF NOT EXISTS certifications TEXT,
ADD COLUMN IF NOT EXISTS equipment TEXT;

-- 3. Create Pilot Documents table
DROP TABLE IF EXISTS pilot_documents;
CREATE TABLE pilot_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    url TEXT NOT NULL,
    size INTEGER,
    category VARCHAR(100) NOT NULL, -- 'Flight Logs', 'Insurance', 'Certification', 'Site Documentation', 'Other'
    expiration_date DATE,
    ai_metadata JSONB DEFAULT '{}'::jsonb, -- Store AI scannable results like compliance flags
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add updated_at trigger for pilot_documents
CREATE TRIGGER update_pilot_documents_updated_at BEFORE UPDATE ON pilot_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index for pilot documents
CREATE INDEX idx_pilot_documents_personnel_id ON pilot_documents(personnel_id);
CREATE INDEX idx_pilot_documents_category ON pilot_documents(category);
