-- Migration 100: Add city and state columns to deployments table
-- These columns store the parsed city and state from the location field
-- to enable automatic geocoding for weather forecasting.
-- Uses IF NOT EXISTS so this is safe to run multiple times.

ALTER TABLE deployments
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- Backfill: parse existing location values like "Houston, TX" into city/state
-- Only runs where city is null but location exists
UPDATE deployments
SET
    city  = TRIM(SPLIT_PART(location, ',', 1)),
    state = TRIM(SPLIT_PART(location, ',', 2))
WHERE
    location IS NOT NULL
    AND location LIKE '%,%'
    AND city IS NULL;
