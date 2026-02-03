import { createUser } from './backend/controllers/userController.js';
import { query } from './backend/config/database.js';

// Mock request and response
const req = {
    body: {
        email: `test_user_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        fullName: 'Test User',
        role: 'FIELD_OPERATOR'
    },
    user: {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'admin@test.com',
        tenantId: 'default'
    }
};

const res = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        this.data = data;
        console.log('Response:', JSON.stringify(data, null, 2));
    }
};

const next = (error) => {
    if (error) {
        console.error('Next called with error:', error);
    }
};

async function runTest() {
    console.log('--- Starting User Creation Test ---');
    try {
        await createUser(req, res, next);

        // Brief delay to allow async email to log
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('--- Test Completed ---');
    } catch (err) {
        console.error('Test failed:', err);
    }
}

runTest();
