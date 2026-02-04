import { query } from '../backend/config/database.js';

const run = async () => {
    console.log('🔍 Inspecting Schema...');
    try {
        const res = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'reports';
        `);
        console.table(res.rows);

        if (res.rows.find(c => c.column_name === 'status')) {
            console.log('✅ Column "status" EXISTS!');
        } else {
            console.log('❌ Column "status" does NOT exist.');
        }

    } catch (err) {
        console.error('Query failed:', err);
    }
    process.exit(0);
};

run();
