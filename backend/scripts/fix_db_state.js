import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function fixDb() {
    try {
        console.log('🔧 Fixing DB State...');

        // 1. Ensure Sites table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sites (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                client VARCHAR(255) NOT NULL,
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Sites table ensured.');

        // 2. Ensure Legacy Assets table exists (so 005_sites_assets.sql doesn't fail on Insert)
        // Note: Using VARCHAR id to match legacy schema
        await pool.query(`
            CREATE TABLE IF NOT EXISTS assets (
                id VARCHAR(50) PRIMARY KEY,
                site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'Active',
                last_inspection_date TIMESTAMP WITH TIME ZONE,
                next_inspection_date TIMESTAMP WITH TIME ZONE,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Legacy Assets table ensured.');

    } catch (e) {
        console.error('❌ Error fixing DB:', e);
    } finally {
        await pool.end();
    }
}

fixDb();
