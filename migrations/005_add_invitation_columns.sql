-- Migration: Add invitation columns to users table
SET statement_timeout = 60000; -- 60 seconds
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_users_invitation_token ON users(invitation_token);
