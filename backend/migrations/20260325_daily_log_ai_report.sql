-- AI-generated report columns for daily_logs
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS ai_report TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS weather_snapshot JSONB;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS irradiance_snapshot JSONB;
