-- ============================================================
-- PASTE THIS IN SUPABASE SQL EDITOR → CLICK RUN
-- Phase 1: SaaS Tenant Foundation
-- ============================================================

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    slug                   TEXT UNIQUE NOT NULL,
    plan                   TEXT NOT NULL DEFAULT 'starter',
    status                 TEXT NOT NULL DEFAULT 'active',
    owner_email            TEXT,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    plan_limits            JSONB DEFAULT '{"max_pilots":3,"max_missions":10,"ai_reports":false,"white_label":false}'::jsonb,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 2. Insert Coatzadrone as Tenant #1
INSERT INTO tenants (name, slug, plan, status, plan_limits)
VALUES ('Coatzadrone USA', 'coatzadrone', 'enterprise', 'active',
        '{"max_pilots":-1,"max_missions":-1,"ai_reports":true,"white_label":true}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET plan = 'enterprise';

-- 3. Add tenant_id to tables missing it (all safe with IF NOT EXISTS)
ALTER TABLE personnel         ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE clients           ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE client_contacts   ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE client_projects   ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE invoices          ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE master_invoices   ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE solar_blocks      ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE upload_jobs       ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE upload_files      ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE ai_reports        ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE sites             ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE assets            ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE workbooks         ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';
ALTER TABLE work_items        ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'coatzadrone';

-- 4. Backfill ALL existing data → 'coatzadrone'
UPDATE users         SET tenant_id = 'coatzadrone' WHERE tenant_id = 'default' OR tenant_id IS NULL;
UPDATE reports       SET tenant_id = 'coatzadrone' WHERE tenant_id = 'default' OR tenant_id IS NULL;
UPDATE deployments   SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL OR tenant_id = 'default' OR tenant_id = '';
UPDATE personnel     SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL OR tenant_id = 'default';
UPDATE clients       SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL OR tenant_id = 'default';
UPDATE invoices      SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL OR tenant_id = 'default';
UPDATE master_invoices SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL OR tenant_id = 'default';
UPDATE solar_blocks  SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE upload_jobs   SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE ai_reports    SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE sites         SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE assets        SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE workbooks     SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;
UPDATE work_items    SET tenant_id = 'coatzadrone' WHERE tenant_id IS NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_personnel_tenant    ON personnel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant      ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant     ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_solar_blocks_tenant ON solar_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_tenant  ON upload_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_tenant   ON ai_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_tenant        ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_tenant       ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_items_tenant   ON work_items(tenant_id);

-- 6. Verify (run this to confirm)
SELECT 'tenants' as tbl, COUNT(*)::text as count FROM tenants
UNION ALL SELECT 'users → coatzadrone', COUNT(*)::text FROM users WHERE tenant_id = 'coatzadrone'
UNION ALL SELECT 'deployments → coatzadrone', COUNT(*)::text FROM deployments WHERE tenant_id = 'coatzadrone'
UNION ALL SELECT 'personnel → coatzadrone', COUNT(*)::text FROM personnel WHERE tenant_id = 'coatzadrone';
