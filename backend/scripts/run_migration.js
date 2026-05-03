import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = async () => {
    try {
        console.log('🚀 Migration Runner V1.0');
        const env = process.argv[2] || 'development';

        // 1. Load Env
        const projectRoot = path.resolve(__dirname, '../../');
        let envPath = path.join(projectRoot, '.env.local');

        if (env === 'production') {
            console.log('🌍 Production Mode Selected');
            const prodEnvPath = path.join(projectRoot, '.env');
            if (fs.existsSync(prodEnvPath)) {
                console.log(`📂 Loading production env from ${prodEnvPath}`);
                dotenv.config({ path: prodEnvPath });
            }
        } else {
            console.log(`📂 Loading env from ${envPath}`);
            dotenv.config({ path: envPath });
        }

        if (!process.env.DATABASE_URL) {
            // Try loading .env.local even if 'production' argument passed (for local testing)
            if (fs.existsSync(envPath)) {
                dotenv.config({ path: envPath });
            }
            if (!process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL is missing!');
            }
        }

        let connectionString = process.env.DATABASE_URL;
        console.log(`🔌 URL: ${connectionString.replace(/:([^:@]{3,})@/, ':****@')}`);

        // Fix for Supabase Transaction Pooler (6543)
        if (connectionString.includes('pooler.supabase.com') && connectionString.includes('6543')) {
            console.log('⚠️  Switching Pooler from Transaction Mode (6543) to Session Mode (5432) for Schema Change...');
            connectionString = connectionString.replace('6543', '5432');
        }

        let client = new Client({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });

        console.log('⏳ Connecting...');
        try {
            await client.connect();
        } catch (authErr) {
            throw authErr;
        }
        console.log('✅ Connected successfully!');

        // 2. Load Specific Migration File (The Fix)
        const migrationFile = path.join(projectRoot, 'backend/migrations/20260216_add_missing_invoice_columns.sql');
        console.log(`📖 Reading Migration: ${migrationFile}`);

        if (!fs.existsSync(migrationFile)) {
            throw new Error(`Migration file not found at ${migrationFile}`);
        }

        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('🚀 Executing SQL...');
        await client.query(sql);
        console.log('✨ Migration Applied Successfully!');

        await client.end();

    } catch (err) {
        console.error('❌ Error during migration:', err);
        process.exit(1);
    }
};

run();
