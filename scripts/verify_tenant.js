
import { Client } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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

async function verifyTenant() {
    try {
        await client.connect();

        const tenantId = '5086c27f-f4c2-41c7-adce-560db3c67a65';
        console.log(`Checking for tenant: ${tenantId}`);

        try {
            const res = await client.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
            if (res.rows.length === 0) {
                console.log('❌ Tenant NOT found! Creating...');
                await createTenant(tenantId);
            } else {
                console.log('✅ Tenant found:', res.rows[0]);
            }
        } catch (err) {
            if (err.code === '42P01') {
                console.warn('⚠️  Table "tenants" missing! Creating table...');
                await client.query(`
                    CREATE TABLE IF NOT EXISTS tenants (
                        id UUID PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                console.log('✅ Created "tenants" table.');
                await createTenant(tenantId);
            } else {
                throw err;
            }
        }
    } catch (err) {
        console.error('Error verifying tenant:', err);
    } finally {
        await client.end();
    }
}

async function createTenant(id) {
    const insert = await client.query(
        `INSERT INTO tenants (id, name, created_at) VALUES ($1, $2, NOW()) RETURNING *`,
        [id, 'Primary Tenant']
    );
    console.log('✅ Created missing tenant:', insert.rows[0]);
}

verifyTenant();
