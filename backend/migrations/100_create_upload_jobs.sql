-- Migration: Create upload_jobs and upload_files tables
-- Description: Pilot AI upload pipeline — stores job metadata and per-file results

-- Upload jobs table
CREATE TABLE IF NOT EXISTS upload_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pilot_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id      UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    upload_type     VARCHAR(50)  NOT NULL DEFAULT 'images',
    analysis_type   VARCHAR(100) DEFAULT 'thermal_fault',
    mission_folder  VARCHAR(255),
    lbd_block       VARCHAR(255),
    notes           TEXT,
    status          VARCHAR(30)  NOT NULL DEFAULT 'pending',
    report_url      TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Upload files table
CREATE TABLE IF NOT EXISTS upload_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
    file_name       VARCHAR(512) NOT NULL,
    file_size       BIGINT       DEFAULT 0,
    file_path       TEXT,
    storage_url     TEXT,
    status          VARCHAR(30)  NOT NULL DEFAULT 'pending',
    ai_result       JSONB,
    pix4d_job_id    VARCHAR(255),
    error_message   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_upload_jobs_pilot_id   ON upload_jobs(pilot_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_mission_id ON upload_jobs(mission_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_status     ON upload_jobs(status);
CREATE INDEX IF NOT EXISTS idx_upload_files_job_id    ON upload_files(job_id);
CREATE INDEX IF NOT EXISTS idx_upload_files_status    ON upload_files(status);
