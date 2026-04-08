-- ============================================================
-- Migration: Upload Tracking Hardening
-- Date: 2026-04-06
-- Adds checksum + chunk tracking to existing upload_jobs table
-- Adds upload_chunks table for resumable uploads
-- ADDITIVE ONLY — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ── Extend existing upload_jobs ───────────────────────────────
ALTER TABLE upload_jobs
    ADD COLUMN IF NOT EXISTS checksum          TEXT,       -- SHA-256 of full file
    ADD COLUMN IF NOT EXISTS chunk_count       INT  DEFAULT 1,   -- total expected chunks
    ADD COLUMN IF NOT EXISTS received_chunks   INT  DEFAULT 0,   -- chunks received so far
    ADD COLUMN IF NOT EXISTS upload_mode       TEXT DEFAULT 'single',  -- 'single' | 'chunked'
    ADD COLUMN IF NOT EXISTS initialized_at    TIMESTAMPTZ;    -- when init was called

-- ── New table: upload_chunks (for resumable uploads) ─────────
CREATE TABLE IF NOT EXISTS upload_chunks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID        NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
    chunk_idx   INT         NOT NULL,                          -- 0-indexed chunk position
    size_bytes  BIGINT,                                        -- size of this chunk
    checksum    TEXT,                                          -- SHA-256 of chunk buffer
    received    BOOLEAN     NOT NULL DEFAULT FALSE,
    storage_key TEXT,                                          -- temporary GCS/S3 path
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(job_id, chunk_idx)
);

CREATE INDEX IF NOT EXISTS idx_upload_chunks_job
    ON upload_chunks(job_id);

CREATE INDEX IF NOT EXISTS idx_upload_chunks_pending
    ON upload_chunks(job_id, received)
    WHERE received = FALSE;

-- RLS consistency
ALTER TABLE upload_chunks ENABLE ROW LEVEL SECURITY;

-- ── Verification ─────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'upload_jobs' AND column_name IN ('checksum', 'chunk_count');
-- Should return 2 rows after migration.
