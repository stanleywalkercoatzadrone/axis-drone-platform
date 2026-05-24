-- ── Social Media v2 — Marketing Pivot ────────────────────────────────────────
-- Adds post_type, post_title, scheduled_at columns to support manual marketing
-- posts (job openings, company news) instead of deployment-event triggers.

-- Extend posts table with marketing fields
ALTER TABLE social_media_posts
    ADD COLUMN IF NOT EXISTS post_type    VARCHAR(50) DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS post_title   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

-- Widen templates to support new trigger types
-- Remove old constraint (if any) and let the app layer validate
ALTER TABLE social_media_templates
    DROP CONSTRAINT IF EXISTS social_media_templates_trigger_check;

-- Update existing pilot-assignment templates to 'job_opening' so they stay valid
UPDATE social_media_templates
SET trigger = 'job_opening'
WHERE trigger IN ('pilot_assigned', 'mission_active', 'mission_complete');

-- Index for post_type queries
CREATE INDEX IF NOT EXISTS idx_social_posts_type ON social_media_posts(post_type);
