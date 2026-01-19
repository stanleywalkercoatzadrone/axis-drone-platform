-- Create database schema for SkyLens AI Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    title VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    permissions JSONB DEFAULT '[]'::jsonb,
    google_id VARCHAR(255) UNIQUE,
    profile_picture_url TEXT,
    drive_linked BOOLEAN DEFAULT FALSE,
    drive_folder VARCHAR(255),
    drive_access_token TEXT,
    drive_refresh_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('ADMIN', 'USER', 'AUDITOR'))
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    client VARCHAR(255) NOT NULL,
    industry VARCHAR(50) NOT NULL,
    theme VARCHAR(50) NOT NULL DEFAULT 'TECHNICAL',
    config JSONB DEFAULT '{}'::jsonb,
    summary TEXT,
    site_context JSONB,
    strategic_assessment JSONB,
    branding JSONB,
    status VARCHAR(50) DEFAULT 'DRAFT',
    version INTEGER DEFAULT 1,
    approval_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMP,
    CONSTRAINT valid_industry CHECK (industry IN ('Solar', 'Utilities', 'Insurance', 'Telecom', 'Construction')),
    CONSTRAINT valid_theme CHECK (theme IN ('TECHNICAL', 'EXECUTIVE', 'MINIMAL')),
    CONSTRAINT valid_status CHECK (status IN ('DRAFT', 'FINALIZED', 'ARCHIVED'))
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    storage_url TEXT NOT NULL,
    storage_key VARCHAR(500),
    annotations JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync logs table
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination VARCHAR(100) NOT NULL,
    path TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_sync_status CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING'))
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report history table
CREATE TABLE IF NOT EXISTS report_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    author VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    changes JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_images_report_id ON images(report_id);
CREATE INDEX idx_sync_logs_report_id ON sync_logs(report_id);
CREATE INDEX idx_sync_logs_timestamp ON sync_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_report_history_report_id ON report_history(report_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, company_name, role, permissions)
VALUES (
    'admin@coatzadroneusa.com',
    '$2a$10$XqWKz9KqVYQZqZQZqZQZqeKqVYQZqZQZqZQZqZQZqZQZqZQZqZQZq',
    'System Administrator',
    'CoatzadroneUSA',
    'ADMIN',
    '["CREATE_REPORT", "MANAGE_USERS", "VIEW_MASTER_VAULT", "DELETE_REPORT", "APPROVE_REPORT", "MANAGE_SETTINGS"]'::jsonb
)
ON CONFLICT (email) DO NOTHING;
