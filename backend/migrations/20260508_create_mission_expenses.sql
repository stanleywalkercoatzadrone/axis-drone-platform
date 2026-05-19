-- Migration: 20260508_create_mission_expenses.sql
-- Creates the mission_expenses table used by the Expenses section.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS mission_expenses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID,
    mission_id   UUID REFERENCES deployments(id) ON DELETE SET NULL,
    category     TEXT NOT NULL DEFAULT 'Other',
    description  TEXT,
    amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor       TEXT,
    uploaded_by  UUID,
    file_name    TEXT,
    file_url     TEXT,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_me_tenant  ON mission_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_me_mission ON mission_expenses(mission_id);
CREATE INDEX IF NOT EXISTS idx_me_date    ON mission_expenses(expense_date DESC);
