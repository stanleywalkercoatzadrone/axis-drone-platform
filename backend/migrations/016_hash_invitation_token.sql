-- Migration: Rename invitation_token to invitation_token_hash for security
SET statement_timeout = 60000; -- 60 seconds

-- Rename the column
ALTER TABLE users RENAME COLUMN invitation_token TO invitation_token_hash;

-- Rename the index if it exists
ALTER INDEX IF EXISTS idx_users_invitation_token RENAME TO idx_users_invitation_token_hash;
