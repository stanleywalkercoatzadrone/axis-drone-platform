-- ============================================================
-- Media & Deliverables Integration Migration
-- Safe additive migration: all ADD COLUMN IF NOT EXISTS
-- ============================================================

-- 1. Link orthomosaic jobs to solar entities
ALTER TABLE orthomosaic_jobs ADD COLUMN IF NOT EXISTS solar_site_id   UUID REFERENCES solar_sites(id)   ON DELETE SET NULL;
ALTER TABLE orthomosaic_jobs ADD COLUMN IF NOT EXISTS solar_survey_id UUID REFERENCES solar_surveys(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ortho_jobs_solar_site   ON orthomosaic_jobs(solar_site_id);
CREATE INDEX IF NOT EXISTS idx_ortho_jobs_solar_survey ON orthomosaic_jobs(solar_survey_id);

-- 2. Link media files to solar entities (deployment_files is the main media table)
ALTER TABLE deployment_files ADD COLUMN IF NOT EXISTS solar_site_id   UUID REFERENCES solar_sites(id)   ON DELETE SET NULL;
ALTER TABLE deployment_files ADD COLUMN IF NOT EXISTS solar_survey_id UUID REFERENCES solar_surveys(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deployment_files_solar_site ON deployment_files(solar_site_id);

-- 3. Add source tagging and solar linkage to reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS source          VARCHAR(50) DEFAULT 'manual';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS solar_site_id   UUID REFERENCES solar_sites(id)   ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS solar_survey_id UUID REFERENCES solar_surveys(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reports_source     ON reports(source);
CREATE INDEX IF NOT EXISTS idx_reports_solar_site ON reports(solar_site_id);
