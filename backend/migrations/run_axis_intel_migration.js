/**
 * AXIS INTELLIGENCE MODULE — Migration Runner
 * 
 * Runs the 099_axis_intelligence.sql migration against the production database.
 * Safe to run multiple times (IF NOT EXISTS guards in SQL).
 * 
 * Usage: node backend/migrations/run_axis_intel_migration.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const { query } = await import('../config/database.js');

    console.log('🚀 Running Axis Intelligence Module migration...');

    const sqlPath = path.join(__dirname, '099_axis_intelligence.sql');
    let sql;
    try {
        sql = readFileSync(sqlPath, 'utf8');
    } catch (err) {
        console.error('❌ Could not read migration SQL file:', err.message);
        process.exit(1);
    }

    try {
        await query(sql);
        console.log('✅ Migration complete! Tables created:');
        console.log('   • axis_mission_intel');
        console.log('   • axis_mission_intel_simulations');

        // Verify tables were created
        const checkResult = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('axis_mission_intel', 'axis_mission_intel_simulations')
            ORDER BY table_name
        `);

        if (checkResult.rows.length === 2) {
            console.log('✅ Verification passed — both tables confirmed in database.');
        } else {
            console.warn('⚠️  Verification: only', checkResult.rows.length, 'of 2 tables found.');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
