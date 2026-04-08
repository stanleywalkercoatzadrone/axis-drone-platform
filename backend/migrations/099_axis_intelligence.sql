-- AXIS INTELLIGENCE MODULE — New Tables Only
-- DO NOT modify any existing tables.
-- Safe to run multiple times (IF NOT EXISTS guards).

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: axis_mission_intel
-- Stores primary AI intelligence results per mission.
-- One active record per mission (upserted on re-generation).
-- ============================================================
CREATE TABLE IF NOT EXISTS axis_mission_intel (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id       UUID NOT NULL UNIQUE,  -- FK reference only, no constraint to avoid modifying deployments table
    risk_score       INTEGER,
    priority_level   VARCHAR(20),
    recommended_pilot_count INTEGER,
    weather_concern  VARCHAR(500),
    estimated_completion_days INTEGER,
    financial_exposure DECIMAL(12,2),
    safety_flags     JSONB DEFAULT '[]'::jsonb,
    block_priority_strategy JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axis_mission_intel_mission_id 
    ON axis_mission_intel(mission_id);

CREATE INDEX IF NOT EXISTS idx_axis_mission_intel_risk_score 
    ON axis_mission_intel(risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_axis_mission_intel_priority 
    ON axis_mission_intel(priority_level);

-- ============================================================
-- TABLE: axis_mission_intel_simulations
-- Stores scenario simulation records (separate from primary intel).
-- Never overwrites axis_mission_intel records.
-- ============================================================
CREATE TABLE IF NOT EXISTS axis_mission_intel_simulations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id  UUID NOT NULL,  -- FK reference only
    overrides   JSONB DEFAULT '{}'::jsonb,
    results     JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axis_intel_sims_mission_id 
    ON axis_mission_intel_simulations(mission_id);

CREATE INDEX IF NOT EXISTS idx_axis_intel_sims_created_at 
    ON axis_mission_intel_simulations(created_at DESC);

-- Updated_at trigger for axis_mission_intel
CREATE OR REPLACE FUNCTION update_axis_intel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_axis_mission_intel_updated_at ON axis_mission_intel;
CREATE TRIGGER trg_axis_mission_intel_updated_at
    BEFORE UPDATE ON axis_mission_intel
    FOR EACH ROW EXECUTE FUNCTION update_axis_intel_updated_at();
