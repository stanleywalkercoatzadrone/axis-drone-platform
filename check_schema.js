import pool from './backend/config/database.js';

async function checkSchema() {
    try {
        const personnel = await pool.query("SELECT asterisk FROM information_schema.columns WHERE table_name = 'personnel'".replace('asterisk', '*'));
        console.log('--- PERSONNEL COLUMNS ---');
        personnel.rows.forEach(row => console.log(row.column_name));

        const banking = await pool.query("SELECT asterisk FROM information_schema.columns WHERE table_name = 'pilot_banking_info'".replace('asterisk', '*'));
        console.log('\n--- PILOT_BANKING_INFO COLUMNS ---');
        banking.rows.forEach(row => console.log(row.column_name));

        const invoices = await pool.query("SELECT asterisk FROM information_schema.columns WHERE table_name = 'invoices'".replace('asterisk', '*'));
        console.log('\n--- INVOICES COLUMNS ---');
        invoices.rows.forEach(row => console.log(row.column_name));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
