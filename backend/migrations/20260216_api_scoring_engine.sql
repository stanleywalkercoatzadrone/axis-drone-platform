-- Axis Performance Index (API) Scoring Engine Migration
-- Version 1.0.0

-- Ensure uuid-ossp extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Enhance Personnel with Scoring Fields
-- We use the existing personnel table but add performance-specific columns
ALTER TABLE personnel
ADD COLUMN IF NOT EXISTS lifetime_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rolling_30_day_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reliability_flag BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS tier_level VARCHAR(20) DEFAULT 'Bronze'; -- Gold/Silver/Bronze/At Risk

-- 2. Create Job Offers Table
CREATE TABLE IF NOT EXISTS job_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    job_id UUID NOT NULL, -- Link to deployments/missions
    offered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    declined_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Job Completions Table
CREATE TABLE IF NOT EXISTS job_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL,
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    on_time BOOLEAN DEFAULT TRUE,
    cancelled BOOLEAN DEFAULT FALSE,
    no_show BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create QA Reviews Table
CREATE TABLE IF NOT EXISTS qa_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL,
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    qa_score INTEGER CHECK (qa_score >= 1 AND qa_score <= 5),
    rework_required BOOLEAN DEFAULT FALSE,
    checklist_completion_percent INTEGER DEFAULT 0,
    required_photo_count INTEGER DEFAULT 0,
    uploaded_photo_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Client Reviews Table
CREATE TABLE IF NOT EXISTS client_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL,
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Travel Metrics Table
CREATE TABLE IF NOT EXISTS travel_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL,
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    distance_from_home_miles DECIMAL(10, 2),
    distance_from_region_center DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create Performance Config Table
CREATE TABLE IF NOT EXISTS performance_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Toggles
    acceptance_enabled BOOLEAN DEFAULT TRUE,
    completion_enabled BOOLEAN DEFAULT TRUE,
    qa_enabled BOOLEAN DEFAULT TRUE,
    rating_enabled BOOLEAN DEFAULT TRUE,
    reliability_enabled BOOLEAN DEFAULT TRUE,
    travel_enabled BOOLEAN DEFAULT FALSE,
    speed_enabled BOOLEAN DEFAULT FALSE,
    -- Weights
    acceptance_weight INTEGER DEFAULT 20,
    completion_weight INTEGER DEFAULT 20,
    qa_weight INTEGER DEFAULT 25,
    rating_weight INTEGER DEFAULT 20,
    reliability_weight INTEGER DEFAULT 15,
    travel_weight INTEGER DEFAULT 0,
    speed_weight INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create Performance Snapshots Table
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    lifetime_score INTEGER,
    rolling_score INTEGER,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Add updated_at trigger for new tables
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_offers_modtime BEFORE UPDATE ON job_offers FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_job_completions_modtime BEFORE UPDATE ON job_completions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_qa_reviews_modtime BEFORE UPDATE ON qa_reviews FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_client_reviews_modtime BEFORE UPDATE ON client_reviews FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_travel_metrics_modtime BEFORE UPDATE ON travel_metrics FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_performance_config_modtime BEFORE UPDATE ON performance_config FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Seed initial config
INSERT INTO performance_config (
    acceptance_enabled, completion_enabled, qa_enabled, rating_enabled, reliability_enabled,
    acceptance_weight, completion_weight, qa_weight, rating_weight, reliability_weight
) VALUES (
    TRUE, TRUE, TRUE, TRUE, TRUE,
    20, 20, 25, 20, 15
);
