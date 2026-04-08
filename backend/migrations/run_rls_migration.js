#!/usr/bin/env node
/**
 * run_rls_migration.js
 * Enables Row Level Security on all Axis platform tables.
 * 
 * Usage:
 *   node backend/migrations/run_rls_migration.js
 *
 * Reads DATABASE_URL from the project root .env file.
 * Safe to run multiple times — ENABLE ROW LEVEL SECURITY is idempotent.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in .env');
  process.exit(1);
}

// Read the migration SQL
const sqlFile = path.resolve(__dirname, '20260401_enable_rls_all_tables.sql');
const sql = readFileSync(sqlFile, 'utf8');

// Extract only the ALTER TABLE ... ENABLE ROW LEVEL SECURITY statements
// and run them individually so we can report per-table success/failure
const alterStatements = sql
  .split('\n')
  .filter(line => line.trim().startsWith('ALTER TABLE') && line.includes('ENABLE ROW LEVEL SECURITY'))
  .map(line => line.trim().replace(/;$/, '').trim());

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('✅ Connected to database');
  console.log(`\n🔒 Enabling RLS on ${alterStatements.length} tables...\n`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of alterStatements) {
    // Extract table name for logging
    const match = stmt.match(/ALTER TABLE\s+(\S+)\s+ENABLE/i);
    const tableName = match ? match[1] : stmt;

    try {
      await client.query(stmt);
      console.log(`  ✅ ${tableName}`);
      succeeded++;
    } catch (err) {
      if (err.message.includes('does not exist')) {
        console.log(`  ⚠️  ${tableName} — table not found, skipping`);
        skipped++;
      } else {
        console.error(`  ❌ ${tableName} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log('\n──────────────────────────────────────');
  console.log(`✅ RLS enabled:    ${succeeded} tables`);
  console.log(`⚠️  Not found:      ${skipped} tables`);
  console.log(`❌ Errors:         ${failed} tables`);
  console.log('──────────────────────────────────────\n');

  // Verify current RLS status
  console.log('📋 Current RLS status for all public tables:\n');
  const { rows } = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  const enabled = rows.filter(r => r.rowsecurity);
  const disabled = rows.filter(r => !r.rowsecurity);

  if (disabled.length > 0) {
    console.log('🔴 Tables WITHOUT RLS (still publicly visible):');
    disabled.forEach(r => console.log(`   - ${r.tablename}`));
    console.log('');
  } else {
    console.log('🟢 All public tables now have RLS enabled!\n');
  }

  console.log(`🔒 Tables with RLS enabled: ${enabled.length}`);

  await client.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
