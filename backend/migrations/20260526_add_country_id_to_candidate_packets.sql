-- Add country_id column to candidate_packets (was missing from original migration)
ALTER TABLE candidate_packets
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_packets_country ON candidate_packets(country_id);
