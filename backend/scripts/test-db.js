import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const testConnection = async () => {
    const connectionString = process.env.DATABASE_URL;

    console.log('🧪 Testing DB Connection...');
    console.log('📍 Connection String (masked):', connectionString?.replace(/:[^:@]+@/, ':****@'));

    if (!connectionString) {
        console.error('❌ DATABASE_URL is required');
        return;
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query('SELECT NOW(), current_user, current_database()');
        console.log('✅ Connected successfully!');
        console.log('   Time:', res.rows[0].now);
        console.log('   User:', res.rows[0].current_user);
        console.log('   DB:', res.rows[0].current_database);
        await client.end();
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        if (err.code === '28P01') {
            console.log('\n💡 Tip: "password authentication failed" means the password in .env.local is wrong or expired.');
            console.log('   Please check your Supabase dashboard > Project Settings > Database > Connection Pooling.');
        }
    }
};

testConnection();
