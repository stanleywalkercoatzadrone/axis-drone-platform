-- Migration: 023_add_invoice_overrides
-- Description: Adds snapshot/override columns to the invoices table to support per-invoice editing

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS routing_number VARCHAR(255),
ADD COLUMN IF NOT EXISTS swift_code VARCHAR(50);

-- Update existing invoices to have some default snapshotted data if possible
-- (Optional, but helps with consistency for already generated invoices)
UPDATE invoices i
SET 
    home_address = p.home_address,
    bank_name = p.bank_name,
    account_number = p.account_number,
    routing_number = p.routing_number,
    swift_code = p.swift_code
FROM personnel p
WHERE i.personnel_id = p.id
AND i.home_address IS NULL;
