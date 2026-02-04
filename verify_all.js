
const BASE_URL = 'http://localhost:5000/api';
let adminToken = '';
let userToken = '';

async function request(url, method, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(`Request failed: ${res.status}`);
        error.response = { status: res.status, data };
        throw error;
    }
    return data;
}

async function runStep(name, fn) {
    console.log(`\n--- STEP ${name} ---`);
    try {
        await fn();
        console.log(`[PASS] ${name}`);
    } catch (error) {
        console.error(`[FAIL] ${name}: ${error.message}`);
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data);
        }
    }
}

async function start() {
    console.log('Starting Final Verification Suite (Zero Dep)...');

    await runStep('1. AUTHENTICATION', async () => {
        // 1. Register Admin
        const adminEmail = `admin_test_${Date.now()}@axis.ai`;
        try {
            const data = await request(`${BASE_URL}/auth/register`, 'POST', {
                email: adminEmail,
                password: 'password123',
                fullName: 'Test Admin',
                companyName: 'Axis',
                role: 'ADMIN',
                adminSecret: 'SKYLENS-ADMIN-2025'
            });
            adminToken = data.data.token;
            console.log('Admin Registered');
        } catch (e) {
            throw new Error('Admin Registration Failed: ' + e.message);
        }

        // 2. Register User
        const userEmail = `user_test_${Date.now()}@axis.ai`;
        try {
            const data = await request(`${BASE_URL}/auth/register`, 'POST', {
                email: userEmail,
                password: 'password123',
                fullName: 'Test User',
                companyName: 'Axis Legacy',
                role: 'FIELD_OPERATOR'
            });
            userToken = data.data.token;
            console.log('User Registered');
        } catch (e) {
            throw new Error('User Registration Failed: ' + e.message);
        }

        // 3. Invalid Admin Secret
        try {
            await request(`${BASE_URL}/auth/register`, 'POST', {
                email: `hacker_${Date.now()}@test.com`,
                password: 'password123',
                fullName: 'Fake Admin',
                role: 'ADMIN',
                adminSecret: 'WRONG_SECRET'
            });
            throw new Error('Managed to register ADMIN with wrong secret (Should have failed)');
        } catch (e) {
            if (e.response && e.response.status === 403) {
                console.log('Invalid Admin Secret blocked correctly (403)');
            } else {
                throw e;
            }
        }
    });

    await runStep('3. RBAC BYPASS', async () => {
        // User tries to get Users list (Admin only)
        try {
            await request(`${BASE_URL}/users`, 'GET', null, userToken);
            throw new Error('User accessed /users (Should be blocked)');
        } catch (e) {
            if (e.response && e.response.status === 403) {
                console.log('User blocked from /users correctly');
            } else {
                throw e;
            }
        }
    });

    await runStep('4. REPORT LIFECYCLE', async () => {
        // 1. User creates report
        let reportId;
        try {
            const data = await request(`${BASE_URL}/reports`, 'POST', {
                title: 'Lifecycle Test',
                client: 'Test Client',
                industry: 'SOLAR'
            }, userToken);
            reportId = data.data.id;
        } catch (e) {
            throw new Error('Report creation failed: ' + e.message);
        }

        // 2. User tries to APPROVE (Should fail)
        try {
            await request(`${BASE_URL}/reports/${reportId}`, 'PUT', {
                status: 'APPROVED'
            }, userToken);
            throw new Error('User was able to APPROVE report (Should be blocked)');
        } catch (e) {
            if (e.response && e.response.status === 403) {
                console.log('User blocked from APPROVING report correctly');
            } else {
                throw e;
            }
        }

        // 3. Admin APPROVES (Should pass)
        try {
            await request(`${BASE_URL}/reports/${reportId}`, 'PUT', {
                status: 'APPROVED'
            }, adminToken);
            console.log('Admin Approved report');
        } catch (e) {
            throw new Error('Admin failed to approve: ' + e.message);
        }

        // 4. Admin Finalizes
        try {
            await request(`${BASE_URL}/reports/${reportId}/finalize`, 'POST', {}, adminToken);
            console.log('Admin Finalized report');
        } catch (e) {
            throw new Error('Admin failed to finalize: ' + e.message);
        }
    });
}

start();
