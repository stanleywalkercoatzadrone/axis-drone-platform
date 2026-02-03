#!/usr/bin/env node

// Simple script to run production migrations
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Production database URL
const DATABASE_URL = 'postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
    try {
        console.log('🔄 Running production database migrations...');

        const migrationsDir = '/Users/Huvrs/Projects/axis-drone-platform/backend/migrations';
        const files = readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const file of files) {
            console.log(`\n📝 Running migration: ${file}`);
            const migrationPath = join(migrationsDir, file);
            const sql = readFileSync(migrationPath, 'utf8');

            try {
                await pool.query(sql);
                console.log(`✅ Migration ${file} completed`);
            } catch (err) {
                // Ignore "already exists" errors
                if (err.code === '42P07' || err.code === '42701' || err.code === '42710' || err.code === '23505') {
                    console.log(`⚠️  Skipping ${file}: Objects or data already exist.`);
                } else {
                    console.error(`❌ Error in ${file}:`, err.message);
                    throw err;
                }
            }
        }

        console.log('\n✅ All migrations completed successfully');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await pool.end();
        process.exit(1);
    }
}

runMigrations();
