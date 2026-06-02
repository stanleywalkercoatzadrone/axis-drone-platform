import pg from 'pg';

const pool = new pg.Pool({
  connectionString: "postgresql://postgres.nkhiiwleyjsmvvdtkcud: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@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
});

async function run() {
  try {
    const resUsers = await pool.query("SELECT id, email, role, full_name FROM users;");
    console.log("=== USERS ===");
    console.log(JSON.stringify(resUsers.rows, null, 2));

    const resPersonnel = await pool.query("SELECT id, email, full_name, role FROM personnel;");
    console.log("=== PERSONNEL ===");
    console.log(JSON.stringify(resPersonnel.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
