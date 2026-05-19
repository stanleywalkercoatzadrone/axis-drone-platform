-- Migration: Add daily task fields to pilot_work_assignments
-- Run once: adds work_date, task_description, priority, sectors columns

ALTER TABLE pilot_work_assignments
    ADD COLUMN IF NOT EXISTS work_date     DATE,
    ADD COLUMN IF NOT EXISTS task_description TEXT,
    ADD COLUMN IF NOT EXISTS priority      TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
    ADD COLUMN IF NOT EXISTS sectors       TEXT;

-- Remove old NOT NULL constraint on file_id / asset_id if it exists
-- (they are optional for text-only daily tasks)
ALTER TABLE pilot_work_assignments
    ALTER COLUMN file_id  DROP NOT NULL,
    ALTER COLUMN asset_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pwa_work_date ON pilot_work_assignments(work_date);
CREATE INDEX IF NOT EXISTS idx_pwa_personnel ON pilot_work_assignments(personnel_id, work_date);
