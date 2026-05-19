-- Migration: add content column to deployment_files
-- Stores file binary content so KML files survive Cloud Run container restarts

ALTER TABLE deployment_files ADD COLUMN IF NOT EXISTS content BYTEA;
