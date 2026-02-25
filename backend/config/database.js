import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

// Fallback connection string from .env.local
const DEFAULT_CONNECTION_STRING = "postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

// Helper to parse connection string
const parseConnectionString = (connectionString) => {
    try {
        const url = new URL(connectionString);
        return {
            user: url.username,
            password: url.password,
            host: url.hostname,
            port: url.port,
            database: url.pathname.split('/')[1],
            ssl: url.hostname === 'localhost' || url.hostname === '127.0.0.1' ? false : {
                rejectUnauthorized: false,
                require: true
            }
        };
    } catch (e) {
        console.error('Failed to parse DATABASE_URL:', e.message);
        return { connectionString }; // Fallback
    }
};

let poolConfig;

if (process.env.DATABASE_URL) {
    poolConfig = {
        ...parseConnectionString(process.env.DATABASE_URL),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true
    };
} else {
    poolConfig = {
        connectionString: DEFAULT_CONNECTION_STRING,
        ssl: {
            rejectUnauthorized: false,
            require: true
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true
    };
}



const pool = new Pool(poolConfig);

// Don't test connection immediately - let it happen lazily on first query
// This prevents blocking the container startup if DB is slow/unreachable
pool.on('connect', async (client) => {
    console.log('✅ PostgreSQL connected');
    try {
        const res = await client.query('SHOW search_path');
        const contextRes = await client.query('SELECT current_database(), current_user, version()');
        console.log('🔍 Search Path:', res.rows[0].search_path);
        console.log('👤 DB User/Context:', contextRes.rows[0]);
        // Mask the URL for security but show enough to compare
        const dbUrl = poolConfig.connectionString;
        console.log('📦 DB Connection String:', dbUrl.replace(/:[^:@]+@/, ':****@'));

        // Force public path to be safe
        await client.query('SET search_path TO public');
        console.log('✅ Forced search_path to public');
    } catch (e) {
        console.error('Error logging DB details:', e);
    }
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL connection error:', err.message);
    // Don't crash the server - let individual queries fail instead
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
