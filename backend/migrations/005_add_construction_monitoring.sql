-- 005_add_construction_monitoring.sql

-- 1. construction_phases
CREATE TABLE IF NOT EXISTS construction_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed basic construction phases
INSERT INTO construction_phases (name, description, order_index) VALUES
('Civil work', 'Site clearing, grading, and earthwork', 1),
('Grading', 'Final site grading for solar arrays', 2),
('Access roads', 'Road construction and stabilization', 3),
('Fencing', 'Perimeter security fencing', 4),
('Pile installation', 'Steel pile driving for racking', 5),
('Racking installation', 'Mounting structures and trackers', 6),
('Module installation', 'Solar panel mounting', 7),
('DC electrical', 'String wiring and combiner boxes', 8),
('AC electrical', 'Inverter wiring and AC collection', 9),
('Inverter pads and equipment', 'Inverter station setup', 10),
('Trenching', 'Underground electrical trenches', 11),
('Cable management', 'Above ground and underground cable pulling', 12),
('Substation work', 'High voltage substation construction', 13),
('Testing and commissioning', 'System testing and energization', 14),
('Punch list items', 'Final defect resolution', 15)
ON CONFLICT DO NOTHING;

-- 2. construction_projects (maps existing deployment/site to a construction profile)
CREATE TABLE IF NOT EXISTS construction_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID, -- References sites(id) if exists
    name VARCHAR(255) NOT NULL,
    epc_contractor VARCHAR(255),
    target_cod DATE,
    baseline_start_date DATE,
    baseline_end_date DATE,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. construction_milestones
CREATE TABLE IF NOT EXISTS construction_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_date DATE NOT NULL,
    actual_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. construction_evidence
CREATE TABLE IF NOT EXISTS construction_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    captured_at TIMESTAMPTZ,
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. construction_observations
CREATE TABLE IF NOT EXISTS construction_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES construction_phases(id),
    evidence_id UUID REFERENCES construction_evidence(id),
    percent_complete INTEGER DEFAULT 0,
    notes TEXT,
    observed_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. construction_issues
CREATE TABLE IF NOT EXISTS construction_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES construction_phases(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'Low', -- Low, Medium, High, Critical
    status VARCHAR(50) DEFAULT 'Open',
    reported_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. construction_daily_reports
CREATE TABLE IF NOT EXISTS construction_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    executive_summary TEXT,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, In Review, Approved, Published
    created_by UUID,
    approved_by UUID,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, report_date)
);

-- 8. construction_audit_logs
CREATE TABLE IF NOT EXISTS construction_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
