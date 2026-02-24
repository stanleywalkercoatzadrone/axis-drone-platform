-- Migration: Add industry column to deployments for per-industry mission segregation
-- Run: psql $DATABASE_URL -f this_file.sql

ALTER TABLE deployments
    ADD COLUMN IF NOT EXISTS industry VARCHAR(50);

-- Backfill from client's industry (if client is linked via client_id or site)
UPDATE deployments d
SET industry = c.industry
FROM clients c
WHERE (d.client_id = c.id OR EXISTS (
    SELECT 1 FROM sites s WHERE s.id = d.site_id AND s.client_id = c.id
))
AND d.industry IS NULL
AND c.industry IS NOT NULL;

-- Add index for fast filtering
CREATE INDEX IF NOT EXISTS idx_deployments_industry ON deployments(industry);

COMMENT ON COLUMN deployments.industry IS 'Industry context: Solar, Insurance, Construction, Utilities, Telecom';
