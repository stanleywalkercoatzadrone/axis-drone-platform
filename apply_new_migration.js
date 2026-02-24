import { query } from './backend/config/database.js';
import fs from 'fs';
import path from 'path';

const migrationPath = './backend/migrations/20260216_safe_additive_update.sql';

async function runMigration() {
    try {
        console.log('Reading migration file...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
        // We split by semicolon to handle multiple statements if needed, 
        // but pg.Pool.query can handle multiple statements in one call.
        await query(sql);

        console.log('✅ Migration applied successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
