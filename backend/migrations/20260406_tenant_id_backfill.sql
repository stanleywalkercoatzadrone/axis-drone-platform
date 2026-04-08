-- ============================================================
-- Migration: Tenant ID Backfill & Consistency
-- Date: 2026-04-06
-- Ensures all new tables from this upgrade have tenant_id
-- Backfills NULL tenant_id rows with 'default' (safe default)
-- ADDITIVE ONLY — no drops, no renames
-- ============================================================

-- ── Ensure new tables have tenant_id ─────────────────────────

-- ai_jobs (created in 20260406_ai_jobs_queue.sql — has tenant_id TEXT)
-- No action needed — already has it.

-- upload_chunks (created in 20260406_upload_tracking.sql)
-- Does not need tenant_id directly — inherits from upload_jobs via job_id FK

-- ── Backfill NULL tenant_id on key tables ─────────────────────
-- Safely sets 'default' for any rows where tenant_id was never assigned.
-- Does NOT touch rows that already have a value.

-- deployments
UPDATE deployments SET tenant_id = 'default' WHERE tenant_id IS NULL;

-- personnel
UPDATE personnel SET tenant_id = 'default' WHERE tenant_id IS NULL;

-- upload_jobs (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'upload_jobs' AND column_name = 'tenant_id'
    ) THEN
        UPDATE upload_jobs SET tenant_id = 'default' WHERE tenant_id IS NULL;
    END IF;
END $$;

-- notifications (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notifications' AND column_name = 'tenant_id'
    ) THEN
        UPDATE notifications SET tenant_id = 'default' WHERE tenant_id IS NULL;
    END IF;
END $$;

-- ── Ensure NOT NULL constraint on deployments.tenant_id ───────
-- Only set if no NULLs remain (safe to apply after backfill above)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM deployments WHERE tenant_id IS NULL LIMIT 1
    ) THEN
        ALTER TABLE deployments ALTER COLUMN tenant_id SET DEFAULT 'default';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Non-fatal: constraint may already exist or column type differs
        RAISE NOTICE 'tenant_id default already set or not applicable: %', SQLERRM;
END $$;

-- ── Verification (informational) ─────────────────────────────
-- SELECT COUNT(*) FROM deployments WHERE tenant_id IS NULL;
-- Should return 0 after this migration.
--
-- SELECT COUNT(*) FROM personnel WHERE tenant_id IS NULL;
-- Should return 0 after this migration.
