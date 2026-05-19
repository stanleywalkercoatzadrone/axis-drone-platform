-- ============================================================
-- 025_orthomosaic_module.sql
-- Axis Orthomosaic Processing Module — DB schema
-- Safe additive migration: all CREATE TABLE IF NOT EXISTS
-- ============================================================

-- Projects group upload sets by client / site / mission
CREATE TABLE IF NOT EXISTS orthomosaic_projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    site_name       VARCHAR(255),
    mission_id      UUID,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Processing jobs — one per flight set submitted for processing
CREATE TABLE IF NOT EXISTS orthomosaic_jobs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id                  UUID NOT NULL REFERENCES orthomosaic_projects(id) ON DELETE CASCADE,
    tenant_id                   UUID NOT NULL,
    -- status lifecycle: queued → validating → processing → generating_tiles → completed
    --                                                    → warning | failed | canceled
    status                      VARCHAR(50) NOT NULL DEFAULT 'queued',
    processing_engine           VARCHAR(50) NOT NULL DEFAULT 'mock', -- 'mock' | 'odm' | 'colmap'
    quality_tier                VARCHAR(20) NOT NULL DEFAULT 'standard', -- 'fast' | 'standard' | 'high'
    pipeline_stage              VARCHAR(100),
    progress_pct                INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    stage_logs                  JSONB DEFAULT '[]'::jsonb,
    error_message               TEXT,
    image_count                 INTEGER DEFAULT 0,
    failed_image_count          INTEGER DEFAULT 0,
    validated_image_count       INTEGER DEFAULT 0,
    has_gps_fraction            DECIMAL(5,2),  -- pct images with GPS (0-100)
    metadata_completeness_score INTEGER DEFAULT 0, -- 0-100
    flight_date                 DATE,
    acquisition_date            DATE,
    pilot_id                    UUID REFERENCES users(id) ON DELETE SET NULL,
    gsd_cm                      DECIMAL(8,2),   -- ground sampling distance cm/px
    coverage_ha                 DECIMAL(10,2),  -- coverage area in hectares
    output_resolution_mpx       DECIMAL(8,2),
    processing_started_at       TIMESTAMPTZ,
    processing_completed_at     TIMESTAMPTZ,
    processing_duration_seconds INTEGER,
    retry_count                 INTEGER DEFAULT 0,
    max_retries                 INTEGER DEFAULT 3,
    engine_job_id               VARCHAR(255),   -- external engine task UUID (NodeODM etc)
    upload_set_gcs_prefix       TEXT,           -- GCS folder containing raw images
    created_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Individual image files within a job's upload set
