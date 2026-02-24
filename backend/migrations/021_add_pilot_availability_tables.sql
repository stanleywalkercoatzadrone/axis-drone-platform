-- Migration: Pilot Availability & Scheduling
-- Description: Tables for tracking pilot availability, blackout dates, and calendar sync status

-- 1. Pilot Availability Table
CREATE TABLE IF NOT EXISTS pilot_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    tenant_id UUID,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('AVAILABLE', 'BLACKOUT', 'WORKING_HOURS')),
    recurrence JSONB DEFAULT NULL, -- For weekly patterns or rules
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Availability Sync Table
CREATE TABLE IF NOT EXISTS availability_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    tenant_id UUID,
    provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', 'ical'
    external_calendar_id VARCHAR(255),
    sync_token TEXT,
    last_synced_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pilot_id, provider)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pilot_availability_pilot ON pilot_availability(pilot_id);
CREATE INDEX IF NOT EXISTS idx_pilot_availability_times ON pilot_availability(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_availability_sync_pilot ON availability_sync(pilot_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pilot_availability_modtime') THEN
        CREATE TRIGGER update_pilot_availability_modtime
        BEFORE UPDATE ON pilot_availability
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_availability_sync_modtime') THEN
        CREATE TRIGGER update_availability_sync_modtime
        BEFORE UPDATE ON availability_sync
        FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;
