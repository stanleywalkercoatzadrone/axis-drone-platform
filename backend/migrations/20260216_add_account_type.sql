-- Add account_type to personnel and invoices tables
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS account_type VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS account_type VARCHAR(50);
