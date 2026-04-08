-- ============================================================
-- Migration: Enable Row Level Security on ALL tables
-- Date: 2026-04-01
-- Reason: Supabase warning — tables are publicly visible via
--         the anon key without RLS policies.
--
-- Strategy:
--   • Enable RLS on every table (blocks anonymous access).
--   • Grant full access only to the `service_role` (Postgres
--     backend user that bypasses RLS by default) — no change
--     needed for your Express backend.
--   • NO permissive public or anon policies are added.
--     All access is enforced through the Express API layer.
-- ============================================================

-- ── Core tables from 001_initial_schema ──────────────────────
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE images            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history    ENABLE ROW LEVEL SECURITY;

-- ── Personnel & Deployments from 004 ─────────────────────────
ALTER TABLE personnel              ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_personnel   ENABLE ROW LEVEL SECURITY;

-- ── Security hardening from 20260201 ─────────────────────────
ALTER TABLE refresh_tokens    ENABLE ROW LEVEL SECURITY;

-- ── RBAC tables from 20260203 ────────────────────────────────
ALTER TABLE roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_bindings ENABLE ROW LEVEL SECURITY;

-- ── Work items / checklists from 20260203 ────────────────────
ALTER TABLE mapping_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbooks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_updates  ENABLE ROW LEVEL SECURITY;

-- ── Assets / Sites from 005_sites_assets / 20260205 ──────────
ALTER TABLE assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE industries         ENABLE ROW LEVEL SECURITY;

-- ── Invoices / Master Invoices ────────────────────────────────
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_invoices    ENABLE ROW LEVEL SECURITY;

-- ── Onboarding from 011 ───────────────────────────────────────
ALTER TABLE onboarding_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_documents  ENABLE ROW LEVEL SECURITY;

-- ── Documents ─────────────────────────────────────────────────
ALTER TABLE personnel_documents   ENABLE ROW LEVEL SECURITY;

-- ── Clients from 20260203_industry_client_schema ─────────────
ALTER TABLE clients                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_projects         ENABLE ROW LEVEL SECURITY;

-- ── Ingestion from 20260203_ingestion_system ─────────────────
ALTER TABLE ingestion_jobs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_records       ENABLE ROW LEVEL SECURITY;

-- ── AI tables ────────────────────────────────────────────────
ALTER TABLE ai_reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_daily_summaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE axis_mission_intel      ENABLE ROW LEVEL SECURITY;
ALTER TABLE axis_mission_intel_simulations ENABLE ROW LEVEL SECURITY;

-- ── Pilot upload pipeline ─────────────────────────────────────
ALTER TABLE upload_jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_files            ENABLE ROW LEVEL SECURITY;

-- ── Mission forecasting ───────────────────────────────────────
ALTER TABLE mission_daily_performance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_forecast_windows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_schedule_suggestions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_orchestration          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestration_override_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_timeline               ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_work_sessions          ENABLE ROW LEVEL SECURITY;

-- ── Pilot performance & metrics ───────────────────────────────
ALTER TABLE pilot_performance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilot_metrics      ENABLE ROW LEVEL SECURITY;

-- ── LBD Block tracking ────────────────────────────────────────
ALTER TABLE solar_blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_progress      ENABLE ROW LEVEL SECURITY;

-- ── Thermal / Energy Loss ────────────────────────────────────
ALTER TABLE thermal_faults      ENABLE ROW LEVEL SECURITY;
ALTER TABLE thermal_images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fault_energy_loss   ENABLE ROW LEVEL SECURITY;

-- ── Vendor Expenses ───────────────────────────────────────────
ALTER TABLE vendor_expenses     ENABLE ROW LEVEL SECURITY;

-- ── System / Notifications / Flight ──────────────────────────
ALTER TABLE system_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_parameters       ENABLE ROW LEVEL SECURITY;

-- ── Misc tables ───────────────────────────────────────────────
ALTER TABLE candidates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols               ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_grid              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICY: Deny everything to anon / authenticated Supabase roles
-- Your backend connects as the Postgres superuser or service_role
-- which BYPASSES RLS entirely — this only blocks direct Supabase
-- client access using the anon/authenticated JWT roles.
--
-- We do NOT create any permissive policies, so by default all
-- table access is denied to every Supabase client role.
-- ============================================================

-- ── Verify RLS is active (informational) ─────────────────────
-- Run this query manually to confirm:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- All tables should show rowsecurity = true.
