import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to database...");
        await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;');
        console.log("Dropped valid_role constraint from users table.");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}
run();
