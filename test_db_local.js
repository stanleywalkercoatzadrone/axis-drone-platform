import pkg from 'pg';
const { Pool } = pkg;

// Local Docker connection string based on docker-compose.yml
const connectionString = "postgresql://postgres:postgres@localhost:5432/skylens_db";

const pool = new Pool({
    connectionString
});

async function test() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Local Direct Connection successful:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('❌ Local Direct Connection failed:', err);
        process.exit(1);
    }
}

test();
