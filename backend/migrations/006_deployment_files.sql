-- Migration 006: Deployment Files
-- Description: Create table for files attached to deployments (missions)

CREATE TABLE IF NOT EXISTS deployment_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    type VARCHAR(50), -- e.g. 'image/jpeg', 'application/vnd.google-earth.kml+xml', 'application/pdf'
    size INTEGER, -- in bytes
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deployment_files_deployment_id ON deployment_files(deployment_id);
