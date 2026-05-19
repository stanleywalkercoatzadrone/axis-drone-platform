-- 012_construction_finalization.sql

-- 1. construction_action_items
CREATE TABLE IF NOT EXISTS construction_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'Medium', -- Low, Medium, High, Critical
    status VARCHAR(50) DEFAULT 'Open', -- Open, In Progress, Completed
    due_date DATE,
    owner VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. construction_settings
CREATE TABLE IF NOT EXISTS construction_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE,
    daily_digest_enabled BOOLEAN DEFAULT true,
    critical_risk_alerts_enabled BOOLEAN DEFAULT true,
    ai_verbosity VARCHAR(50) DEFAULT 'Concise (Executive Level)',
    auto_publish_threshold VARCHAR(100) DEFAULT 'Require Manual Approval (Draft Only)',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);
