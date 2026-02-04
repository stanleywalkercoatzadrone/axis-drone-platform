
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/axis_drone_platform',
});

async function getLink() {
    try {
        await client.connect();

        // Find a recent package or create one if needed (for now just find one)
        const res = await client.query(`
            SELECT op.access_token, p.full_name 
            FROM onboarding_packages op
            JOIN personnel p ON op.personnel_id = p.id
            ORDER BY op.created_at DESC 
            LIMIT 1
        `);

        if (res.rows.length > 0) {
            const { access_token, full_name } = res.rows[0];
            console.log(`\nFound latest onboarding package for: ${full_name}`);
            console.log(`Test URL: http://localhost:3000/onboarding/portal/${access_token}`);
        } else {
            console.log('No onboarding packages found. Please go to Personnel Registry and send a package first.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

getLink();
