-- Migration: 20260216_snapshot_banking_to_invoices
-- Description: Adds snapshot columns to invoices table to preserve banking info at time of creation

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS routing_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS swift_code VARCHAR(255);
