-- Migration 20260203: Industry, Client, and Stakeholder Schema

-- 1. Industries Table
CREATE TABLE IF NOT EXISTS industries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(50) UNIQUE NOT NULL, -- 'solar', 'insurance', etc.
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Industries
INSERT INTO industries (key, name) VALUES 
('solar', 'Solar'),
('insurance', 'Insurance'),
('construction', 'Construction'),
('utilities', 'Utilities'),
('telecom', 'Telecom')
ON CONFLICT (key) DO NOTHING;

-- 2. Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  industry_id UUID REFERENCES industries(id),
  name VARCHAR(255) NOT NULL,
  external_id VARCHAR(100),
  address JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stakeholder Profiles
CREATE TABLE IF NOT EXISTS stakeholder_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- Optional link to platform user
  type VARCHAR(50) NOT NULL, -- 'client', 'vendor', 'internal'
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  title VARCHAR(100),
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Update Sites (Projects) Table
-- Add client_id column
ALTER TABLE sites ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- 5. Scope Bindings for RBAC (for stakeholder access)
-- Re-using/Extending existing permissions or adding a generic binding table if needed.
-- We'll assume the 'users.bindings' column or a separate table handles this.
-- For now, we'll create a dedicated table for clarity if complex many-to-many needed, 
-- but user request mentioned "user_role_bindings" in the prompt description (Data section C).
-- Let's check if we strictly need a new table or if we can use existing mechanisms.
-- The user prompt said: "user_role_bindings(user_id, role, scope_type, scope_id)"
-- Let's create it to be safe and explicit.

CREATE TABLE IF NOT EXISTS user_scope_bindings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'client_org_admin', 'client_project_viewer'
  scope_type VARCHAR(50) NOT NULL, -- 'client', 'project' (site), 'industry'
  scope_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role, scope_type, scope_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_scope_bindings_user ON user_scope_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scope_bindings_scope ON user_scope_bindings(scope_type, scope_id);
