import dotenv from 'dotenv';
import pg from 'pg';
const { Client } = pg;

async function run() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is required.');
        process.exit(1);
    }
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("SELECT id, email, role, force_password_reset, invitation_expires_at, invitation_token_hash FROM users WHERE email='walkerst@me.com'");
        console.log("Users Table (stanley):", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
