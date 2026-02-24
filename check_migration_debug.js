import { query } from './backend/config/database.js';

async function checkSchema() {
    try {
        console.log('Checking Sites columns...');
        const sitesCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sites'");
        console.log('Sites Cols:', sitesCols.rows.map(r => r.column_name));

        console.log('Checking Personnel columns...');
        const personnelCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'personnel'");
        console.log('Personnel Cols:', personnelCols.rows.map(r => r.column_name));

        console.log('Checking if pilot_documents exists...');
        const tableCheck = await query("SELECT tablename FROM pg_catalog.pg_tables WHERE tablename = 'pilot_documents'");
        console.log('Pilot Documents Table:', tableCheck.rows);

        if (tableCheck.rows.length > 0) {
            console.log('Checking Pilot Documents columns...');
            const docCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'pilot_documents'");
            console.log('Doc Cols:', docCols.rows.map(r => r.column_name));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error checking schema:', error);
        process.exit(1);
    }
}

checkSchema();
