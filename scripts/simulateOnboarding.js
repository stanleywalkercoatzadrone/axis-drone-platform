import db from '../backend/config/database.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:8080/api';
const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000'; // Replace if needed

async function runSimulation() {
    const client = await db.connect();
    try {
        console.log('--- Starting Onboarding Simulation ---');

        // 1. Create a Test Personnel (Empty Fields)
        console.log('1. Creating Test Personnel...');
        const uniqueEmail = `test.pilot.${Date.now()}@skylens.ai`;
        const personnelRes = await client.query(
            `INSERT INTO personnel (full_name, role, email, status, onboarding_status, tenant_id)
             VALUES ($1, 'Pilot', $2, 'Inactive', 'in_progress', $3)
             RETURNING id, full_name, email`,
            ['Simulation Pilot', uniqueEmail, SYSTEM_TENANT_ID]
        );
        const pilot = personnelRes.rows[0];
        console.log('   > Created Pilot:', pilot.id);

        // 2. Create Onboarding Package (Manual DB insert to skip auth/email service deps)
        console.log('2. Creating Onboarding Package...');
        const token = uuidv4();
        const pkgRes = await client.query(
            `INSERT INTO onboarding_packages (personnel_id, tenant_id, access_token, status, expires_at)
             VALUES ($1, $2, $3, 'sent', NOW() + INTERVAL '24 hours')
             RETURNING id`,
            [pilot.id, SYSTEM_TENANT_ID, token]
        );
        console.log('   > Package Created. Token:', token);

        // 3. Simulate "Complete" Request
        console.log('3. Submitting Onboarding Data...');
        const payload = {
            personalInfo: {
                phone: '555-0199',
                address: '123 Drone Way, Austin, TX'
            },
            bankingInfo: {
                bankName: 'Chase',
                accountNumber: '123456789',
                routingNumber: '021000021',
                accountType: 'Checking',
                currency: 'USD',
                countryId: null
            },
            documents: [
                {
                    type: 'Pilot License',
                    fileUrl: 'https://storage.googleapis.com/test-bucket/license.pdf',
                    expirationDate: '2030-01-01'
                }
            ]
        };

        try {
            const response = await axios.post(`${API_URL}/onboarding/portal/${token}/complete`, payload);
            console.log('   > Response:', response.data.message);
        } catch (err) {
            console.error('   > API Error:', err.response ? err.response.data : err.message);
            throw err;
        }

        // 4. Verify Data in DB
        console.log('4. Verifying Data...');

        // Check Personnel Updates
        const pCheck = await client.query('SELECT phone, home_address, onboarding_status FROM personnel WHERE id = $1', [pilot.id]);
        console.log('   > Personnel Updated:', pCheck.rows[0]);

        // Check Banking
        const bCheck = await client.query('SELECT * FROM pilot_banking_info WHERE pilot_id = $1', [pilot.id]);
        console.log('   > Banking Info Created:', bCheck.rows.length > 0 ? 'YES' : 'NO');
        if (bCheck.rows.length > 0) console.log('     -', bCheck.rows[0].bank_name, bCheck.rows[0].routing_number);

        // Check Documents
        const dCheck = await client.query('SELECT * FROM pilot_documents WHERE pilot_id = $1', [pilot.id]);
        console.log('   > Documents Linked:', dCheck.rows.length);
        if (dCheck.rows.length > 0) console.log('     -', dCheck.rows[0].document_type, dCheck.rows[0].file_url);

    } catch (error) {
        console.error('Simulation Failed:', error);
    } finally {
        client.release();
        // Cleanup?
        // await client.end(); // If using pool, normally don't close.
        console.log('--- Simulation End ---');
        process.exit();
    }
}

runSimulation();
