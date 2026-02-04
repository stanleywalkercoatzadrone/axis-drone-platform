
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function linkSites() {
    try {
        const client = await pool.connect();

        // Link Q1 Solar Field Audit to West Field Solar Array
        await client.query(`
      UPDATE deployments 
      SET site_id = (SELECT id FROM sites WHERE name = 'West Field Solar Array' LIMIT 1)
      WHERE title = 'Q1 Solar Field Audit'
    `);

        // Link Monthly Thermal Scan to West Field Solar Array as well
        await client.query(`
      UPDATE deployments 
      SET site_id = (SELECT id FROM sites WHERE name = 'West Field Solar Array' LIMIT 1)
      WHERE title = 'Monthly Thermal Scan'
    `);

        console.log('Successfully linked deployments to sites.');
        client.release();
    } catch (err) {
        console.error('Error linking sites:', err);
    } finally {
        process.exit();
    }
}

linkSites();
