import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { getPersonnelDocuments } from './backend/controllers/personnelController.js';

// Mock express req/res
const res = {
    status: (code) => {
        console.log(`[STATUS ${code}]`);
        return {
            json: (data) => console.log(`[${code}] response:`, data)
        }
    },
    json: (data) => console.log('[200] response:', data.data?.length, 'items or', data.data?.id)
};

async function run() {
    console.log("Testing getPersonnelDocuments...");
    import('./backend/config/database.js').then(async (dbModule) => {
        const db = dbModule.default;
        const result = await db.query('SELECT id FROM personnel LIMIT 1');
        if (result.rows.length > 0) {
            const id = result.rows[0].id;
            console.log("Fetching documents for ID:", id);
            // Mock req.user properly
            const req = {
                params: { id },
                user: { id: 'admin-123', role: 'ADMIN' }
            };

            try {
                await getPersonnelDocuments(req, res);
            } catch (e) {
                console.error("Caught exception:", e);
            }
        } else {
            console.log("No personnel found to test ID fetch.");
        }
        process.exit(0);
    });
}

run();
