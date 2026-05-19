-- ============================================================
-- AXIS PLATFORM — RBAC SCHEMA MIGRATION
-- Run this against your PostgreSQL / Supabase instance.
-- Tables: projects, missions, lbd_table, deliverables
-- ============================================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────
-- PROJECTS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_name    TEXT NOT NULL,
    client_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    site_location   TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','on_hold','cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status  ON projects(status);

-- ──────────────────────────────────────────
-- MISSIONS
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    mission_name        TEXT NOT NULL,
    site                TEXT NOT NULL,
    kml_url             TEXT,
    flight_date         DATE,
    assigned_pilot_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','in_flight','completed','cancelled')),
    -- Sensitive — admin-only fields
    pricing             NUMERIC(12,2),
    internal_notes      TEXT,
    pilot_pay           NUMERIC(12,2),
    contract_value      NUMERIC(12,2),
    internal_qa         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_project   ON missions(project_id);
CREATE INDEX IF NOT EXISTS idx_missions_pilot     ON missions(assigned_pilot_id);
CREATE INDEX IF NOT EXISTS idx_missions_status    ON missions(status);

-- ──────────────────────────────────────────
-- LBD TABLE (Line-By-line Defects)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lbd_table (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mission_id      UUID REFERENCES missions(id) ON DELETE SET NULL,
    block           TEXT NOT NULL,
    row             TEXT,
    issue_type      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'identified'
                        CHECK (status IN ('identified','in_progress','resolved')),
    identified_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_date   DATE,
    notes           TEXT,   -- internal only; stripped from non-admin responses
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lbd_project  ON lbd_table(project_id);
CREATE INDEX IF NOT EXISTS idx_lbd_mission  ON lbd_table(mission_id);
CREATE INDEX IF NOT EXISTS idx_lbd_status   ON lbd_table(status);

-- ──────────────────────────────────────────
-- DELIVERABLES
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliverables (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    orthomosaic_url TEXT,
    model_3d_url    TEXT,
    report_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_project ON deliverables(project_id);

-- ──────────────────────────────────────────
-- ROW-LEVEL SECURITY (Supabase / pg)
-- ──────────────────────────────────────────
-- Enable RLS so the DB layer also enforces scoping
-- (Optional — the API layer enforces this too, but defense-in-depth is good)

-- ALTER TABLE projects    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE missions    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lbd_table   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
