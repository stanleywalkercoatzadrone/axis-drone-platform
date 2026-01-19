
import db from '../backend/config/database.js';

async function verifyMapping() {
    try {
        console.log('--- Verifying Personnel Mapping ---');
        const { getAllPersonnel } = await import('../backend/controllers/personnelController.js');

        // Mock req/res
        const req = { query: {} };
        const res = {
            json: (payload) => {
                console.log('Response data:', JSON.stringify(payload.data, null, 2));
                if (payload.data && payload.data.length > 0) {
                    const first = payload.data[0];
                    if (first.fullName && first.dailyPayRate !== undefined) {
                        console.log('✅ Mapping successful: camelCase fields found');
                    } else {
                        console.log('❌ Mapping failed: camelCase fields missing');
                    }
                } else {
                    console.log('ℹ️ No personnel data found in database');
                }
            },
            status: () => ({ json: () => { } })
        };

        // Note: This will attempt a real DB query. If the DB is down, it will fail.
        await getAllPersonnel(req, res);
    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        process.exit(0);
    }
}

verifyMapping();
