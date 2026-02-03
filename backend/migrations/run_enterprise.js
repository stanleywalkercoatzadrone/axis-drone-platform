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
        // 1. Load Env
        const projectRoot = path.resolve(__dirname, '../..');
        const envPath = path.join(projectRoot, '.env.local');
        console.log(`📂 Loading env from ${envPath}`);
        dotenv.config({ path: envPath });

        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is missing!');
        }

        let connectionString = process.env.DATABASE_URL;
        console.log(`🔌 Original URL: ${connectionString.replace(/:([^:@]{3,})@/, ':****@')}`);

        // 2. Adjust for Migration Compatibility
        // Problem: Direct Connection (db.supabase.co) is unreachable (IPv6 issues).
        // Problem: Transaction Pooler (port 6543) blocks schema changes.
        // Solution: Use Session Mode on the Pooler (Port 5432).

        if (connectionString.includes('pooler.supabase.com') && connectionString.includes('6543')) {
            console.log('⚠️  Switching Pooler from Transaction Mode (6543) to Session Mode (5432) for Migration...');
            connectionString = connectionString.replace('6543', '5432');
        }

        const client = new Client({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });

        console.log('⏳ Connecting...');
        await client.connect();
        console.log('✅ Connected successfully!');

        const sqlFile = path.join(__dirname, 'fix_reports_schema.sql');
        console.log(`📖 Reading SQL file: ${sqlFile}`);

        if (!fs.existsSync(sqlFile)) {
            throw new Error(`SQL file not found at ${sqlFile}`);
        }

        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('🚀 Executing Migration...');
        await client.query(sql);
        console.log('✨ Migration Applied Successfully!');

        await client.end();
        await client.end();

        // Only exit if running standalone
        if (process.argv[1] === fileURLToPath(import.meta.url)) {
            process.exit(0);
        }

    } catch (err) {
        console.error('❌ Error during migration:', err);
        // Only exit if running standalone
        if (process.argv[1] === fileURLToPath(import.meta.url)) {
            process.exit(1);
        }
        throw err;
    }
};

// Auto-execute only if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    run();
}

export { run as runEnterpriseMigration };
