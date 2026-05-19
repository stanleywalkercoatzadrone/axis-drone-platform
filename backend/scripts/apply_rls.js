import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/enable_rls.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Applying RLS policies...');
        await query(sql);
        console.log('RLS policies applied successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error applying RLS:', err);
        process.exit(1);
    }
}
run();
