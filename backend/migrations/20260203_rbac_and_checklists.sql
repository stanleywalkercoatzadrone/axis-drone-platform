-- Migration: RBAC and Spreadsheet Work Checklists
-- Description: Adds tables for granular permissions, scoped roles, and work item tracking.

-- 1. RBAC Tables
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_role_bindings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope_type VARCHAR(50) NOT NULL CHECK (scope_type IN ('global', 'customer', 'project', 'mission')),
    scope_id TEXT, -- Can be UUID or string depending on scope
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Checklist Tables
CREATE TABLE IF NOT EXISTS mapping_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    scope_type VARCHAR(50) NOT NULL,
    scope_id TEXT,
    mapping_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope_type VARCHAR(50) NOT NULL,
    scope_id TEXT,
    filename VARCHAR(255) NOT NULL,
    storage_url TEXT NOT NULL,
    mapping_template_id UUID REFERENCES mapping_templates(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workbook_id UUID REFERENCES workbooks(id) ON DELETE CASCADE,
    scope_type VARCHAR(50) NOT NULL,
    scope_id TEXT,
    row_number INTEGER,
    external_row_id TEXT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'done')),
    due_date DATE,
    priority VARCHAR(50) DEFAULT 'medium',
    location_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_item_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    payload_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Extend Assets Table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Initial Seed for Permissions
INSERT INTO permissions (key, description) VALUES
('customers:read_all', 'View all customers'),
('customers:read_scoped', 'View assigned customers'),
('customers:manage', 'Full management of customers'),
('projects:read', 'View projects'),
('projects:create', 'Create new projects'),
('projects:update', 'Update projects'),
('projects:delete', 'Delete projects'),
('projects:manage_users', 'Manage users in projects'),
('missions:read', 'View missions'),
('missions:update_core', 'Update mission core fields'),
('missions:update_status', 'Update mission status'),
('missions:manage', 'Full management of missions'),
('reports:read', 'View reports'),
('reports:create', 'Create reports'),
('reports:update', 'Update reports'),
('reports:delete', 'Delete reports'),
('workflows:read', 'Read workflows'),
('workflows:create', 'Create workflows'),
('workflows:update', 'Update workflows'),
('workflows:delete', 'Delete workflows'),
('users:read', 'View users'),
('users:invite', 'Invite new users'),
('users:update_role', 'Update user roles'),
('users:disable', 'Disable users'),
('assets:read', 'View assets'),
('assets:create', 'Upload assets'),
('assets:update_own', 'Update own assets'),
('assets:delete_own', 'Delete own assets'),
('work_items:read', 'Read work items'),
('work_items:update_status', 'Update work item status'),
('work_items:add_notes', 'Add notes to work items'),
('work_items:manage', 'Full management of work items')
ON CONFLICT (key) DO NOTHING;

-- 5. Initial Seed for Roles
INSERT INTO roles (name, description) VALUES
('internal_admin', 'Full platform administrator'),
('internal_scoped', 'Scoped internal user'),
('internal_viewer', 'Read-only internal user'),
('customer_org_admin', 'Customer organization administrator'),
('customer_project_admin', 'Project-level administrator'),
('customer_project_user', 'Project-level contributor'),
('customer_project_viewer', 'Project-level read-only user'),
('external_contributor', 'External pilot or vendor'),
('external_viewer', 'External read-only user')
ON CONFLICT (name) DO NOTHING;

-- 6. Map Roles to Permissions (Standard Mapping)
-- Internal Admin (Full Access)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'internal_admin'
ON CONFLICT DO NOTHING;

-- External Contributor (Pilot/Technician)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'external_contributor' AND p.key IN (
    'missions:read', 'reports:read', 'assets:read', 'assets:create', 
    'assets:update_own', 'assets:delete_own', 'work_items:read', 
    'work_items:update_status', 'work_items:add_notes'
)
ON CONFLICT DO NOTHING;

-- Customer Project Viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'customer_project_viewer' AND p.key IN (
    'projects:read', 'missions:read', 'reports:read', 'assets:read', 
    'work_items:read', 'workflows:read', 'workflows:create', 'workflows:update'
)
ON CONFLICT DO NOTHING;
