-- Migration to ensure cascade deletion for clients
-- This allows deleting a client and automatically removing all associated data

-- 1. Sites
ALTER TABLE sites 
DROP CONSTRAINT IF EXISTS sites_client_id_fkey;

ALTER TABLE sites
ADD CONSTRAINT sites_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 2. Stakeholder Profiles (Note: already had it but ensuring consistency)
ALTER TABLE stakeholder_profiles
DROP CONSTRAINT IF EXISTS stakeholder_profiles_client_id_fkey;

ALTER TABLE stakeholder_profiles
ADD CONSTRAINT stakeholder_profiles_client_id_fkey
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 3. Ingestion Jobs (Verify exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ingestion_jobs') THEN
        ALTER TABLE ingestion_jobs 
        DROP CONSTRAINT IF EXISTS ingestion_jobs_client_id_fkey;

        ALTER TABLE ingestion_jobs
        ADD CONSTRAINT ingestion_jobs_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
    END IF;
END $$;
