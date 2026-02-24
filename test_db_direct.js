import pkg from 'pg';
const { Pool } = pkg;

const connectionString = "postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function test() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Direct Connection successful:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('❌ Direct Connection failed:', err);
        process.exit(1);
    }
}

test();
