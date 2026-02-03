import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

async function runMigrations() {
    try {
        console.log('🔄 Running database migrations...');
        console.log('📍 Using DATABASE_URL:', process.env.DATABASE_URL ? 'Supabase connection found' : 'No DATABASE_URL found');

        // Get all SQL files in migrations directory
        const files = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Run in alphabetical order

        for (const file of files) {
            console.log(`\n📝 Running migration: ${file}`);
            const migrationPath = path.join(__dirname, file);
            const sql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await pool.query(sql);
                console.log(`✅ Migration ${file} completed`);
            } catch (err) {
                // Ignore "relation already exists" or "column already exists" errors to allow re-runs
                if (err.code === '42P07' || err.code === '42701' || err.code === '42710' || err.code === '23505') {
                    console.log(`⚠️  Skipping ${file}: Objects or Data already exist.`);
                } else {
                    throw err;
                }
            }
        }

        console.log('\n✅ All migrations completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();
