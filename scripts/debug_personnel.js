
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

const projectRoot = process.cwd();
dotenv.config({ path: path.join(projectRoot, '.env') });
// fallback
dotenv.config({ path: path.join(projectRoot, '.env.local') });

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/axis_drone_platform',
});

async function checkSchema() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // Check columns in personnel table
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'personnel'
            ORDER BY column_name;
        `);

        console.log('\n--- Personnel Table Columns ---');
        const columns = res.rows.map(r => r.column_name);
        console.log(columns.join(', '));

        const hasStatus = columns.includes('onboarding_status');
        console.log(`\nHas 'onboarding_status': ${hasStatus ? 'YES' : 'NO'}`);

        if (hasStatus) {
            // Check data
            const dataRes = await client.query('SELECT full_name, role, onboarding_status FROM personnel LIMIT 3');
            console.log('\n--- Sample Data ---');
            dataRes.rows.forEach(r => console.log(`${r.full_name}: ${r.onboarding_status}`));
        } else {
            console.log('\n!!! CRITICAL ISUE: Migration has NOT been applied. !!!');
        }

    } catch (err) {
        console.error('Database Error:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
