-- Migration to connect clients and deployments (missions)
-- Created: 2026-02-05

-- 1. Add client_id column to deployments
ALTER TABLE deployments 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_deployments_client_id ON deployments(client_id);

-- 3. Optional: Backfill client_id from site_id if site is linked to a client
UPDATE deployments d
SET client_id = s.client_id
FROM sites s
WHERE d.site_id = s.id AND d.client_id IS NULL AND s.client_id IS NOT NULL;
