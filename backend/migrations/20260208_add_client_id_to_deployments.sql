-- Add client_id column to deployments for direct mission-client linking
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Optional: Create an index for performance
CREATE INDEX IF NOT EXISTS idx_deployments_client_id ON deployments(client_id);
