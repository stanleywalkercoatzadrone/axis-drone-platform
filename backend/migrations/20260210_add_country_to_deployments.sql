-- Migration: 20260210_add_country_to_deployments
-- Description: Adds country_id to deployments table

ALTER TABLE deployments 
ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_deployments_country_id ON deployments(country_id);
