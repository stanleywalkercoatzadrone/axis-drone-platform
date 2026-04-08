-- Add pilot_score column to pilot_metrics (was missing from original schema)
-- Safe to run multiple times
ALTER TABLE pilot_metrics
    ADD COLUMN IF NOT EXISTS pilot_score INT DEFAULT 0;
