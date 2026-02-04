-- Migration: Create Ingestion System Tables

-- 1. Ingestion Jobs (The Batch)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry TEXT NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id),
    site_id UUID NOT NULL REFERENCES sites(id),
    
    status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed, partial_failure
    progress INTEGER NOT NULL DEFAULT 0,   -- 0-100
    
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ingestion Files (Individual Files in a Job)
CREATE TABLE IF NOT EXISTS ingestion_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    
    filename TEXT NOT NULL,
    relative_path TEXT, -- For folder structure preservation
    file_size BIGINT,
    mime_type TEXT,
    checksum TEXT,      -- SHA-256 for integrity
    
    status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded, validating, valid, invalid, ingesting, ingested, error
    validation_errors JSONB,                 -- Store structured validation errors
    
    storage_path TEXT,  -- Path in GCS/S3
    
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ingestion Events (Audit Log / granular progress)
CREATE TABLE IF NOT EXISTS ingestion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    
    level TEXT NOT NULL, -- info, warn, error
    code TEXT,           -- Machine readable error code
    message TEXT NOT NULL,
    meta JSONB,          -- Context data
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ingestion Exceptions (Actionable items for users)
CREATE TABLE IF NOT EXISTS ingestion_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    file_id UUID REFERENCES ingestion_files(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL,     -- SLA_BREACH, VALIDATION_ERROR, PROCESSING_ERROR, DUPLICATE_ASSET
    severity TEXT NOT NULL, -- critical, high, medium, low
    status TEXT NOT NULL DEFAULT 'open', -- open, resolved, ignored
    
    description TEXT,
    remediation_steps TEXT,
    
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_client_site ON ingestion_jobs(client_id, site_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_files_job ON ingestion_files(job_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_exceptions_job ON ingestion_exceptions(job_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_exceptions_status ON ingestion_exceptions(status);
