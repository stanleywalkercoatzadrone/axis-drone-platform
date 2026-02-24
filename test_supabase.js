import pkg from 'pg';
const { Client } = pkg;
const connectionString = 'postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function test() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to Supabase');
        const res = await client.query('SELECT count(*) FROM invoices');
        console.log('Invoices count:', res.rows[0].count);
        const pRes = await client.query('SELECT count(*) FROM personnel');
        console.log('Personnel count:', pRes.rows[0].count);
        await client.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
}

test();
