import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dir, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const sql = readFileSync(join(__dir, '030_seed_solar_clients.sql'), 'utf8');

const client = await pool.connect();
try {
  await client.query(sql);
  console.log('✅ Solar clients seeded successfully!');
  
  const count = await client.query("SELECT COUNT(*) FROM clients WHERE tenant_id = 'coatzadrone'");
  console.log('📊 Total solar clients in DB:', count.rows[0].count);
  
  const names = await client.query(
    "SELECT name, address->>'type' as type, address->>'city' as city, address->>'country' as country FROM clients WHERE tenant_id = 'coatzadrone' ORDER BY name"
  );
  names.rows.forEach(r => console.log(` ✓ ${r.name} — ${r.type} — ${r.city}, ${r.country}`));
} finally {
  client.release();
  await pool.end();
}
