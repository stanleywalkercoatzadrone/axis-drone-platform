import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { getDeployments } from './backend/controllers/deploymentController.js';
import { getUsers } from './backend/controllers/userController.js';
import { getClients } from './backend/controllers/clientController.js';
import { getRegionCountries } from './backend/controllers/regionCountryController.js';

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
        json: (data) => console.log(`[${name}][200] ->`, data.data ? `Success! Found ${Array.isArray(data.data) ? data.data.length : 'data'}` : 'Success')
    };
}

async function run() {
    console.log("Testing remaining Personnel UI Endpoints...");
    await import('./backend/config/database.js').then(async (dbModule) => {
        const db = dbModule.default;

        try {
            console.log("--- getDeployments ---");
            await getDeployments(mockReq, createRes('getDeployments'));
        } catch (e) { console.error("Crash in getDeployments:", e.message); }

        try {
            console.log("--- getUsers ---");
            await getUsers(mockReq, createRes('getUsers'));
        } catch (e) { console.error("Crash in getUsers:", e.message); }

        try {
            console.log("--- getClients ---");
            await getClients(mockReq, createRes('getClients'));
        } catch (e) { console.error("Crash in getClients:", e.message); }

        try {
            console.log("--- getRegionCountries ---");
            await getRegionCountries({ ...mockReq, query: { status: 'ENABLED' } }, createRes('getRegionCountries'));
        } catch (e) { console.error("Crash in getRegionCountries:", e.message); }

        // I need to use db directly for sites since there's no siteController exported properly or it's named differently
        try {
            console.log("--- getSites raw query ---");
            const sites = await db.query('SELECT * FROM sites');
            console.log("[getSites] Success! Found", sites.rows.length);
        } catch (e) { console.error("Crash in getSites:", e.message); }

        process.exit(0);
    });
}
run();
