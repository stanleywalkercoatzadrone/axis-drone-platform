-- ============================================================
-- AXIS ENTERPRISE UPGRADE — PHASE 1–7 MIGRATION
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS guards)
-- ADDITIVE ONLY — does not drop or rename any existing tables/columns
-- ============================================================

-- ── PHASE 1: Extend deployments table ───────────────────────
ALTER TABLE deployments
    ADD COLUMN IF NOT EXISTS mission_status_v2      TEXT DEFAULT 'assigned',
    ADD COLUMN IF NOT EXISTS completion_percent      INT  DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billing_status          TEXT DEFAULT 'not_billable',
    ADD COLUMN IF NOT EXISTS allow_partial_invoice   BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS total_sessions          INT  DEFAULT 0,
    ADD COLUMN IF NOT EXISTS industry_type           TEXT DEFAULT 'general';

-- ── PHASE 2: Multi-day mission work sessions ─────────────────
CREATE TABLE IF NOT EXISTS mission_work_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id        UUID REFERENCES deployments(id) ON DELETE CASCADE,
    pilot_id          UUID,
    session_number    INT,
    session_date      DATE,
    start_time        TIMESTAMP,
    end_time          TIMESTAMP,
    completion_percent INT DEFAULT 0,
    status            TEXT,
    reason_closed     TEXT,
    weather_stop      BOOLEAN DEFAULT false,
    billable          BOOLEAN DEFAULT true,
    invoice_id        UUID,
    payment_status    TEXT DEFAULT 'pending',
    notes             TEXT,
    created_at        TIMESTAMP DEFAULT now(),
    updated_at        TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_mission
    ON mission_work_sessions(mission_id);

CREATE INDEX IF NOT EXISTS idx_sessions_pilot
    ON mission_work_sessions(pilot_id);

-- ── PHASE 4: Mission timeline ─────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_timeline (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id  UUID,
    event_type  TEXT,
    description TEXT,
    session_id  UUID,
    created_by  UUID,
    created_at  TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_mission
    ON mission_timeline(mission_id);

-- ── PHASE 5: Solar blocks ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS solar_blocks (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id         UUID,
    block_name         TEXT,
    expected_images    INT,
    captured_images    INT DEFAULT 0,
    completion_percent INT DEFAULT 0,
    status             TEXT DEFAULT 'not_started',
    created_at         TIMESTAMP DEFAULT now(),
    updated_at         TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solar_blocks_mission
    ON solar_blocks(mission_id);

-- ── PHASE 6: Thermal faults ───────────────────────────────────
CREATE TABLE IF NOT EXISTS thermal_faults (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id        UUID,
    image_id          UUID,
    fault_type        TEXT,
    temperature_delta FLOAT,
    severity          TEXT,       -- 'minor' | 'moderate' | 'critical'
    coordinates       JSONB,
    reviewed          BOOLEAN DEFAULT false,
    reviewed_by       UUID,
    reviewed_at       TIMESTAMP,
    created_at        TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thermal_faults_mission
    ON thermal_faults(mission_id);

CREATE INDEX IF NOT EXISTS idx_thermal_faults_severity
    ON thermal_faults(severity);

-- ── PHASE 7: Pilot metrics ────────────────────────────────────
CREATE TABLE IF NOT EXISTS pilot_metrics (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pilot_id               UUID UNIQUE,
    missions_completed     INT DEFAULT 0,
    sessions_completed     INT DEFAULT 0,
    weather_interruptions  INT DEFAULT 0,
    avg_completion_speed   FLOAT,
    faults_detected        INT DEFAULT 0,
    rating                 FLOAT DEFAULT 5,
    last_computed_at       TIMESTAMP DEFAULT now(),
    created_at             TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_metrics_pilot
    ON pilot_metrics(pilot_id);
