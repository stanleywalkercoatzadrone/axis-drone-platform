import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (fallback to .env if .env.local missing)
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env.local') }); // Override with local if exists

async function runMigrations() {
    try {
        console.log('🔄 Running database migrations...');
        console.log('📍 Using DATABASE_URL:', process.env.DATABASE_URL ? 'Supabase connection found' : 'No DATABASE_URL found');

        const files = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const file of files) {
            console.log(`\n📝 Running migration: ${file}`);
            const migrationPath = path.join(__dirname, file);
            const sql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await pool.query(sql);
                console.log(`✅ Migration ${file} completed`);
            } catch (err) {
                // Always continue — log warning but never abort the chain.
                // Individual migration failures (already-exists, constraint violations,
                // missing extensions etc.) should not block subsequent migrations.
                console.warn(`⚠️  Migration ${file} skipped (${err.code || 'ERR'}): ${err.message}`);
            }
        }

        console.log('\n✅ All migrations processed');
        process.exit(0);
    } catch (error) {
        // Only fatal errors (e.g. DB connection failure) reach here
        console.error('❌ Migration runner fatal error:', error);
        process.exit(1);
    }
}

runMigrations();
