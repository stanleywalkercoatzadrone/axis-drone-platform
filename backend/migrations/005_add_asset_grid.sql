-- Migration: Add Asset Grid Tables
-- Description: Adds assets, asset_events, and asset_attachments tables for the Asset Grid feature.

-- 1. Assets Table
-- Normalized records representing "things to complete" (e.g., Solar LBD blocks)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    industry VARCHAR(50) NOT NULL, -- 'Solar', 'Utilities', etc.
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Tenant isolation
    site_id UUID NOT NULL, -- Logic link to site (currently no sites table, but good for future)
    asset_type VARCHAR(50) NOT NULL, -- 'lbd_block', 'tower', etc.
    asset_key VARCHAR(100) NOT NULL, -- e.g., 'Block-A1', unique per site/type
    description TEXT,
    
    -- Operational Fields
    status VARCHAR(50) NOT NULL DEFAULT 'not_started',
    planned_count INTEGER,
    completed_count INTEGER DEFAULT 0,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Audit / Meta
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 1, -- Optimistic Locking
    ingestion_job_id UUID, -- Traceability
    
    -- Flex Fields
    meta JSONB DEFAULT '{}'::jsonb, -- Inverter type, row number, etc.

    CONSTRAINT valid_asset_status CHECK (status IN ('not_started', 'in_progress', 'complete', 'blocked', 'needs_review')),
    CONSTRAINT unique_asset_key_per_site UNIQUE (site_id, asset_type, asset_key)
);

-- Indexes for Assets
CREATE INDEX idx_assets_site_type ON assets(site_id, asset_type);
CREATE INDEX idx_assets_assigned_status ON assets(assigned_to_user_id, status);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_last_updated ON assets(last_updated_at);

-- 2. Asset Events Table (Audit Trail)
-- Immutable event log of changes
CREATE TABLE IF NOT EXISTS asset_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'status_change', 'field_update', 'comment', 'attachment', 'assignment'
    before_state JSONB, -- Snapshot before change
    after_state JSONB, -- Snapshot after change
    message TEXT, -- Human readable comment or sys msg
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Asset Events
CREATE INDEX idx_asset_events_asset_time ON asset_events(asset_id, created_at DESC);

-- 3. Asset Attachments Table
CREATE TABLE IF NOT EXISTS asset_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    storage_url TEXT NOT NULL,
    size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at on assets
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
