-- ============================================================
-- Migration: Audit Log Hardening
-- Date: 2026-04-06
-- Extends audit_logs with request context + before/after state
-- Adds immutability rules (no UPDATE or DELETE on audit rows)
-- ADDITIVE ONLY — uses ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ── Extend audit_logs ─────────────────────────────────────────

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS request_id   UUID,        -- requestId from X-Request-ID header
    ADD COLUMN IF NOT EXISTS before_state JSONB,       -- entity state before the action
    ADD COLUMN IF NOT EXISTS after_state  JSONB,       -- entity state after the action
    ADD COLUMN IF NOT EXISTS ip_address   INET;        -- client IP address

-- Additional index for new request_id column (audit trace lookup)
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id
    ON audit_logs(request_id)
    WHERE request_id IS NOT NULL;

-- Index for export queries (date range + user + action)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action
    ON audit_logs(user_id, action, created_at DESC);

-- ── Immutability Rules ────────────────────────────────────────
-- Prevents any UPDATE or DELETE on audit_logs.
-- The backend connects as service_role which CAN bypass these via
-- SECURITY DEFINER functions — but no application code should ever
-- mutate audit rows. This is a belt-and-suspenders immutability guard.

-- Drop if exists (idempotent re-run safety)
DROP RULE IF EXISTS audit_no_update ON audit_logs;
DROP RULE IF EXISTS audit_no_delete ON audit_logs;

-- Immutability: silently discard UPDATE and DELETE attempts
CREATE RULE audit_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- ── Add export endpoint support: resource_type index ─────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
    ON audit_logs(resource_type, resource_id);

-- ── Verification (informational) ─────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'audit_logs'
-- ORDER BY ordinal_position;
-- Should show: request_id, before_state, after_state, ip_address
--
-- Test immutability:
-- UPDATE audit_logs SET action = 'TAMPERED' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
-- Should affect 0 rows.
