import pg from 'pg';
import fs from 'fs';

const connectionString = "postgresql://postgres.nkhiiwleyjsmvvdtkcud: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@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runForcedMigration() {
  const client = await pool.connect();
  try {
    console.log("Dropping existing conflicting tables...");
    await client.query(`
      DROP TABLE IF EXISTS construction_audit_logs CASCADE;
      DROP TABLE IF EXISTS construction_daily_reports CASCADE;
      DROP TABLE IF EXISTS construction_issues CASCADE;
      DROP TABLE IF EXISTS construction_observations CASCADE;
      DROP TABLE IF EXISTS construction_evidence CASCADE;
      DROP TABLE IF EXISTS construction_milestones CASCADE;
      DROP TABLE IF EXISTS construction_projects CASCADE;
      DROP TABLE IF EXISTS construction_phases CASCADE;
    `);
    
    console.log("Running 005 migration...");
    const sql = fs.readFileSync('/Users/Huvrs/Projects/axis-drone-platform/backend/migrations/005_add_construction_monitoring.sql', 'utf8');
    await client.query(sql);
    console.log("005 migration applied successfully!");
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

runForcedMigration();
