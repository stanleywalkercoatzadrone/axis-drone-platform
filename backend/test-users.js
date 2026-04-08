import dotenv from 'dotenv';
import pg from 'pg';
const { Client } = pg;

async function run() {
    const client = new Client({
        user: 'postgres.nkhiiwleyjsmvvdtkcud',
        password: decodeURIComponent('%21Qaz1976T%40ylor2008'),
        host: 'aws-1-us-east-1.pooler.supabase.com',
        port: 5432,
        database: 'postgres',
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
