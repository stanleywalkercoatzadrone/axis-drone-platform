import { query } from './backend/config/database.js';
import fs from 'fs';
const migrationPath = './backend/migrations/026_mission_ingestion.sql';
async function runMigration() {
    try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await query(sql);
        console.log('✅ Migration applied successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}
runMigration();
