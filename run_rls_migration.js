#!/usr/bin/env node
/**
 * run_rls_migration.js
 * Enables Row Level Security on all Axis platform tables.
 *
 * Usage (from project root):
 *   node run_rls_migration.js
 *
 * Reads DATABASE_URL from .env in this directory.
 * Safe to run multiple times — ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent.
 *
 * Fix notes:
 *   • pg does NOT auto-decode percent-encoded passwords (%21 → !, %40 → @),
 *     so we parse and decode the URL manually.
 *   • The Supabase pooler (pooler.supabase.com) blocks DDL statements.
 *     We reroute to the direct host (db.PROJECT.supabase.co:5432) automatically.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const RAW_URL = process.env.DATABASE_URL;
if (!RAW_URL) {
  console.error('❌ DATABASE_URL is not set in .env');
  process.exit(1);
}

// ── Parse + decode connection URL ────────────────────────────────────────────
let connConfig;
try {
  const u = new URL(RAW_URL);
  const user     = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  let   host     = u.hostname;
  let   port     = parseInt(u.port, 10) || 5432;
  const database = u.pathname.replace(/^\//, '');

  // Supabase pooler → direct host (required for DDL)
  // Pooler user: postgres.PROJECT_REF  →  direct user: postgres
  // Pooler host: aws-X.pooler.supabase.com  →  db.PROJECT_REF.supabase.co
  if (host.includes('pooler.supabase.com')) {
    const projectRef = user.includes('.') ? user.split('.').slice(1).join('.') : user;
    host = `db.${projectRef}.supabase.co`;
    port = 5432;
    console.log(`ℹ️  Pooler detected — rerouting to direct host: ${host}\n`);
  }

  connConfig = {
    user,
    password,
    host,
    port,
    database,
    ssl: { rejectUnauthorized: false },
  };
} catch (err) {
  console.error('❌ Failed to parse DATABASE_URL:', err.message);
  process.exit(1);
}

// ── Tables to enable RLS on ───────────────────────────────────────────────────
const TABLES = [
  // Core
  'users', 'reports', 'images', 'sync_logs', 'audit_logs', 'report_history',
  // Personnel & Deployments
  'personnel', 'deployments', 'daily_logs', 'deployment_personnel',
  // Security
  'refresh_tokens',
  // RBAC
  'roles', 'permissions', 'role_permissions', 'user_role_bindings',
  // Work items & checklists
  'mapping_templates', 'workbooks', 'work_items', 'work_item_updates',
  // Assets / Sites / Industries
  'assets', 'sites', 'industries',
  // Invoices
  'invoices', 'master_invoices',
  // Onboarding
  'onboarding_sessions', 'onboarding_documents',
  // Documents
  'personnel_documents',
  // Clients
  'clients', 'client_contacts', 'client_projects',
  // Ingestion
  'ingestion_jobs', 'ingestion_records',
  // AI
  'ai_reports', 'ai_daily_summaries',
  'axis_mission_intel', 'axis_mission_intel_simulations',
  // Uploads
  'upload_jobs', 'upload_files',
  // Mission forecasting & orchestration
  'mission_daily_performance', 'mission_forecast_windows',
  'mission_schedule_suggestions', 'mission_orchestration',
  'orchestration_override_logs', 'mission_timeline', 'mission_work_sessions',
  // Pilot performance
  'pilot_performance', 'pilot_metrics',
  // LBD Block tracking
  'solar_blocks', 'block_progress',
  // Thermal / Energy
  'thermal_faults', 'thermal_images', 'fault_energy_loss',
  // Vendor
  'vendor_expenses',
  // System
  'system_settings', 'notifications', 'security_events', 'flight_parameters',
  // Misc
  'candidates', 'candidate_documents', 'protocols', 'asset_grid',
];

// ── Run ───────────────────────────────────────────────────────────────────────
const client = new pg.Client(connConfig);

async function run() {
  console.log(`🔌 Connecting to ${connConfig.host}:${connConfig.port} as ${connConfig.user}...`);
  await client.connect();
  console.log('✅ Connected\n');
  console.log(`🔒 Enabling RLS on ${TABLES.length} tables...\n`);

  let succeeded = 0, skipped = 0, failed = 0;

  for (const table of TABLES) {
    try {
      await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      console.log(`  ✅ ${table}`);
      succeeded++;
    } catch (err) {
      if (err.message.includes('does not exist')) {
        console.log(`  ⚠️  ${table} — not found, skipping`);
        skipped++;
      } else {
        console.error(`  ❌ ${table} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log('\n──────────────────────────────────────');
  console.log(`✅ RLS enabled:  ${succeeded} tables`);
  console.log(`⚠️  Not found:   ${skipped} tables`);
  console.log(`❌ Errors:       ${failed} tables`);
  console.log('──────────────────────────────────────\n');

  // Show any remaining unprotected tables (catches ones we may have missed)
  const { rows } = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  const noRLS = rows.filter(r => !r.rowsecurity);
  if (noRLS.length > 0) {
    console.log('🔴 Tables still WITHOUT RLS:');
    noRLS.forEach(r => console.log(`   - ${r.tablename}`));
    console.log('\nAdd any critical ones to TABLES[] above and re-run.\n');
  } else {
    console.log('🟢 All public tables now have RLS enabled!\n');
  }

  const withRLS = rows.filter(r => r.rowsecurity).length;
  console.log(`📊 Total tables: ${rows.length} | RLS on: ${withRLS} | RLS off: ${noRLS.length}\n`);

  await client.end();
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
