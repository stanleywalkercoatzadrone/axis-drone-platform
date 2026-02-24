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
            ssl: (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || process.env.NODE_ENV === 'development')
                ? false
                : {
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

const sharedPoolOptions = {
    max: 5,                          // Small pool for dev — prevents exhaustion
    min: 1,                          // Keep at least 1 connection warm
    idleTimeoutMillis: 10000,        // Recycle idle connections quickly
    connectionTimeoutMillis: 5000,   // Fail fast if can't get connection
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    statement_timeout: 30000,        // Kill any query that runs > 30s
};

if (process.env.DATABASE_URL) {
    poolConfig = {
        ...parseConnectionString(process.env.DATABASE_URL),
        ...sharedPoolOptions,
    };
} else {
    poolConfig = {
        connectionString: DEFAULT_CONNECTION_STRING,
        ssl: (process.env.NODE_ENV === 'development') ? false : {
            rejectUnauthorized: false,
            require: true
        },
        ...sharedPoolOptions,
    };
}



const pool = new Pool(poolConfig);

// Don't test connection immediately - let it happen lazily on first query
// This prevents blocking the container startup if DB is slow/unreachable
pool.on('connect', () => {
    console.log('✅ PostgreSQL connected');
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
