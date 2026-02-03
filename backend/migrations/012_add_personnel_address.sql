-- Migration: Add home address to personnel
-- Description: Stores pilot/technician home address for invoice generation

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS home_address TEXT;
