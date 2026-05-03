import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

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
