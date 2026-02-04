import { query, transaction } from '../backend/config/database.js';

const run = async () => {
    console.log('🧪 Starting DB Transaction Diagnostics...');

    // 1. Test Simple Query (Baseline)
    try {
        console.log('1️⃣  Testing Simple pool.query()...');
        const res = await query('SELECT NOW() as now');
        console.log('✅ Simple Query Success:', res.rows[0].now);
    } catch (err) {
        console.error('❌ Simple Query Failed:', err);
        process.exit(1);
    }

    // 2. Test Transaction (The Suspect)
    try {
        console.log('\n2️⃣  Testing transaction() wrapper...');
        await transaction(async (client) => {
            console.log('   Inside transaction callback...');
            // Test Parameterized Query
            const res = await client.query('SELECT $1::text as echo', ['Hello PGBouncer']);
            console.log('   Query result:', res.rows[0].echo);
            return res;
        });
        console.log('✅ Transaction Success!');
    } catch (err) {
        console.error('❌ Transaction Failed!');
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);
        console.error('Full Error:', err);
    }

    process.exit(0);
};

run();
