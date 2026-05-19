-- ============================================================
-- SaaS Subscription Invoice System
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_invoices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug      TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
    invoice_number   TEXT UNIQUE NOT NULL,
    plan             TEXT NOT NULL DEFAULT 'starter',
    amount           NUMERIC(10,2) NOT NULL,
    currency         TEXT NOT NULL DEFAULT 'USD',
    description      TEXT,
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    status           TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | paid | overdue | void
    due_date         DATE,
    sent_at          TIMESTAMPTZ,
    paid_at          TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_inv_tenant  ON subscription_invoices(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_sub_inv_status  ON subscription_invoices(status);

-- Auto-generate invoice number sequence
CREATE SEQUENCE IF NOT EXISTS subscription_invoice_seq START 1000;

-- Function to generate readable invoice numbers like INV-1001
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || LPAD(nextval('subscription_invoice_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT 'subscription_invoices table ready' as status;
