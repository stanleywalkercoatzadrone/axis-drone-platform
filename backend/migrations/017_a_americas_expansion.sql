-- Migration: 20260210_americas_expansion
-- Description: Adds Region -> Country hierarchy and related tables for Americas expansion (Mexico live)

-- 1. Regions Table
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Countries Table
CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    iso_code VARCHAR(2) NOT NULL UNIQUE, -- e.g., 'US', 'MX', 'CA'
    region_id UUID REFERENCES regions(id),
    aviation_authority VARCHAR(255), -- e.g., 'FAA', 'AFAC'
    default_language VARCHAR(50), -- e.g., 'en', 'es'
    currency VARCHAR(3), -- e.g., 'USD', 'MXN'
    units_of_measurement VARCHAR(50) DEFAULT 'imperial', -- 'imperial' or 'metric'
    status VARCHAR(50) DEFAULT 'DISABLED', -- 'ENABLED' or 'DISABLED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Pilot Country Authorizations
CREATE TABLE IF NOT EXISTS pilot_country_authorizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL, -- References personnel(id) or users(id) depending on implementation (personnel is likely correct based on context)
    country_id UUID NOT NULL REFERENCES countries(id),
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'
    license_number VARCHAR(255),
    authority VARCHAR(255),
    expiration_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pilot_id, country_id)
);

-- 4. Pilot Documents (Country-Scoped)
CREATE TABLE IF NOT EXISTS pilot_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL,
    country_id UUID REFERENCES countries(id), -- Nullable if global, but here we focusing on compliance
    document_type VARCHAR(255) NOT NULL, -- e.g., 'Medical Certificate', 'License'
    file_url TEXT,
    expiration_date DATE,
    validation_status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Pricing Rules (Country-Specific)
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID NOT NULL REFERENCES countries(id),
    industry VARCHAR(50) NOT NULL, -- e.g., 'Solar', 'Utilities'
    rate_type VARCHAR(50) NOT NULL, -- e.g., 'HOURLY', 'DAILY', 'PER_ACRE'
    rate_value DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data: Regions
INSERT INTO regions (name, status) VALUES 
('North America', 'ACTIVE'),
('Central America', 'ACTIVE'),
('South America', 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

-- Seed Data: Countries
DO $$
DECLARE
    na_id UUID;
    sa_id UUID;
BEGIN
    SELECT id INTO na_id FROM regions WHERE name = 'North America';
    SELECT id INTO sa_id FROM regions WHERE name = 'South America';

    -- United States: 'Status' indicates config, so leaving as DISABLED as implicit default handled by codebase.
    -- Mexico: ENABLED.
    INSERT INTO countries (name, iso_code, region_id, aviation_authority, default_language, currency, units_of_measurement, status)
    VALUES 
    ('United States', 'US', na_id, 'FAA', 'en', 'USD', 'imperial', 'DISABLED'),
    ('Mexico', 'MX', na_id, 'AFAC', 'es', 'MXN', 'metric', 'ENABLED'),
    ('Canada', 'CA', na_id, 'TC', 'en', 'CAD', 'metric', 'DISABLED'),
    ('Brazil', 'BR', sa_id, 'ANAC', 'pt', 'BRL', 'metric', 'DISABLED'),
    ('Chile', 'CL', sa_id, 'DGAC', 'es', 'CLP', 'metric', 'DISABLED'),
    ('Colombia', 'CO', sa_id, 'UAEAC', 'es', 'COP', 'metric', 'DISABLED')
    ON CONFLICT (iso_code) DO NOTHING;
END $$;
