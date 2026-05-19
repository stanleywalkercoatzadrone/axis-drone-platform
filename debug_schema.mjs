import pg from 'pg';

const connectionString = "postgresql://postgres.nkhiiwleyjsmvvdtkcud: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@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function debugSchema() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'construction_phases';
    `);
    console.log("Columns in construction_phases:", res.rows);
    
    if (res.rows.length === 0) {
      console.log("Table 'construction_phases' does not exist! Running 005 migration manually...");
      const fs = await import('fs');
      const sql = fs.readFileSync('backend/migrations/005_add_construction_monitoring.sql', 'utf8');
      await client.query(sql);
      console.log("Migration 005 applied!");
    } else {
      const hasName = res.rows.some(r => r.column_name === 'name');
      if (!hasName) {
        console.log("Missing 'name' column. Adding it now...");
        await client.query(`ALTER TABLE construction_phases ADD COLUMN name VARCHAR(255)`);
        await client.query(`ALTER TABLE construction_phases ADD COLUMN description TEXT`);
        await client.query(`ALTER TABLE construction_phases ADD COLUMN order_index INTEGER DEFAULT 0`);
        console.log("Columns added!");
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

debugSchema();
