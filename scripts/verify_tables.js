
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

async function verifyTables() {
    try {
        await client.connect();

        const tables = ['refresh_tokens', 'audit_logs'];

        for (const table of tables) {
            console.log(`Checking table: ${table}...`);
            try {
                // Try selecting 1 row
                await client.query(`SELECT 1 FROM ${table} LIMIT 1`);
                console.log(`✅ Table "${table}" exists.`);
            } catch (err) {
                if (err.code === '42P01') {
                    console.warn(`⚠️  Table "${table}" MISSING! Creating...`);

                    if (table === 'refresh_tokens') {
                        await client.query(`
                            CREATE TABLE refresh_tokens (
                                id SERIAL PRIMARY KEY,
                                jti VARCHAR(255) NOT NULL UNIQUE,
                                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                                family_id UUID NOT NULL,
                                status VARCHAR(50) DEFAULT 'active',
                                expires_at TIMESTAMP NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                        `);
                    } else if (table === 'audit_logs') {
                        await client.query(`
                            CREATE TABLE audit_logs (
                                id SERIAL PRIMARY KEY,
                                user_id UUID REFERENCES users(id),
                                action VARCHAR(255) NOT NULL,
                                resource_type VARCHAR(255),
                                resource_id VARCHAR(255),
                                metadata JSONB,
                                ip_address VARCHAR(50),
                                user_agent TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                       `);
                    }
                    console.log(`✅ Table "${table}" created.`);
                } else {
                    console.error(`❌ Error checking ${table}:`, err.message);
                }
            }
        }

    } catch (err) {
        console.error('Error verifying tables:', err);
    } finally {
        await client.end();
    }
}

verifyTables();
