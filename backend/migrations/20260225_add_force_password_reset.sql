-- Add force_password_reset column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN DEFAULT FALSE;
