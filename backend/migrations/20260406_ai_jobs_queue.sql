-- ============================================================
-- Migration: Async AI Job Queue
-- Date: 2026-04-06
-- Requires: ENABLE_ASYNC_AI=true to use, but safe to run always
-- ADDITIVE ONLY — no existing tables modified
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_jobs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id      UUID        REFERENCES deployments(id) ON DELETE SET NULL,
    media_id        UUID,                                       -- upload_files or upload_jobs ref
    user_id         UUID,                                       -- requesting user
    tenant_id       TEXT        DEFAULT 'default',
    status          TEXT        NOT NULL DEFAULT 'pending',     -- pending|processing|completed|failed
    analysis_type   TEXT        NOT NULL DEFAULT 'inspection',  -- inspection|daily_summary|thermal|orchestration
    attempts        INT         NOT NULL DEFAULT 0,
    max_attempts    INT         NOT NULL DEFAULT 3,
    result_json     JSONB,                                      -- structured Gemini output
    error           TEXT,                                       -- last error message
    metadata        JSONB       DEFAULT '{}',                   -- extra context (imageUrls, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for worker polling (pending jobs, oldest first)
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created
    ON ai_jobs(status, created_at ASC)
    WHERE status = 'pending';

-- Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user
    ON ai_jobs(user_id, created_at DESC);

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_ai_jobs_tenant
    ON ai_jobs(tenant_id, status);

-- Index for mission association
CREATE INDEX IF NOT EXISTS idx_ai_jobs_mission
    ON ai_jobs(mission_id);

-- RLS consistency
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_ai_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_jobs_updated_at ON ai_jobs;

CREATE TRIGGER trg_ai_jobs_updated_at
    BEFORE UPDATE ON ai_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_jobs_updated_at();

-- ── Verification (informational) ─────────────────────────────
-- SELECT COUNT(*) FROM ai_jobs; -- Should return 0 on fresh install
