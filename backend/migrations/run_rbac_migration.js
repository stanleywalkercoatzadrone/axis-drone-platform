import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

async function runRbacMigration() {
    try {
        console.log('🔄 Running RBAC and Checklist migration...');
        const file = '20260203_rbac_and_checklists.sql';
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

runRbacMigration();
