-- Migration: Pilot Work Assignments
-- Allows admin to assign specific KML files and LBD blocks to pilots per deployment

CREATE TABLE IF NOT EXISTS pilot_work_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id   UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    personnel_id    UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,

    -- What is being assigned — one of the two will be set
    file_id     UUID REFERENCES deployment_files(id) ON DELETE CASCADE,  -- KML/spreadsheet files
    asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE,             -- LBD blocks/site assets

    -- Type label for display
    assignment_type VARCHAR(50) NOT NULL DEFAULT 'kml', -- 'kml' | 'lbd' | 'params'

    -- Optional notes from admin
    notes       TEXT,

    assigned_by UUID,   -- admin user id
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed   BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,

    UNIQUE(deployment_id, personnel_id, file_id),
    UNIQUE(deployment_id, personnel_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_pwa_deployment ON pilot_work_assignments(deployment_id);
CREATE INDEX IF NOT EXISTS idx_pwa_personnel  ON pilot_work_assignments(personnel_id);
