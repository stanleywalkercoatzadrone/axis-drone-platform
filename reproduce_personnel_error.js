import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend/config/.env') }); // Adjust path if needed

const API_URL = 'http://localhost:8080/api';
// Use the known admin credentials
const EMAIL = 'stanley.walker@coatzadroneusa.com';
const PASSWORD = 'password123';

async function testPersonnelCreation() {
    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });

        const token = loginRes.data.token;
        console.log('Login successful. Token:', token ? 'Found' : 'Missing');

        console.log('2. Creating Personnel...');
        const newPersonnel = {
            fullName: 'Test Pilot',
            role: 'Pilot',
            email: `testpilot_${Date.now()}@example.com`,
            phone: '555-0100',
            dailyPayRate: 150,
            status: 'Active'
        };

        const createRes = await axios.post(`${API_URL}/personnel`, newPersonnel, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Personnel created:', createRes.data);

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        if (error.response?.status === 500) {
            console.log('Reproduction successful: Got 500 Error');
        }
    }
}

testPersonnelCreation();
