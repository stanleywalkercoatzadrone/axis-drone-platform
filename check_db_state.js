import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import db from './backend/config/database.js';

async function migratePhases() {
    try {
        console.log('Running migration on construction_phases...');
        await db.query(`ALTER TABLE construction_phases ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
        await db.query(`ALTER TABLE construction_phases ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES construction_projects(id) ON DELETE CASCADE`);
        console.log('Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('Error during migration:', err);
        process.exit(1);
    }
}

migratePhases();
