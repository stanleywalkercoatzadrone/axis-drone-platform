-- Platform stabilization: make production-facing implicit startup columns explicit.

ALTER TABLE ingestion_jobs
    ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_tenant
    ON ingestion_jobs(tenant_id);

ALTER TABLE upload_jobs
    ADD COLUMN IF NOT EXISTS tenant_id TEXT,
    ADD COLUMN IF NOT EXISTS pix4d_job_id TEXT,
    ADD COLUMN IF NOT EXISTS pix4d_project_url TEXT,
    ADD COLUMN IF NOT EXISTS pix4d_status TEXT,
    ADD COLUMN IF NOT EXISTS pix4d_error TEXT,
    ADD COLUMN IF NOT EXISTS pix4d_dispatched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_upload_jobs_tenant
    ON upload_jobs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_upload_jobs_pix4d_status
    ON upload_jobs(pix4d_status);
