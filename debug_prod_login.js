import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString,
});

async function debug() {
    try {
        await client.connect();
        console.log("Connected to DB");

        const email = "stanley.walker@coatzadroneusa.com";
        console.log(`Checking user: ${email}`);

        const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (res.rows.length === 0) {
            console.log("User NOT found!");
        } else {
            console.log("User found:", res.rows[0].email);
            console.log("Role:", res.rows[0].role);
            console.log("Password Hash length:", res.rows[0].password_hash ? res.rows[0].password_hash.length : 0);
        }

        console.log("Checking refresh_tokens table...");
        const tableRes = await client.query("SELECT to_regclass('public.refresh_tokens');");
        console.log("refresh_tokens exists:", tableRes.rows[0].to_regclass);

    } catch (err) {
        console.error("Database error:", err);
    } finally {
        await client.end();
    }
}

debug();
