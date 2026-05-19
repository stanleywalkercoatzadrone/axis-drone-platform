-- Migration: Pilot Network Applications
-- Creates the table for storing pilot enrollment applications
-- and adds extended profile columns to the personnel table.

CREATE TABLE IF NOT EXISTS pilot_network_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           TEXT NOT NULL,
    email               TEXT NOT NULL,
    phone               TEXT,
    country             TEXT,
    city                TEXT,
    years_exp           INTEGER DEFAULT 0,
    certifications      TEXT[],
    specializations     TEXT[],
    drone_equipment     TEXT[],
    bio                 TEXT,
    portfolio_url       TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','waitlisted')),
    admin_notes         TEXT,
    reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    terrestrial_thermal BOOLEAN DEFAULT FALSE,
    travel_distance_km  INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column additions for tables that may already exist
ALTER TABLE pilot_network_applications ADD COLUMN IF NOT EXISTS terrestrial_thermal BOOLEAN DEFAULT FALSE;
ALTER TABLE pilot_network_applications ADD COLUMN IF NOT EXISTS travel_distance_km INTEGER DEFAULT 0;

-- Change drone_equipment to array if it was TEXT before (safe no-op if already array)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pilot_network_applications'
          AND column_name = 'drone_equipment'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE pilot_network_applications
            ALTER COLUMN drone_equipment TYPE TEXT[] USING
                CASE WHEN drone_equipment IS NULL THEN NULL
                     ELSE ARRAY[drone_equipment]
                END;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Extended pilot profile columns on personnel
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS years_exp INTEGER DEFAULT 0;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS specializations TEXT[];
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS drone_equipment TEXT[];
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS travel_distance_km INTEGER DEFAULT 0;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS terrestrial_thermal BOOLEAN DEFAULT FALSE;
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS source TEXT;
