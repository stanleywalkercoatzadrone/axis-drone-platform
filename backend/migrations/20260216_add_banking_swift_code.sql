-- Migration: Add swift_code to pilot_banking_info
-- Description: Adds swift_code column to the pilot_banking_info table for international transfers

ALTER TABLE pilot_banking_info 
ADD COLUMN IF NOT EXISTS swift_code VARCHAR(255);
