-- Migration 025: Add pilot field report columns to daily_logs
-- These columns are populated when a pilot submits their end-of-day report
-- via POST /api/pilot/secure/missions/:missionId/daily-report

ALTER TABLE daily_logs
    ADD COLUMN IF NOT EXISTS pilot_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS missions_flown INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS blocks_completed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS hours_worked DECIMAL(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS issues_encountered TEXT,
    ADD COLUMN IF NOT EXISTS weather_conditions_reported TEXT,
    ADD COLUMN IF NOT EXISTS ai_report TEXT,
    ADD COLUMN IF NOT EXISTS weather_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS irradiance_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS is_incident BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS incident_severity VARCHAR(20) DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS incident_summary TEXT;

-- Index for quickly finding incident reports
CREATE INDEX IF NOT EXISTS idx_daily_logs_is_incident ON daily_logs(is_incident) WHERE is_incident = TRUE;
-- Index for date-based queries (field reports sorted by date)
CREATE INDEX IF NOT EXISTS idx_daily_logs_deployment_date ON daily_logs(deployment_id, date DESC);
