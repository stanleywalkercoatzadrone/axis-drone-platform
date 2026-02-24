-- Migration: Add profile picture URL to personnel
-- Description: Adds 'photo_url' column to personnel table to store references

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personnel' AND column_name = 'photo_url') THEN
        ALTER TABLE personnel ADD COLUMN photo_url TEXT;
    END IF;
END $$;
