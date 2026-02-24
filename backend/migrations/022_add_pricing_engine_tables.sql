-- Migration: Smart Pricing & Profit Engine
-- Description: Adds pricing metadata to deployments and regional cost factors

-- 1. Add pricing fields to deployments
ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS base_cost DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5, 2) DEFAULT 30.00,
ADD COLUMN IF NOT EXISTS client_price DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_duration_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS travel_costs DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS equipment_costs DECIMAL(12, 2) DEFAULT 0;

-- 2. Regional Cost Table
CREATE TABLE IF NOT EXISTS regional_cost_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_name VARCHAR(100) UNIQUE NOT NULL,
    labor_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    lodging_daily_rate DECIMAL(10, 2) DEFAULT 150.00,
    travel_per_mile DECIMAL(10, 2) DEFAULT 0.65,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed some default regional factors
INSERT INTO regional_cost_factors (region_name, labor_multiplier, lodging_daily_rate)
VALUES 
('California', 1.25, 250.00),
('Texas', 1.0, 150.00),
('New York', 1.3, 300.00),
('Florida', 1.05, 180.00)
ON CONFLICT (region_name) DO NOTHING;

-- Index for region lookups
CREATE INDEX IF NOT EXISTS idx_regional_costs_name ON regional_cost_factors(region_name);
