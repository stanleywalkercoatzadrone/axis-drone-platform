import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

console.log('--- DB DIAGNOSIS ---');
console.log(`Loading env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.err('Failed to load .env.local');
} else {
    console.log('.env.local loaded.');
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('ERROR: DATABASE_URL is not set in environment!');
    process.exit(1);
}

// Censor password for logging
const censoredUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
console.log(`Using Connection String: ${censoredUrl}`);

// Parse connection string to debug parts
// We can use a regex or URL object to inspect the user/host
try {
    // Note: URL parsing might fail if it's not strictly valid URI, but postgres URLs usually are.
    // However, Node's URL might default to lowercasing protocol etc.
    // 'postgresql:' is treated as a protocol.
    const url = new URL(dbUrl);
    console.log(`Protocol: ${url.protocol}`);
    console.log(`User: ${url.username}`);
    console.log(`Host: ${url.hostname}`);
    console.log(`Port: ${url.port}`);
    console.log(`Path: ${url.pathname}`);
    // Password check (length only)
    console.log(`Password Length: ${url.password.length}`);
    console.log(`Password Encoded Chars: ${url.password.includes('%') ? 'YES' : 'NO'}`);
} catch (e) {
    console.log('Failed to parse URL object:', e.message);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
});

(async () => {
    try {
        console.log('Attempting connection...');
        const client = await pool.connect();
        console.log('✅ Connection SUCCESS!');

        const res = await client.query('SELECT NOW()');
        console.log('Query Result:', res.rows[0]);

        const userRes = await client.query('SELECT current_user');
        console.log('Current DB User:', userRes.rows[0]);

        client.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection FAILED');
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);
        if (err.code) console.error('Error Code:', err.code);
        if (err.detail) console.error('Error Detail:', err.detail);
        process.exit(1);
    }
})();
