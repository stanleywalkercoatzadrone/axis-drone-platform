-- Migration: 20260210_activate_americas_banking
-- Description: Activates all Americas regions/countries and adds pilot banking info table

-- 1. Activate Central America
INSERT INTO regions (name, status) VALUES 
('Central America', 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

-- 2. Activate All Countries
UPDATE countries SET status = 'ENABLED';

-- 3. Add Missing Countries (Central America)
DO $$
DECLARE
    ca_id UUID;
BEGIN
    SELECT id INTO ca_id FROM regions WHERE name = 'Central America';

    INSERT INTO countries (name, iso_code, region_id, aviation_authority, default_language, currency, units_of_measurement, status)
    VALUES 
    ('Costa Rica', 'CR', ca_id, 'DGAC', 'es', 'CRC', 'metric', 'ENABLED'),
    ('Panama', 'PA', ca_id, 'AAC', 'es', 'PAB', 'metric', 'ENABLED'),
    ('Guatemala', 'GT', ca_id, 'DGAC', 'es', 'GTQ', 'metric', 'ENABLED'),
    ('El Salvador', 'SV', ca_id, 'AAC', 'es', 'USD', 'metric', 'ENABLED'),
    ('Honduras', 'HN', ca_id, 'AHAC', 'es', 'HNL', 'metric', 'ENABLED'),
    ('Nicaragua', 'NI', ca_id, 'INAC', 'es', 'NIO', 'metric', 'ENABLED'),
    ('Belize', 'BZ', ca_id, 'BDCA', 'en', 'BZD', 'metric', 'ENABLED')
    ON CONFLICT (iso_code) DO NOTHING;
END $$;

-- 4. Create Pilot Banking Info Table
CREATE TABLE IF NOT EXISTS pilot_banking_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(255) NOT NULL, -- Encrypted in application layer, stored as text here
    routing_number VARCHAR(255), -- Routing (US), CLABE (MX), etc.
    account_type VARCHAR(50) DEFAULT 'Checking', -- Checking, Savings, etc.
    currency VARCHAR(3) NOT NULL, -- USD, MXN, etc.
    country_id UUID REFERENCES countries(id), -- Optional link for validation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pilot_id) -- One banking record per pilot for now
);
