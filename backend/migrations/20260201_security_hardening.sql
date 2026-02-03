-- Security Hardening Migration

-- 1. Add auth_version to users for global session revocation
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER DEFAULT 1;

-- 2. Create refresh_tokens table for rotation and reuse detection
CREATE TABLE IF NOT EXISTS refresh_tokens (
    jti TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'used', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for performance on family revocation
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- 3. Add tenant_id to users if not present (assuming multi-tenant future)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';

-- 4. Fix Missing Columns in Reports (for test environment)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
