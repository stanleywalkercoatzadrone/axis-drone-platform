import db from './backend/config/database.js';

async function checkSchema() {
    try {
        const countriesRes = await db.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'countries';
    `);
        console.log('--- Countries Table ---');
        console.table(countriesRes.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
