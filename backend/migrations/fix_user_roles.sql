-- Migration to update valid_role constraint on users table
-- This ensures all modern roles are supported, preventing check constraint failures during user creation.

ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users ADD CONSTRAINT valid_role 
    CHECK (role IN ('ADMIN', 'USER', 'AUDITOR', 'OPERATIONS', 'ANALYST', 'FIELD_OPERATOR', 'SENIOR_INSPECTOR', 'CLIENT_USER', 'PILOT_TECHNICIAN', 'client_user', 'pilot_technician'));
