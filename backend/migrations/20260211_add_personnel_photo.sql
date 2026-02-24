-- Add profile_picture_url to personnel table
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
