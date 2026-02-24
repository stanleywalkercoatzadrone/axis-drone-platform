import pg from 'pg';
const { Client } = pg;

// Candidate password found in codebase
const password = "d9hn6m1radFKNmFY";
const user = "postgres.nkhiiwleyjsmvvdtkcud";
const host = "aws-1-us-east-1.pooler.supabase.com";
const port = 5432;
const database = "postgres";

const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;

console.log("Testing connection with candidate password from codebase...");

const client = new Client({
    connectionString,
});

async function debug() {
    try {
        await client.connect();
        console.log("✅ SUCCESS: Connected to DB with candidate password!");

        const email = "stanley.walker@coatzadroneusa.com";
        const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (res.rows.length === 0) {
            console.log("User NOT found!");
        } else {
            console.log("User found:", res.rows[0].email);
        }

    } catch (err) {
        console.error("❌ FAILED: Database error:", err.message);
    } finally {
        await client.end();
    }
}

debug();
