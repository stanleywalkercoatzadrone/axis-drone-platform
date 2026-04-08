import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { getAllPersonnel } from './backend/controllers/personnelController.js';

const mockReq = {
    user: { id: 'admin-123', role: 'ADMIN', tenantId: null },
    query: {}
};

function createRes(name) {
    return {
        status: (code) => {
            if (code >= 400) console.error(`[${name}] FAILED with STATUS ${code}`);
            return {
                json: (data) => console.log(`[${name}][${code}] ->`, data.message || 'Error', data.error || '')
            }
        },
        json: (data) => console.log(`[${name}][200] ->`, data.data ? `Success! Found ${data.data.length}` : 'Success')
    };
}

async function run() {
    console.log("Testing getAllPersonnel...");
    await import('./backend/config/database.js').then(async (dbModule) => {
        const db = dbModule.default;

        try {
            await getAllPersonnel(mockReq, createRes('getAllPersonnel'));
        } catch (e) {
            console.error("Crash in getAllPersonnel:", e.message);
            console.error(e.stack);
        }

        process.exit(0);
    });
}
run();