CREATE TABLE IF NOT EXISTS orthomosaic_upload_sets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID NOT NULL REFERENCES orthomosaic_jobs(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL,
    file_name           VARCHAR(255) NOT NULL,
    gcs_path            TEXT,
    file_size_bytes     BIGINT,
    content_type        VARCHAR(100),
    -- EXIF metadata (populated client-side or during ingestion)
    has_gps             BOOLEAN DEFAULT FALSE,
    latitude            DECIMAL(10,7),
    longitude           DECIMAL(10,7),
    altitude_m          DECIMAL(8,2),
    camera_make         VARCHAR(100),
    camera_model        VARCHAR(100),
    focal_length_mm     DECIMAL(8,2),
    image_width         INTEGER,
    image_height        INTEGER,
    capture_timestamp   TIMESTAMPTZ,
    -- validation
    metadata_complete   BOOLEAN DEFAULT FALSE,
    validation_status   VARCHAR(20) DEFAULT 'pending', -- pending | ok | warning | error
    validation_notes    TEXT,
    upload_status       VARCHAR(20) DEFAULT 'pending', -- pending | uploading | uploaded | failed
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Generated output files (orthomosaic, tiles, thumbnail, DSM placeholder, etc.)
CREATE TABLE IF NOT EXISTS orthomosaic_outputs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                UUID NOT NULL REFERENCES orthomosaic_jobs(id) ON DELETE CASCADE,
    tenant_id             UUID NOT NULL,
    output_type           VARCHAR(50) NOT NULL,
    -- types: orthomosaic | tiles | thumbnail | dsm | dtm | pointcloud | mesh | report | preview
    file_name             VARCHAR(255),
    gcs_path              TEXT,
    tile_base_path        TEXT,    -- GCS prefix for XYZ tile set
    preview_url           TEXT,
    file_size_bytes       BIGINT,
    version               INTEGER DEFAULT 1,
    is_approved           BOOLEAN DEFAULT NULL, -- null = pending review
    approved_by           UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at           TIMESTAMPTZ,
    metadata              JSONB DEFAULT '{}'::jsonb,
    -- metadata fields: resolution, crs, bounds, gsd_cm, format, tileset_zoom_range, etc.
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Links outputs to Axis entities (missions, sites, blocks, LBDs, inverters)
CREATE TABLE IF NOT EXISTS orthomosaic_asset_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES orthomosaic_jobs(id) ON DELETE CASCADE,
    output_id   UUID REFERENCES orthomosaic_outputs(id) ON DELETE SET NULL,
    tenant_id   UUID NOT NULL,
    asset_type  VARCHAR(50) NOT NULL, -- mission | site | block | lbd | inverter | client | deployment
    asset_id    VARCHAR(255) NOT NULL,
    asset_label VARCHAR(255),         -- human-readable label cached for display
    linked_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- QA / processing reports (generated after each completed job)
CREATE TABLE IF NOT EXISTS orthomosaic_qc_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  UUID NOT NULL REFERENCES orthomosaic_jobs(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL,
    images_used             INTEGER DEFAULT 0,
    images_rejected         INTEGER DEFAULT 0,
    gps_coverage_pct        DECIMAL(5,2),
    estimated_gsd_cm        DECIMAL(8,2),
    estimated_coverage_ha   DECIMAL(10,2),
    metadata_score          INTEGER DEFAULT 0, -- 0-100
    overlap_confidence      VARCHAR(20),       -- low | medium | high | unknown
    processing_duration_s   INTEGER,
    output_file_size_mb     DECIMAL(10,2),
    warnings                JSONB DEFAULT '[]'::jsonb,
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ortho_projects_tenant    ON orthomosaic_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ortho_projects_client    ON orthomosaic_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_ortho_jobs_tenant        ON orthomosaic_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ortho_jobs_project       ON orthomosaic_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_ortho_jobs_status        ON orthomosaic_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ortho_jobs_pilot         ON orthomosaic_jobs(pilot_id);
CREATE INDEX IF NOT EXISTS idx_ortho_uploads_job        ON orthomosaic_upload_sets(job_id);
CREATE INDEX IF NOT EXISTS idx_ortho_outputs_job        ON orthomosaic_outputs(job_id);
CREATE INDEX IF NOT EXISTS idx_ortho_outputs_type       ON orthomosaic_outputs(output_type);
CREATE INDEX IF NOT EXISTS idx_ortho_links_job          ON orthomosaic_asset_links(job_id);
CREATE INDEX IF NOT EXISTS idx_ortho_links_asset        ON orthomosaic_asset_links(asset_type, asset_id);
CREATE INDEX IF NOT EXISTS idx_ortho_qc_job             ON orthomosaic_qc_reports(job_id);

-- updated_at auto-update triggers
CREATE OR REPLACE FUNCTION update_orthomosaic_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ortho_projects_updated ON orthomosaic_projects;
CREATE TRIGGER trg_ortho_projects_updated
    BEFORE UPDATE ON orthomosaic_projects
    FOR EACH ROW EXECUTE FUNCTION update_orthomosaic_updated_at();

DROP TRIGGER IF EXISTS trg_ortho_jobs_updated ON orthomosaic_jobs;
CREATE TRIGGER trg_ortho_jobs_updated
    BEFORE UPDATE ON orthomosaic_jobs
    FOR EACH ROW EXECUTE FUNCTION update_orthomosaic_updated_at();

DROP TRIGGER IF EXISTS trg_ortho_outputs_updated ON orthomosaic_outputs;
CREATE TRIGGER trg_ortho_outputs_updated
    BEFORE UPDATE ON orthomosaic_outputs
    FOR EACH ROW EXECUTE FUNCTION update_orthomosaic_updated_at();
