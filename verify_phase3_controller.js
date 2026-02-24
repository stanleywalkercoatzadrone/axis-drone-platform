import { getCountries } from './backend/controllers/regionCountryController.js';
import { linkClientToDeployment } from './backend/controllers/deploymentController.js';

// Mock Express Objects
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

async function verify() {
    console.log('--- Verifying Phase 3 Backend Logic ---');

    // 1. Verify getCountries with status filtering
    console.log('\nTesting getCountries(status=ENABLED)...');
    const reqCountries = { query: { status: 'ENABLED' } };
    const resCountries = mockRes();

    try {
        await getCountries(reqCountries, resCountries);
        if (resCountries.data && resCountries.data.success) {
            const countries = resCountries.data.data;
            console.log(`✅ Fetched ${countries.length} enabled countries.`);
            const us = countries.find(c => c.iso_code === 'US');
            if (us) console.log('✅ Found US');
            const mx = countries.find(c => c.iso_code === 'MX');
            if (mx) console.log('✅ Found MX');
        } else {
            console.error('❌ Failed to fetch countries:', resCountries.data);
        }
    } catch (err) {
        console.error('❌ Error fetching countries:', err);
    }

    // 2. Verify linkClientToDeployment
    const deploymentId = 'd14b08ba-e152-4ed4-bf17-35aea309e3b9';
    const clientId = '066ab5a0-ef71-4801-b79c-d9788cca0d8f';

    console.log(`\nTesting linkClientToDeployment for Mission ${deploymentId} -> Client ${clientId}...`);

    const reqLink = {
        params: { id: deploymentId },
        body: { clientId }
    };
    const resLink = mockRes();

    try {
        await linkClientToDeployment(reqLink, resLink);
        if (resLink.data && resLink.data.success) {
            console.log('✅ Client linked successfully.');
            console.log('Response:', resLink.data);
        } else {
            console.error('❌ Failed to link client:', resLink.data);
        }
    } catch (err) {
        console.error('❌ Error linking client:', err);
    }

    process.exit(0);
}

verify();
