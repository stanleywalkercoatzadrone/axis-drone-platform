-- Migration: Add company_name to personnel
-- Description: Adds optional company_name field to personnel table

ALTER TABLE personnel
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
