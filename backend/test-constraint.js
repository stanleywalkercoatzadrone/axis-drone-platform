import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = async () => {
    dotenv.config({ path: '../../.env.local' });
    let connectionString = process.env.DATABASE_URL.replace('6543', '5432');
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const res = await client.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class rel ON rel.oid = c.conrelid WHERE rel.relname = 'users';");
    console.log(res.rows);
    await client.end();
};
run().catch(console.error);
