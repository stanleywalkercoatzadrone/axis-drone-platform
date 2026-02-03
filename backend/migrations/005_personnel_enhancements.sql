-- Migration: Enhance personnel table
-- Description: Adds 'Both' role and 'max_travel_distance' column

-- Drop the existing role check constraint
ALTER TABLE personnel DROP CONSTRAINT IF EXISTS valid_personnel_role;

-- Add updated role check constraint including 'Both'
ALTER TABLE personnel 
ADD CONSTRAINT valid_personnel_role 
CHECK (role IN ('Pilot', 'Technician', 'Both'));

-- Add max_travel_distance column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personnel' AND column_name = 'max_travel_distance') THEN
        ALTER TABLE personnel ADD COLUMN max_travel_distance INTEGER DEFAULT 0;
    END IF;
END $$;
