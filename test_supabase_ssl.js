import pkg from 'pg';
const { Client } = pkg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

async function test() {
    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });
    try {
        await client.connect();
        console.log('Connected to Supabase (Default Password)');
        const res = await client.query('SELECT count(*) FROM invoices');
        console.log('Invoices count:', res.rows[0].count);
        const pRes = await client.query('SELECT count(*) FROM personnel');
        console.log('Personnel count:', pRes.rows[0].count);
        const cRes = await client.query('SELECT count(*) FROM clients');
        console.log('Clients count:', cRes.rows[0].count);
        await client.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

test();
