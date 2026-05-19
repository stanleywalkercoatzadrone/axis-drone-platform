-- Add pilots_needed to deployments if it does not exist
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS pilots_needed integer;
