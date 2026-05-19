-- Incident classification fields for pilot daily_logs
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS is_incident BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS incident_severity TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS incident_summary TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS pilot_name TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS missions_flown INT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS blocks_completed INT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS hours_worked NUMERIC(5,2);
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS issues_encountered TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS weather_conditions_reported TEXT;
