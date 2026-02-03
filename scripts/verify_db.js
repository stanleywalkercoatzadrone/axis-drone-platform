import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const config = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
};

const pool = new Pool(config);

async function verify() {
    console.log('Testing connection to:', process.env.DATABASE_URL?.split('@')[1] || 'URL not found');
    try {
        const start = Date.now();
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Connection successful!');
        console.log('Current time from DB:', res.rows[0].now);
        console.log('Query took:', Date.now() - start, 'ms');

        // Check for essential tables
        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'audit_logs', 'refresh_tokens', 'system_settings')
    `);

        console.log('✅ Found tables:', tables.rows.map(r => r.table_name).join(', '));

        if (tables.rows.length < 4) {
            console.warn('⚠️ Some expected tables might be missing!');
        }

    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verify();
