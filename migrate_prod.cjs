const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

async function run() {
    try {
        await client.connect();
        console.log("Connected to production DB via connection pool.");
        const res = await client.query("ALTER TABLE pilot_banking_info ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(10,2);");
        console.log("Migration successful", res);
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

run();
