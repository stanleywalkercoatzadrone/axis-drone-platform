import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

async function findAdmin() {
    try {
        const res = await pool.query("SELECT email, role FROM users WHERE role = 'ADMIN' LIMIT 5");
        console.log('Admins:', res.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

findAdmin();
