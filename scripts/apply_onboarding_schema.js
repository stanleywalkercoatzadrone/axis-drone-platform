
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
console.log(`📂 Project Root: ${projectRoot}`);

// Try loading .env.local first (Supabase usually puts it here)
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envLocalPath)) {
    console.log(`Loading .env.local from ${envLocalPath}`);
    dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
    console.log(`Loading .env from ${envPath}`);
    dotenv.config({ path: envPath });
} else {
    console.warn('⚠️  No .env or .env.local file found!');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in environment variables.');
    process.exit(1);
} else {
    // Log masked URL for debugging
    console.log(`🔌 Using Database: ${connectionString.split('@')[1] || '...mapped'}`);
}

const client = new Client({
    connectionString: connectionString,
});

async function applyOnboarding() {
    try {
        await client.connect();
        console.log('Connected to database.');

        const migrationPath = path.join(projectRoot, 'backend/migrations/011_onboarding_system.sql');
        console.log(`Reading migration: ${migrationPath}`);

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Applying onboarding schema...');
        await client.query(sql);

        console.log('✅ Onboarding schema applied successfully!');
    } catch (err) {
        // Handle "already exists" errors gracefully-ish, or just log them
        if (err.code === '42P07' || err.code === '42701') {
            console.log('✅ Changes already applied (objects exist).');
        } else {
            console.error('❌ Failed to apply schema:', err);
        }
    } finally {
        await client.end();
    }
}

applyOnboarding();
