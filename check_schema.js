import { query } from './backend/config/database.js';

async function checkSchema() {
    try {
        console.log('Checking invoices table columns...');
        const res = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'invoices'
        `);
        console.log('Columns in invoices table:', res.rows.map(r => r.column_name));

        console.log('\nChecking system_settings...');
        const settingsRes = await query("SELECT * FROM system_settings WHERE setting_key = 'invoice_payment_days'");
        console.log('invoice_payment_days setting:', settingsRes.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error checking schema:', err);
        process.exit(1);
    }
}

checkSchema();
