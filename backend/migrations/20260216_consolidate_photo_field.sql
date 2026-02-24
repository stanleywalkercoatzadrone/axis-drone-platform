-- Consolidation migration for personnel photo fields
-- Standardizes on 'photo_url' and migrates data from 'profile_picture_url' if it exists.

DO $$
BEGIN
    -- Ensure photo_url exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personnel' AND column_name = 'photo_url') THEN
        ALTER TABLE personnel ADD COLUMN photo_url TEXT;
    END IF;

    -- Migrate data if profile_picture_url exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'personnel' AND column_name = 'profile_picture_url') THEN
        UPDATE personnel SET photo_url = profile_picture_url WHERE photo_url IS NULL AND profile_picture_url IS NOT NULL;
    END IF;
END $$;
