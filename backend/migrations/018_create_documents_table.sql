-- Migration: Create documents table
-- Description: Replaces Firestore for document metadata tracking.
-- NOTE: Foreign Keys for job/client/site are made loose to prevent migration failures 
-- if those tables don't exist yet in the target environment.

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    size BIGINT,
    type TEXT DEFAULT 'general',
    
    -- Relationships (Loose coupling for safe migration)
    job_id UUID, 
    client_id UUID,
    site_id UUID,
    
    description TEXT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Users table is guaranteed to exist
    tenant_id UUID NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_job_id ON documents(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
