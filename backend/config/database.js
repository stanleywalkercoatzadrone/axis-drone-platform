import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root (two levels up from backend/config/database.js)
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

// Support both DATABASE_URL (Supabase/production) and individual params (local dev)
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    }
    : {
        // Fallback to the known Production Supabase URL if env var is missing
        connectionString: "postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
    console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL connection error:', err);
    // Don't exit process, allow frontend mocks to work
    // process.exit(-1);
});

// Query helper
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Query error:', error);
        throw error;
    }
};

// Transaction helper
export const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export default pool;
