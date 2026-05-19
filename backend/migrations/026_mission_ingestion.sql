-- ============================================================
-- 026_mission_ingestion.sql
-- Axis Mission Ingestion Engine (Enterprise Chunked Uploads)
-- ============================================================

-- Table to track overall mission dataset upload process
CREATE TABLE IF NOT EXISTS mission_datasets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    mission_id          UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, uploading, processing, completed, failed
    total_files         INTEGER DEFAULT 0,
    uploaded_files      INTEGER DEFAULT 0,
    failed_files        INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track individual files (enables parallel processing, chunk management)
CREATE TABLE IF NOT EXISTS mission_files (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    dataset_id          UUID NOT NULL REFERENCES mission_datasets(id) ON DELETE CASCADE,
    mission_id          UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    file_name           TEXT NOT NULL,
    file_size           BIGINT DEFAULT 0,
    file_type           VARCHAR(20) DEFAULT 'other', -- rgb, thermal, kml, other
    storage_path        TEXT,
    upload_status       VARCHAR(20) DEFAULT 'queued', -- queued, uploading, completed, failed
    chunk_count         INTEGER DEFAULT 1,
    uploaded_chunks     INTEGER DEFAULT 0,
    checksum            TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track upload session metadata (to securely resume broken uploads)
CREATE TABLE IF NOT EXISTS upload_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    dataset_id          UUID NOT NULL REFERENCES mission_datasets(id) ON DELETE CASCADE,
    file_id             UUID NOT NULL REFERENCES mission_files(id) ON DELETE CASCADE,
    upload_token        TEXT NOT NULL,
    chunk_size          INTEGER NOT NULL DEFAULT 10485760, -- 10MB default
    total_chunks        INTEGER NOT NULL DEFAULT 1,
    uploaded_chunks     INTEGER NOT NULL DEFAULT 0,
    status              VARCHAR(20) DEFAULT 'active', -- active, paused, completed, failed
    last_activity       TIMESTAMPTZ DEFAULT NOW()
);

-- Create specific indexes for high-throughput uploading querying
CREATE INDEX IF NOT EXISTS idx_mission_datasets_mission ON mission_datasets(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_datasets_tenant ON mission_datasets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mission_files_dataset ON mission_files(dataset_id);
CREATE INDEX IF NOT EXISTS idx_mission_files_mission ON mission_files(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_files_tenant ON mission_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_file ON upload_sessions(file_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_token ON upload_sessions(upload_token);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_mission_ingestion_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mission_datasets_update ON mission_datasets;
CREATE TRIGGER trg_mission_datasets_update
    BEFORE UPDATE ON mission_datasets
    FOR EACH ROW EXECUTE FUNCTION update_mission_ingestion_updated_at();

DROP TRIGGER IF EXISTS trg_mission_files_update ON mission_files;
CREATE TRIGGER trg_mission_files_update
    BEFORE UPDATE ON mission_files
    FOR EACH ROW EXECUTE FUNCTION update_mission_ingestion_updated_at();
