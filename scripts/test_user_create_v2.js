import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const API_URL = 'http://localhost:8080/api';

async function testUserCreate() {
    try {
        console.log('--- Testing User Creation with fullName ---');

        // 1. Login as admin
        console.log('Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: process.env.ADMIN_EMAIL || 'stanley.walker@coatzadroneusa.com',
            password: process.env.ADMIN_PASSWORD || 'password123'
        });

        const token = loginRes.data.data.token;
        console.log('Login successful');

        // 2. Create user with fullName
        console.log('Creating user with fullName...');
        const createRes = await axios.post(`${API_URL}/users`, {
            email: `test_user_${Date.now()}@example.com`,
            password: 'password123',
            fullName: 'Test User FullName',
            role: 'FIELD_OPERATOR',
            companyName: 'Test Company'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Create result:', JSON.stringify(createRes.data, null, 2));

    } catch (error) {
        if (error.response) {
            console.error('Error Response:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testUserCreate();
