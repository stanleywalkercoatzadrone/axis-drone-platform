-- Migration: Add swift_code to personnel
-- Description: Adds optional swift_code field to personnel table for international banking

ALTER TABLE personnel
ADD COLUMN IF NOT EXISTS swift_code VARCHAR(50);
