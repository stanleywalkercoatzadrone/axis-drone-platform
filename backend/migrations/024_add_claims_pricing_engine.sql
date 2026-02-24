-- Migration: Claims Pricing Engine Schema
-- Description: Adds tables for precise line-item pricing (Xactimate style) and associates them with claims reports

-- 1. Claims Pricing Categories (e.g., RFG for Roofing, SDG for Siding)
CREATE TABLE IF NOT EXISTS claim_pricing_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,      -- 'RFG'
    name VARCHAR(100) NOT NULL,            -- 'Roofing'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Claims Pricing Items (e.g., RFG 240S - Laminated Shingles)
CREATE TABLE IF NOT EXISTS claim_pricing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES claim_pricing_categories(id) ON DELETE CASCADE,
    item_code VARCHAR(20) UNIQUE NOT NULL, -- 'RFG 240S'
    description TEXT NOT NULL,             -- 'Laminated Shingles - Remove & Replace'
    unit VARCHAR(10) NOT NULL,             -- 'SQ', 'LF', 'EA', 'SF'
    default_unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Report Line Items (The actual line items attached to a specific claim report)
CREATE TABLE IF NOT EXISTS claims_report_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES claims_reports(id) ON DELETE CASCADE,
    pricing_item_id UUID REFERENCES claim_pricing_items(id) ON DELETE SET NULL,
    -- Denormalize standard fields in case the master catalog changes later
    item_code VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    unit VARCHAR(10) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pricing_items_category ON claim_pricing_items(category_id);
CREATE INDEX IF NOT EXISTS idx_pricing_items_code ON claim_pricing_items(item_code);
CREATE INDEX IF NOT EXISTS idx_report_line_items_report ON claims_report_line_items(report_id);


-- ==========================================
-- SEED DATA: Basic Roofing & Siding Catalog
-- ==========================================

-- Insert Categories
INSERT INTO claim_pricing_categories (code, name, description)
VALUES 
    ('RFG', 'Roofing', 'Roofing materials and labor'),
    ('SDG', 'Siding', 'Siding materials and labor'),
    ('GUT', 'Gutters', 'Rain gutters and downspouts'),
    ('WTR', 'Water Extraction', 'Water mitigation and extraction')
ON CONFLICT (code) DO NOTHING;

-- Insert Items
WITH categories AS (
    SELECT id, code FROM claim_pricing_categories
)
INSERT INTO claim_pricing_items (category_id, item_code, description, unit, default_unit_cost)
VALUES 
    -- ROOFING
    ((SELECT id FROM categories WHERE code = 'RFG'), 'RFG 240S', 'Laminated - Comp. Shingle rfg. - w/out felt', 'SQ', 285.50),
    ((SELECT id FROM categories WHERE code = 'RFG'), 'RFG 240SR', 'Remove Laminated - Comp. Shingle rfg. - w/out felt', 'SQ', 75.20),
    ((SELECT id FROM categories WHERE code = 'RFG'), 'RFG FELT15', 'Roofing felt - 15 lb.', 'SQ', 35.00),
    ((SELECT id FROM categories WHERE code = 'RFG'), 'RFG RIDGE', 'Ridge cap - composition shingles', 'LF', 6.50),
    ((SELECT id FROM categories WHERE code = 'RFG'), 'RFG TARR', 'Tear off, haul and dispose of comp. shingles', 'SQ', 85.00),
    
    -- SIDING
    ((SELECT id FROM categories WHERE code = 'SDG'), 'SDG ALUM', 'Siding - aluminum', 'SF', 4.85),
    ((SELECT id FROM categories WHERE code = 'SDG'), 'SDG ALUMR', 'Remove Siding - aluminum', 'SF', 0.95),
    ((SELECT id FROM categories WHERE code = 'SDG'), 'SDG VNL', 'Siding - vinyl', 'SF', 3.75),
    ((SELECT id FROM categories WHERE code = 'SDG'), 'SDG VNLR', 'Remove Siding - vinyl', 'SF', 0.80),

    -- GUTTERS
    ((SELECT id FROM categories WHERE code = 'GUT'), 'GUT 5', 'Gutter / downspout - aluminum - up to 5"', 'LF', 8.25),
    ((SELECT id FROM categories WHERE code = 'GUT'), 'GUT 5R', 'Remove Gutter / downspout - aluminum - up to 5"', 'LF', 1.50)
ON CONFLICT (item_code) DO NOTHING;
