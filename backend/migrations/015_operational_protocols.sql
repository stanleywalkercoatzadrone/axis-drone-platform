-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Operational Protocols System
-- FAA Part 107-aligned drone inspection protocols
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. protocols — library of SOP documents ───────────────────────────────────
CREATE TABLE IF NOT EXISTS protocols (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT,
    title           TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL CHECK (category IN ('pre_flight', 'mission', 'post_flight', 'emergency', 'general')),
    mission_type    TEXT DEFAULT 'all',  -- 'solar', 'insurance', 'utilities', 'telecom', 'construction', 'all'
    steps           JSONB NOT NULL DEFAULT '[]',
    -- Each step: { id, order, title, description, type: 'check'|'sign'|'input'|'photo', required }
    version         TEXT DEFAULT '1.0',
    is_active       BOOLEAN DEFAULT TRUE,
    is_required     BOOLEAN DEFAULT FALSE, -- if true, pilot MUST complete before mission actions unlock
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. mission_protocols — attach protocols to specific missions ───────────────
CREATE TABLE IF NOT EXISTS mission_protocols (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id      UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    protocol_id     UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mission_id, protocol_id)
);

-- ── 3. protocol_acknowledgments — pilot sign-offs ─────────────────────────────
CREATE TABLE IF NOT EXISTS protocol_acknowledgments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id     UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    mission_id      UUID REFERENCES deployments(id) ON DELETE CASCADE,
    pilot_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pilot_name      TEXT,
    step_responses  JSONB DEFAULT '{}',  -- { stepId: { completed: bool, value: text, timestamp } }
    acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
    signature       TEXT,  -- base64 or pilot name typed as signature
    UNIQUE(protocol_id, mission_id, pilot_id)
);

CREATE INDEX IF NOT EXISTS idx_protocols_tenant       ON protocols(tenant_id);
CREATE INDEX IF NOT EXISTS idx_protocols_category     ON protocols(category);
CREATE INDEX IF NOT EXISTS idx_protocols_mission_type ON protocols(mission_type);
CREATE INDEX IF NOT EXISTS idx_mission_protocols_m    ON mission_protocols(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_protocols_p    ON mission_protocols(protocol_id);
CREATE INDEX IF NOT EXISTS idx_proto_acks_pilot       ON protocol_acknowledgments(pilot_id);
CREATE INDEX IF NOT EXISTS idx_proto_acks_mission     ON protocol_acknowledgments(mission_id);
