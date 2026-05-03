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
        console.log('Connected to Supabase (Port 6543)');
        const res = await client.query('SELECT count(*) FROM users');
        console.log('Users count:', res.rows[0].count);
        const cRes = await client.query('SELECT count(*) FROM clients');
        console.log('Clients count:', cRes.rows[0].count);
        const users = await client.query('SELECT email FROM users WHERE email LIKE \'%stanley%\'');
        console.log('Stanley check:', users.rows);
        await client.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

test();
