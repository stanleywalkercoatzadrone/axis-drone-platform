-- Add invitation token columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP;

-- Create index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_users_invitation_token ON users(invitation_token);
