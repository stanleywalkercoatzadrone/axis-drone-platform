-- Migration: Add address and banking info to personnel
-- Description: Stores data required for invoice generation

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS routing_number TEXT;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS account_number TEXT;
