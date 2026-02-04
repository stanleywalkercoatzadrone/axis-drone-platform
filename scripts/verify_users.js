
import { Client } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Try loading .env.local first
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

import fs from 'fs';

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config({ path: envPath });
}

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function listUsers() {
    try {
        await client.connect();
        console.log('Connected to database.');

        const res = await client.query('SELECT id, email, role, tenant_id FROM users LIMIT 5');
        console.log('--- Users ---');
        if (res.rows.length === 0) {
            console.log('No users found!');
        } else {
            console.table(res.rows);
        }
    } catch (err) {
        console.error('Error fetching users:', err);
    } finally {
        await client.end();
    }
}

listUsers();
