-- P0 Security Fix: Enable Row-Level Security (RLS) for multi-tenancy

-- 1. Enable RLS on core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_expenses ENABLE ROW LEVEL SECURITY;

-- 2. Create basic tenant isolation policies
-- Note: Assumes JWT contains 'app_metadata' or 'user_metadata' with tenant_id, 
-- or you are using auth.uid() to look up the user's tenant.
-- Replace auth.uid() logic with your specific Supabase JWT setup.

-- Example for Deployments (Missions)
CREATE POLICY "Tenant Isolation - Deployments"
ON deployments
FOR ALL
USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);

-- Example for Upload Jobs
CREATE POLICY "Tenant Isolation - Upload Jobs"
ON upload_jobs
FOR ALL
USING (
  mission_id IN (
    SELECT id FROM deployments 
    WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  )
);

-- Note: Admin roles should have bypass RLS or separate policies.
-- Add more policies as needed for clients, ai_reports, and vendor_expenses.
