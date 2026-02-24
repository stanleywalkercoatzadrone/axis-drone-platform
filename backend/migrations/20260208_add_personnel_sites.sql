-- Add assigned_site_ids column to personnel table
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS assigned_site_ids TEXT[];
