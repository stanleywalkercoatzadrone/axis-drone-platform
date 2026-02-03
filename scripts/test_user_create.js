
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extract .env.local values manually to avoid dotenv dependency issues if not installed
function getEnv(key) {
    try {
        const envPath = path.join(__dirname, '../.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim().replace(/^['"](.*)['"]$/, '$1') : null;
    } catch (e) {
        return null;
    }
}

const API_URL = 'http://localhost:8080/api';
// We need real credentials from the DB or a way to bypass
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';

async function testUserCreation() {
    try {
        console.log('Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        if (!loginRes.data.success) {
            console.error('Login failed:', loginRes.data);
            return;
        }

        const token = loginRes.data.data.token;
        console.log('Login successful. Token obtained.');

        console.log('Attempting to create user with fullName...');
        const createRes = await axios.post(`${API_URL}/users`, {
            fullName: 'Test User API',
            email: `test_api_${Date.now()}@example.com`,
            password: 'password123',
            role: 'FIELD_OPERATOR',
            title: 'API Test'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Create Response:', JSON.stringify(createRes.data, null, 2));

        if (createRes.data.success) {
            console.log('✅ User created successfully with fullName!');
        } else {
            console.log('❌ User creation failed!');
        }

    } catch (error) {
        if (error.response) {
            console.error('❌ API Error:', error.response.status, error.response.data);
        } else {
            console.error('❌ Network Error:', error.message);
        }
    }
}

testUserCreation();
