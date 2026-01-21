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

async function runEnterpriseMigration() {
    try {
        console.log('🔄 Running Enterprise Hardening migration...');

        const file = '010_enterprise_hardening.sql';
        const migrationPath = path.join(__dirname, file);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log(`📝 Executing: ${file}`);
        await pool.query(sql);

        console.log(`✅ Migration ${file} completed`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runEnterpriseMigration();
