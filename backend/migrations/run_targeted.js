import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

async function runTargetedMigration() {
    try {
        console.log('🔄 Running TARGETED migration 20260225_add_force_password_reset...');
        const file = '20260225_add_force_password_reset.sql';
        const migrationPath = path.join(__dirname, file);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);
        console.log(`✅ Migration ${file} completed`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runTargetedMigration();
