const { Client } = require('pg');

const client = new Client({
    connectionString: "postgresql://postgres.nkhiiwleyjsmvvdtkcud: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@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
});

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
