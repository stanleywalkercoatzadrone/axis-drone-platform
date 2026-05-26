-- =============================================================================
-- Solar Farm Intelligence Platform – Database Migration
-- File: 20260527_solar_farm_intelligence.sql
-- Safe to re-run (all statements use IF NOT EXISTS guards)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reusable updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. solar_sites
CREATE TABLE IF NOT EXISTS solar_sites (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                  TEXT NOT NULL,
    name                       VARCHAR(255) NOT NULL,
    client_name                VARCHAR(255),
    location                   TEXT,
    lat                        NUMERIC(10,7),
    lng                        NUMERIC(10,7),
    capacity_mw                NUMERIC(10,3),
    total_modules_planned      INT DEFAULT 0,
    total_tracker_rows_planned INT DEFAULT 0,
    total_piles_planned        INT DEFAULT 0,
    status                     VARCHAR(50) DEFAULT 'planning',
    epc_contractor             VARCHAR(255),
    owner_name                 VARCHAR(255),
    cod_target                 DATE,
    notes                      TEXT,
    metadata                   JSONB DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solar_sites_updated_at') THEN
    CREATE TRIGGER trg_solar_sites_updated_at
    BEFORE UPDATE ON solar_sites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 2. solar_surveys
CREATE TABLE IF NOT EXISTS solar_surveys (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           TEXT NOT NULL,
    site_id             UUID REFERENCES solar_sites(id) ON DELETE CASCADE,
    orthomosaic_job_id  UUID,
    deployment_id       UUID,
    survey_date         DATE,
    flight_date         DATE,
    gsd_cm              NUMERIC(8,4),
    area_ha             NUMERIC(12,4),
    image_count         INT,
    reconstructed_count INT,
    reprojection_error  NUMERIC(8,4),
    has_gps             BOOLEAN DEFAULT false,
    data_quality        VARCHAR(20) DEFAULT 'good',
    processing_engine   VARCHAR(100) DEFAULT 'OpenDroneMap',
    spatial_reference   VARCHAR(100) DEFAULT 'WGS84/UTM',
    notes               TEXT,
    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solar_surveys_updated_at') THEN
    CREATE TRIGGER trg_solar_surveys_updated_at
    BEFORE UPDATE ON solar_surveys FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 3. solar_assets
CREATE TABLE IF NOT EXISTS solar_assets (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id            TEXT NOT NULL,
    site_id              UUID REFERENCES solar_sites(id) ON DELETE CASCADE,
    last_survey_id       UUID,
    asset_type           VARCHAR(50) NOT NULL,
    asset_id_label       VARCHAR(100),
    lat                  NUMERIC(10,7),
    lng                  NUMERIC(10,7),
    geometry             JSONB,
    installation_status  VARCHAR(50) DEFAULT 'planned',
    last_inspection_date DATE,
    specs                JSONB DEFAULT '{}'::jsonb,
    notes                TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solar_assets_updated_at') THEN
    CREATE TRIGGER trg_solar_assets_updated_at
    BEFORE UPDATE ON solar_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 4. solar_qaqc_issues
CREATE TABLE IF NOT EXISTS solar_qaqc_issues (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        TEXT NOT NULL,
    site_id          UUID REFERENCES solar_sites(id) ON DELETE CASCADE,
    survey_id        UUID REFERENCES solar_surveys(id),
    asset_id         UUID REFERENCES solar_assets(id),
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    issue_type       VARCHAR(50) DEFAULT 'other',
    severity         VARCHAR(20) DEFAULT 'medium',
    status           VARCHAR(50) DEFAULT 'open',
    lat              NUMERIC(10,7),
    lng              NUMERIC(10,7),
    image_urls       JSONB DEFAULT '[]'::jsonb,
    assignee_name    VARCHAR(255),
    assignee_email   VARCHAR(255),
    detected_by      VARCHAR(50) DEFAULT 'manual',
    resolution_notes TEXT,
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solar_qaqc_issues_updated_at') THEN
    CREATE TRIGGER trg_solar_qaqc_issues_updated_at
    BEFORE UPDATE ON solar_qaqc_issues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 5. solar_thermal_findings
CREATE TABLE IF NOT EXISTS solar_thermal_findings (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         TEXT NOT NULL,
    site_id           UUID REFERENCES solar_sites(id) ON DELETE CASCADE,
    survey_id         UUID REFERENCES solar_surveys(id),
    asset_id          UUID REFERENCES solar_assets(id),
    thermal_fault_id  UUID,
    finding_type      VARCHAR(50) DEFAULT 'hotspot',
    severity          VARCHAR(20) DEFAULT 'medium',
    temperature_delta NUMERIC(8,2),
    lat               NUMERIC(10,7),
    lng               NUMERIC(10,7),
    image_url         TEXT,
    string_id         VARCHAR(100),
    module_id         VARCHAR(100),
    status            VARCHAR(50) DEFAULT 'open',
    detected_by       VARCHAR(50) DEFAULT 'manual',
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solar_thermal_findings_updated_at') THEN
    CREATE TRIGGER trg_solar_thermal_findings_updated_at
    BEFORE UPDATE ON solar_thermal_findings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 6. solar_progress_snapshots
CREATE TABLE IF NOT EXISTS solar_progress_snapshots (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               TEXT NOT NULL,
    site_id                 UUID REFERENCES solar_sites(id) ON DELETE CASCADE,
    survey_id               UUID REFERENCES solar_surveys(id),
    snapshot_date           DATE DEFAULT CURRENT_DATE,
    piles_planned           INT DEFAULT 0,
    piles_installed         INT DEFAULT 0,
    tracker_rows_planned    INT DEFAULT 0,
    tracker_rows_installed  INT DEFAULT 0,
    modules_planned         INT DEFAULT 0,
    modules_installed       INT DEFAULT 0,
    inverter_pads_planned   INT DEFAULT 0,
    inverter_pads_installed INT DEFAULT 0,
    roads_planned_m         NUMERIC DEFAULT 0,
    roads_completed_m       NUMERIC DEFAULT 0,
    blocks_planned          INT DEFAULT 0,
    blocks_completed        INT DEFAULT 0,
    overall_progress_pct    NUMERIC(5,2) DEFAULT 0,
    earthwork_pct           NUMERIC(5,2) DEFAULT 0,
    civil_pct               NUMERIC(5,2) DEFAULT 0,
    electrical_pct          NUMERIC(5,2) DEFAULT 0,
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_solar_progress_survey_id') THEN
    ALTER TABLE solar_progress_snapshots ADD CONSTRAINT uq_solar_progress_survey_id UNIQUE (survey_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solar_progress_snapshots_updated_at') THEN
    CREATE TRIGGER trg_solar_progress_snapshots_updated_at
    BEFORE UPDATE ON solar_progress_snapshots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 7. solar_reports
CREATE TABLE IF NOT EXISTS solar_reports (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    TEXT NOT NULL,
    site_id      UUID REFERENCES solar_sites(id) ON DELETE CASCADE,
    survey_id    UUID,
    title        VARCHAR(255) NOT NULL,
    report_type  VARCHAR(50) DEFAULT 'full',
    generated_by VARCHAR(255),
    content      JSONB DEFAULT '{}'::jsonb,
    pdf_url      TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_solar_sites_tenant   ON solar_sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_solar_surveys_site   ON solar_surveys(site_id);
CREATE INDEX IF NOT EXISTS idx_solar_surveys_tenant ON solar_surveys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_solar_assets_site    ON solar_assets(site_id);
CREATE INDEX IF NOT EXISTS idx_solar_qaqc_site      ON solar_qaqc_issues(site_id);
CREATE INDEX IF NOT EXISTS idx_solar_qaqc_survey    ON solar_qaqc_issues(survey_id);
CREATE INDEX IF NOT EXISTS idx_solar_qaqc_status    ON solar_qaqc_issues(status);
CREATE INDEX IF NOT EXISTS idx_solar_thermal_site   ON solar_thermal_findings(site_id);
CREATE INDEX IF NOT EXISTS idx_solar_thermal_survey ON solar_thermal_findings(survey_id);
CREATE INDEX IF NOT EXISTS idx_solar_progress_site  ON solar_progress_snapshots(site_id);
CREATE INDEX IF NOT EXISTS idx_solar_reports_site   ON solar_reports(site_id);
