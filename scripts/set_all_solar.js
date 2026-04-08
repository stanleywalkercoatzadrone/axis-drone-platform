import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

import pool from '../backend/config/database.js';

async function run() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Fetching Solar industry ID...');
        const res = await client.query("SELECT id FROM industries WHERE key = 'solar' LIMIT 1");

        if (res.rows.length === 0) {
            console.error('Error: Solar industry not found in the industries table.');
            process.exit(1);
        }

        const solarId = res.rows[0].id;
        console.log(`Found Solar industry ID: ${solarId}`);

        console.log('Updating all clients to Solar industry...');
        const clientUpdate = await client.query('UPDATE clients SET industry_id = $1', [solarId]);
        console.log(`Updated ${clientUpdate.rowCount} clients.`);

        console.log('Updating all reports to Solar industry...');
        const reportUpdate = await client.query("UPDATE reports SET industry = 'Solar'");
        console.log(`Updated ${reportUpdate.rowCount} reports.`);

        console.log('Successfully reloaded all missions into the solar industry.');
        client.release();
        process.exit(0);
    } catch (error) {
        console.error('Failed to run migration:', error);
        process.exit(1);
    }
}

run();
