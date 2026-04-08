#!/usr/bin/env node
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL
    || "postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({ connectionString, ssl: false });

async function run() {
    const sqlPath = path.join(__dirname, '20260308_add_pilot_score.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    const client = await pool.connect();
    try {
        console.log('🚀 Running pilot_score migration...');
        await client.query(sql);
        console.log('✅ Done — pilot_score column added to pilot_metrics.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
