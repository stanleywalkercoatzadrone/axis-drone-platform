-- ============================================================
-- Migration: SaaS Tenant Foundation
-- Date: 2026-04-01
-- Purpose: Convert Axis platform to full multi-tenant SaaS.
--   1. Create tenants table (the org registry)
--   2. Insert Coatzadrone as Tenant #1
--   3. Add tenant_id to tables that are missing it
--   4. Backfill all existing 'default' / NULL tenant_id records
--      to point at the Coatzadrone tenant UUID
-- ============================================================

-- ── 1. Tenants table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    slug                    TEXT UNIQUE NOT NULL,   -- e.g. 'coatzadrone', 'acme-solar'
    plan                    TEXT NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
    status                  TEXT NOT NULL DEFAULT 'active',  -- active | suspended | cancelled
    owner_email             TEXT,
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    plan_limits             JSONB DEFAULT '{
        "max_pilots": 3,
        "max_missions": 10,
        "ai_reports": false,
        "white_label": false
    }'::jsonb,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ── 2. Insert Coatzadrone as Tenant #1 ────────────────────────
INSERT INTO tenants (name, slug, plan, status, plan_limits)
VALUES (
    'Coatzadrone USA',
    'coatzadrone',
    'enterprise',
    'active',
    '{
        "max_pilots": -1,
        "max_missions": -1,
        "ai_reports": true,
        "white_label": true
    }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
    SET plan = 'enterprise',
        plan_limits = '{
            "max_pilots": -1,
            "max_missions": -1,
            "ai_reports": true,
            "white_label": true
        }'::jsonb;

-- ── 3. Add tenant_id FK to tables that are missing it ────────
-- users already has tenant_id as TEXT — we will change type later,
-- for now we work with it as TEXT matching the tenant slug/UUID.

-- personnel
ALTER TABLE personnel
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- clients
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- client_contacts
ALTER TABLE client_contacts
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- client_projects
ALTER TABLE client_projects
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- invoices
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- master_invoices
ALTER TABLE master_invoices
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- solar_blocks
ALTER TABLE solar_blocks
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- upload_jobs
ALTER TABLE upload_jobs
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- upload_files
ALTER TABLE upload_files
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- ai_reports
ALTER TABLE ai_reports
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- sites
ALTER TABLE sites
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- assets
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- workbooks
ALTER TABLE workbooks
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- work_items
ALTER TABLE work_items
    ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- notifications
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS tenant_id_uuid TEXT DEFAULT 'coatzadrone';

-- ── 4. Backfill all existing data → 'coatzadrone' tenant ─────
-- We use the slug string ('coatzadrone') as the tenant identifier
-- since users.tenant_id is currently TEXT = 'default'.
-- All existing records with 'default' or NULL get tagged as Coatzadrone.

UPDATE users
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE reports
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE deployments
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL OR tenant_id = '';

UPDATE personnel
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE clients
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE client_contacts
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE client_projects
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE invoices
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE master_invoices
    SET tenant_id = 'coatzadrone'
    WHERE tenant_id = 'default' OR tenant_id IS NULL;

UPDATE vendor_expenses
    SET tenant_id = NULL   -- vendor_expenses.tenant_id is UUID type; will handle separately
    WHERE tenant_id IS NULL;

UPDATE solar_blocks   SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE upload_jobs    SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE upload_files   SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE ai_reports     SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE sites          SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE assets         SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE workbooks      SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE work_items     SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;

-- ── 5. Add indexes for performance ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_personnel_tenant_id    ON personnel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id      ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id     ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_master_inv_tenant_id   ON master_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_solar_blocks_tenant    ON solar_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_tenant     ON upload_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_tenant      ON ai_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_tenant           ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant          ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_items_tenant      ON work_items(tenant_id);

-- ── Verification query (run manually to confirm) ──────────────
-- SELECT tenant_id, COUNT(*) FROM users GROUP BY tenant_id;
-- SELECT tenant_id, COUNT(*) FROM deployments GROUP BY tenant_id;
-- SELECT tenant_id, COUNT(*) FROM personnel GROUP BY tenant_id;
-- All should show: coatzadrone | N (total your row count)
