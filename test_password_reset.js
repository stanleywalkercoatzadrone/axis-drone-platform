// using native fetch

const BASE_URL = 'http://localhost:8080/api/auth';
const TEST_USER = {
    email: `test_reset_${Date.now()}@example.com`,
    password: 'password123',
    fullName: 'Test User',
    companyName: 'Test Corp'
};

async function testPasswordReset() {
    try {
        console.log('1. Registering user...');
        const registerRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });
        const registerData = await registerRes.json();

        if (!registerData.success) {
            throw new Error(`Registration failed: ${JSON.stringify(registerData)}`);
        }
        console.log('   User registered successfully.');
        const token = registerData.data.token;

        console.log('2. Updating password...');
        const NEW_PASSWORD = 'newpassword456';
        const updateRes = await fetch(`${BASE_URL}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword: TEST_USER.password,
                newPassword: NEW_PASSWORD
            })
        });
        const updateData = await updateRes.json();

        if (!updateData.success) {
            throw new Error(`Password update failed: ${JSON.stringify(updateData)}`);
        }
        console.log('   Password updated successfully.');

        console.log('3. Logging in with OLD password (should fail)...');
        const failLoginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: TEST_USER.email,
                password: TEST_USER.password
            })
        });

        if (failLoginRes.status !== 401) {
            throw new Error('Login with old password succeeded but should have failed.');
        }
        console.log('   Old password login failed as expected.');

        console.log('4. Logging in with NEW password...');
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: TEST_USER.email,
                password: NEW_PASSWORD
            })
        });
        const loginData = await loginRes.json();

        if (!loginData.success) {
            throw new Error(`Login with new password failed: ${JSON.stringify(loginData)}`);
        }
        console.log('   Login with new password successful!');
        console.log('*** TEST PASSED ***');

    } catch (error) {
        console.error('*** TEST FAILED ***');
        console.error(error);
        process.exit(1);
    }
}

testPasswordReset();
