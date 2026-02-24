
import db from './backend/config/database.js';

async function checkTable() {
    try {
        const res = await db.query("SELECT * FROM information_schema.tables WHERE table_name = 'client_onboarding_configs'");
        console.log('client_onboarding_configs table exists:', res.rows.length > 0);

        const resSettings = await db.query("SELECT * FROM information_schema.tables WHERE table_name = 'client_settings'");
        console.log('client_settings table exists:', resSettings.rows.length > 0);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkTable();
