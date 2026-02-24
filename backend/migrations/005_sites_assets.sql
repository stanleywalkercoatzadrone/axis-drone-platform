-- Migration 005: Sites and Assets

-- Create Sites table
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Asset Category Enum (Mapping to Typescript enum)
-- COMMENDED OUT TO AVOID CONFLICT WITH NEW ASSET GRID
/*
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(50) PRIMARY KEY, -- Using custom IDs like LBD-101
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Active',
    last_inspection_date TIMESTAMP WITH TIME ZONE,
    next_inspection_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
*/

-- Insert Sample Sites
INSERT INTO sites (name, client, location, status) VALUES 
('West Field Solar Array', 'GreenEnergy Corp', 'Nevada, USA', 'Active'),
('North Tower Cluster', 'Telco Giant', 'Washington, USA', 'Active'),
('Downtown Commercial Properties', 'Urban Real Estate', 'San Francisco, USA', 'Active')
ON CONFLICT DO NOTHING;

-- Insert Sample Assets (Referencing first site)
/*
DO $$
DECLARE
    site_id_1 UUID;
    site_id_2 UUID;
    site_id_3 UUID;
BEGIN
    SELECT id INTO site_id_1 FROM sites WHERE name = 'West Field Solar Array' LIMIT 1;
    SELECT id INTO site_id_2 FROM sites WHERE name = 'North Tower Cluster' LIMIT 1;
    SELECT id INTO site_id_3 FROM sites WHERE name = 'Downtown Commercial Properties' LIMIT 1;

    INSERT INTO assets (id, site_id, name, category, location, status, last_inspection_date, next_inspection_date) VALUES 
    ('LBD-101', site_id_1, 'North Substation Link', 'Load Balance Disconnect', 'Sector 4', 'Active', '2025-05-15', '2025-06-15'),
    ('FM-304', site_id_1, 'Sector 7 Survey', 'Flight Mission', 'West Field', 'Maintenance', '2025-05-10', NULL),
    ('UT-112', site_id_1, 'Transformer Bank 4', 'Utility Asset', 'Substation Alpha', 'Active', '2025-05-18', NULL),
    ('CT-902', site_id_2, 'Tower 492 Alpha', 'Cell Tower', 'Ridge Line', 'Active', '2025-04-20', '2025-07-20'),
    ('IP-551', site_id_3, 'Commercial Warehouse B', 'Insurance Property', 'Industrial Park', 'Active', '2025-05-01', NULL);
END $$;
*/
