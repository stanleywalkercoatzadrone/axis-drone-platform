-- Migration: Add payment_days to invoices and initialize setting
-- Description: Supports configurable payment terms

-- 1. Add column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_days INTEGER DEFAULT 30;

-- 2. Initialize global setting in system_settings if it doesn't exist
INSERT INTO system_settings (setting_key, setting_value, encrypted)
SELECT 'invoice_payment_days', '30', false
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings WHERE setting_key = 'invoice_payment_days'
);
