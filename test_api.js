import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { getAllPersonnel, getPersonnelById } from './backend/controllers/personnelController.js';

// Mock express req/res
const res = {
    status: (code) => ({
        json: (data) => console.log(`[${code}] response:`, data)
    }),
    json: (data) => console.log('[200] response:', data.data?.length, 'items or', data.data?.id)
};

async function run() {
    console.log("Testing getAllPersonnel...");
    await getAllPersonnel({ user: { tenantId: null }, query: {} }, res);

    // Get an ID to test
    console.log("\nTesting getPersonnelById...");
    import('./backend/config/database.js').then(async (dbModule) => {
        const db = dbModule.default;
        const result = await db.query('SELECT id FROM personnel LIMIT 1');
        if (result.rows.length > 0) {
            const id = result.rows[0].id;
            console.log("Fetching ID:", id);
            await getPersonnelById({ user: { tenantId: null }, params: { id } }, res);
        } else {
            console.log("No personnel found to test ID fetch.");
        }
        process.exit(0);
    });
}

run();
