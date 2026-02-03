-- Migration: Add tenant_id to personnel
-- Description: Adds multi-tenancy support to personnel table

ALTER TABLE personnel ADD COLUMN IF NOT EXISTS tenant_id UUID;
CREATE INDEX IF NOT EXISTS idx_personnel_tenant_id ON personnel(tenant_id);
