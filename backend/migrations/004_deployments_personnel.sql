-- Migration: Add deployments and personnel tables
-- Description: Creates tables for managing personnel (pilots/technicians) and deployments (missions) with daily pay tracking

-- Personnel table
CREATE TABLE IF NOT EXISTS personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    certification_level VARCHAR(100),
    daily_pay_rate DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_personnel_role CHECK (role IN ('Pilot', 'Technician')),
    CONSTRAINT valid_personnel_status CHECK (status IN ('Active', 'On Leave', 'Inactive'))
);

-- Deployments table
CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    site_name VARCHAR(255) NOT NULL,
    site_id UUID,
    date DATE NOT NULL,
    location VARCHAR(500),
    notes TEXT,
    days_on_site INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_deployment_type CHECK (type IN ('Routine Inspection', 'Emergency Response', 'Construction Progress', 'Site Survey', 'Maintenance Verification')),
    CONSTRAINT valid_deployment_status CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Delayed')),
    CONSTRAINT valid_days_on_site CHECK (days_on_site > 0)
);

-- Daily logs table (for tracking daily pay per technician/pilot)
CREATE TABLE IF NOT EXISTS daily_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    technician_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    daily_pay DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_daily_pay CHECK (daily_pay >= 0),
    CONSTRAINT unique_deployment_date_technician UNIQUE (deployment_id, date, technician_id)
);

-- Junction table for deployment-personnel assignments (optional, for tracking assigned personnel)
CREATE TABLE IF NOT EXISTS deployment_personnel (
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (deployment_id, personnel_id)
);

-- Create indexes for performance
CREATE INDEX idx_personnel_email ON personnel(email);
CREATE INDEX idx_personnel_role ON personnel(role);
CREATE INDEX idx_personnel_status ON personnel(status);

CREATE INDEX idx_deployments_date ON deployments(date);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_site_id ON deployments(site_id);
CREATE INDEX idx_deployments_created_at ON deployments(created_at DESC);

CREATE INDEX idx_daily_logs_deployment_id ON daily_logs(deployment_id);
CREATE INDEX idx_daily_logs_technician_id ON daily_logs(technician_id);
CREATE INDEX idx_daily_logs_date ON daily_logs(date);

CREATE INDEX idx_deployment_personnel_deployment ON deployment_personnel(deployment_id);
CREATE INDEX idx_deployment_personnel_personnel ON deployment_personnel(personnel_id);

-- Add triggers for updated_at
CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON personnel
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON deployments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO personnel (full_name, role, email, phone, certification_level, daily_pay_rate, status)
VALUES 
    ('Alex Riviera', 'Pilot', 'alex.r@axis.com', '+1 (555) 123-4567', 'Part 107 Advanced', 450.00, 'Active'),
    ('Sarah Chen', 'Technician', 'sarah.c@axis.com', '+1 (555) 987-6543', 'Level 3 Thermographer', 350.00, 'Active'),
    ('Marcus Johnson', 'Pilot', 'marcus.j@axis.com', '+1 (555) 456-7890', 'Part 107', 400.00, 'On Leave'),
    ('Emily Davis', 'Technician', 'emily.d@axis.com', '+1 (555) 789-0123', 'Level 1 Visual', 300.00, 'Inactive')
ON CONFLICT (email) DO NOTHING;

-- Insert sample deployments for testing
INSERT INTO deployments (title, type, status, site_name, date, location, notes, days_on_site)
VALUES 
    ('Q1 Solar Field Audit', 'Routine Inspection', 'Scheduled', 'Nevada Solar One', '2026-01-20', 'Boulder City, NV', 'Focus on inverter pad 4.', 3),
    ('Emergency Storm Assessment', 'Emergency Response', 'In Progress', 'Grid Station Alpha', '2026-01-17', 'Houston, TX', 'Post-storm damage check.', 5),
    ('Construction Milestone 3', 'Construction Progress', 'Completed', 'Project Helios', '2026-01-10', 'Phoenix, AZ', 'Final phase inspection.', 2),
    ('Monthly Thermal Scan', 'Routine Inspection', 'Scheduled', 'Desert Sun Array', '2026-01-25', 'Tucson, AZ', 'Regular thermal imaging sweep.', 4),
    ('Site Survey - New Location', 'Site Survey', 'Scheduled', 'Mountain View Solar', '2026-02-01', 'Denver, CO', 'Initial site assessment for new installation.', 2)
ON CONFLICT DO NOTHING;

-- Insert sample daily logs for testing (linked to seeded deployments and personnel)
DO $$
DECLARE
    dep_id_1 UUID;
    dep_id_2 UUID;
    dep_id_3 UUID;
    per_id_alex UUID;
    per_id_sarah UUID;
BEGIN
    -- Get deployment IDs
    SELECT id INTO dep_id_1 FROM deployments WHERE title = 'Emergency Storm Assessment' LIMIT 1;
    SELECT id INTO dep_id_2 FROM deployments WHERE title = 'Construction Milestone 3' LIMIT 1;
    SELECT id INTO dep_id_3 FROM deployments WHERE title = 'Q1 Solar Field Audit' LIMIT 1;

    -- Get personnel IDs
    SELECT id INTO per_id_alex FROM personnel WHERE full_name = 'Alex Riviera' LIMIT 1;
    SELECT id INTO per_id_sarah FROM personnel WHERE full_name = 'Sarah Chen' LIMIT 1;

    -- Add logs if we found IDs
    IF dep_id_1 IS NOT NULL AND per_id_alex IS NOT NULL THEN
        INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
        VALUES (dep_id_1, '2026-01-17', per_id_alex, 450.00, 'Initial assessment complete');
    END IF;

    IF dep_id_1 IS NOT NULL AND per_id_sarah IS NOT NULL THEN
        INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
        VALUES (dep_id_1, '2026-01-17', per_id_sarah, 350.00, 'Grid sensor calibration');
    END IF;

    IF dep_id_2 IS NOT NULL AND per_id_alex IS NOT NULL THEN
        INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
        VALUES (dep_id_2, '2026-01-10', per_id_alex, 450.00, 'Site survey day 1');
        INSERT INTO daily_logs (deployment_id, date, technician_id, daily_pay, notes)
        VALUES (dep_id_2, '2026-01-11', per_id_alex, 450.00, 'Final walkthrough');
    END IF;
END $$;
