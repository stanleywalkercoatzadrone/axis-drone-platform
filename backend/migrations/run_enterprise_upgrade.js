#!/usr/bin/env node
// Self-contained enterprise migration runner
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: false,
});

async function run() {
    const sqlPath = path.join(__dirname, '20260306_enterprise_upgrade.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    const client = await pool.connect();
    try {
        console.log('🚀 Running enterprise upgrade migration...');
        console.log('   Target:', connectionString.split('@')[1]?.split('/')[0] || '(connection string)');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ Enterprise upgrade migration complete!');
        console.log('   Tables created/verified: mission_work_sessions, mission_timeline, solar_blocks, thermal_faults, pilot_metrics');
        console.log('   Columns added: deployments.mission_status_v2, completion_percent, billing_status, allow_partial_invoice, total_sessions, industry_type');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        if (err.detail) console.error('   Detail:', err.detail);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
