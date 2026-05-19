import { query } from '../config/database.js';
async function run() {
  const r = await query('SELECT count(*) FROM protocols');
  console.log('Protocol count:', r.rows[0].count);
  process.exit(0);
}
run();
