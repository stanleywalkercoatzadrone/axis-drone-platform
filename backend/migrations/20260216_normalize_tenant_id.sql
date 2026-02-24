-- Standardize tenant_id to TEXT to support both UUIDs and legacy strings ('default')
ALTER TABLE personnel ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE deployments ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE pilot_availability ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE onboarding_packages ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE availability_sync ALTER COLUMN tenant_id TYPE TEXT;

-- Backfill missing tenant_ids with 'default' for development consistency
UPDATE personnel SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE deployments SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE pilot_availability SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE onboarding_packages SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE availability_sync SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE reports SET tenant_id = 'default' WHERE tenant_id IS NULL;
