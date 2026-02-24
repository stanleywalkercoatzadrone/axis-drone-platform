-- Create Master Invoices Table
CREATE TABLE IF NOT EXISTS master_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'SENT', -- SENT, VIEWED, PAID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Master Invoice Items to link Personnel Invoices to Master Invoice
-- This allows us to track which pilots are included in a specific Master Invoice
CREATE TABLE IF NOT EXISTS master_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_invoice_id UUID NOT NULL REFERENCES master_invoices(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id),
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_invoices_token ON master_invoices(token);
CREATE INDEX IF NOT EXISTS idx_master_invoice_items_master_id ON master_invoice_items(master_invoice_id);
