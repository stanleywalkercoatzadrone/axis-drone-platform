-- Migration: Add viewed_at to invoices
-- Description: Track when an invoice was first viewed

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP;
