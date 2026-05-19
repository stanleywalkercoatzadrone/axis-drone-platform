import fs from 'fs';
import db from './backend/config/database.js';

async function run() {
  try {
    const sql = fs.readFileSync('./backend/migrations/012_construction_finalization.sql', 'utf8');
    await db.query(sql);
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
