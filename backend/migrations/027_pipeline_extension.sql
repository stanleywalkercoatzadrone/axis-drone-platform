-- ============================================================
-- 027_pipeline_extension.sql
-- Axis Unified Processing Pipeline — extend mission_datasets
-- Safe additive migration
-- ============================================================

-- Extend mission_datasets with full pipeline lifecycle fields
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS pipeline_status    VARCHAR(30)  DEFAULT 'uploading';
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS pipeline_progress   INTEGER      DEFAULT 0;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS result_url          TEXT;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS ai_summary          JSONB        DEFAULT '{}'::jsonb;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS error_message       TEXT;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS dataset_type        VARCHAR(30)  DEFAULT 'orthomosaic';
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS worker_job_id       TEXT;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS gcs_raw_prefix      TEXT;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS gcs_processed_prefix TEXT;
ALTER TABLE mission_datasets ADD COLUMN IF NOT EXISTS ai_analysis_path    TEXT;

-- Pipeline jobs table — one row per worker execution
CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      UUID NOT NULL REFERENCES mission_datasets(id) ON DELETE CASCADE,
    mission_id      UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL,
    job_type        VARCHAR(30) NOT NULL DEFAULT 'orthomosaic',  -- orthomosaic | thermal | lbd
    priority        VARCHAR(10) NOT NULL DEFAULT 'normal',       -- high | normal | low
    status          VARCHAR(30) NOT NULL DEFAULT 'queued',
    -- queued → processing → analyzing → completed | failed
    progress        INTEGER DEFAULT 0,
    worker_id       TEXT,
    error_message   TEXT,
    odm_cmd         TEXT,
    odm_output      TEXT,
    ai_result       JSONB DEFAULT '{}'::jsonb,
    image_count     INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_dataset   ON pipeline_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_mission   ON pipeline_jobs(mission_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status    ON pipeline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_priority  ON pipeline_jobs(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_mission_datasets_pipeline ON mission_datasets(pipeline_status);

DROP TRIGGER IF EXISTS trg_pipeline_jobs_updated ON pipeline_jobs;
CREATE TRIGGER trg_pipeline_jobs_updated
    BEFORE UPDATE ON pipeline_jobs
    FOR EACH ROW EXECUTE FUNCTION update_mission_ingestion_updated_at();
