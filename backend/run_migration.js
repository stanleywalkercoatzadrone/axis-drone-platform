import pool from './config/database.js';

async function run() {
    try {
        await pool.query(`
            ALTER TABLE construction_phases 
            ADD COLUMN IF NOT EXISTS project_id UUID,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        `);
        console.log("Columns added successfully");
        process.exit(0);
    } catch(e) {
        console.error("Migration failed:", e.message);
        process.exit(1);
    }
}
run();
