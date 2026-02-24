-- Enterprise Hardening: Update Constraints for Roles, Lifecycle, and Audit

-- 1. Update Users Role Constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users ADD CONSTRAINT valid_role 
    CHECK (role IN ('ADMIN', 'USER', 'AUDITOR', 'OPERATIONS', 'ANALYST', 'FIELD_OPERATOR', 'SENIOR_INSPECTOR', 'CLIENT_USER', 'PILOT_TECHNICIAN', 'client_user', 'pilot_technician'));

-- 2. Update Reports Status Constraint
ALTER TABLE reports DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE reports ADD CONSTRAINT valid_status 
    CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'REVIEW', 'FINALIZED', 'ARCHIVED'));

-- 3. Ensure Audit Logs have necessary indexes (already checked, but ensuring)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
