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

const DEFAULT_CONNECTION_STRING = process.env.NODE_ENV === 'production'
    ? null
    : `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'skylens_db'}`;

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
    if (!DEFAULT_CONNECTION_STRING) {
        throw new Error('DATABASE_URL is required in production.');
    }
    poolConfig = {
        connectionString: DEFAULT_CONNECTION_STRING,
        ssl: DEFAULT_CONNECTION_STRING.includes('localhost') || DEFAULT_CONNECTION_STRING.includes('127.0.0.1') ? false : {
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
let _schemaMigrated = false;
pool.on('connect', async (client) => {
    console.log('✅ PostgreSQL connected');
    try {
        const res = await client.query('SHOW search_path');
        const contextRes = await client.query('SELECT current_database(), current_user, version()');
        console.log('🔍 Search Path:', res.rows[0].search_path);
        console.log('👤 DB User/Context:', contextRes.rows[0]);
        const dbUrl = poolConfig.connectionString || 'env-based';
        console.log('📦 DB Connection String:', dbUrl.replace(/:[^:@]+@/, ':****@'));

        // Force public path to be safe
        await client.query('SET search_path TO public');
        console.log('✅ Forced search_path to public');

        // Inline schema migration — runs once per process lifetime, safe to repeat
        if (!_schemaMigrated) {
            _schemaMigrated = true;
            try {
                await client.query(`
                    ALTER TABLE deployments
                        ADD COLUMN IF NOT EXISTS city  VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS state VARCHAR(100)
                `);
                // Backfill from location "City, State" text
                await client.query(`
                    UPDATE deployments
                    SET city  = TRIM(SPLIT_PART(location, ',', 1)),
                        state = TRIM(SPLIT_PART(location, ',', 2))
                    WHERE location IS NOT NULL
                      AND location LIKE '%,%'
                      AND city IS NULL
                `);
                console.log('✅ city/state columns ensured in deployments table');
                // Also ensure pilot_metrics has all required columns
                try {
                    await client.query(`
                        ALTER TABLE pilot_metrics
                            ADD COLUMN IF NOT EXISTS pilot_score INTEGER DEFAULT 0,
                            ADD COLUMN IF NOT EXISTS faults_detected INTEGER DEFAULT 0,
                            ADD COLUMN IF NOT EXISTS avg_completion_speed NUMERIC DEFAULT 0,
                            ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 5.0
                    `);
                    console.log('✅ pilot_metrics columns ensured');
                } catch (pmErr) {
                    console.warn('⚠️ pilot_metrics migration skipped:', pmErr.message);
                }

            } catch (migErr) {
                console.warn('⚠️  Inline schema migration skipped:', migErr.message);
            }
        }
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
