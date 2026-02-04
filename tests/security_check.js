import axios from 'axios';
import { runEnterpriseMigration } from '../backend/migrations/run_enterprise.js';

const BASE_URL = 'http://localhost:8080/api';
let AUTH_TOKEN = '';
let REFRESH_TOKEN = '';
let USER_ID = '';

// Helper to log steps
const log = (msg, type = 'INFO') => console.log(`[${type}] ${msg}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function login() {
    try {
        log('Attempting to REGISTER a temporary admin for testing...');
        const email = `test_admin_${Date.now()}@example.com`;
        const password = 'testpassword123';

        try {
            await axios.post(`${BASE_URL}/auth/register`, {
                email,
                password,
                fullName: 'Security Test Bot',
                companyName: 'Test Corp',
                role: 'ADMIN',
                adminSecret: 'SKYLENS-ADMIN-2025'
            });
            log('Registration successful.');
        } catch (regErr) {
            // It's okay if registration fails (maybe user exists), we'll try login
            log(`Registration skipped/failed (${regErr.response?.data?.message || regErr.message}). Trying login...`);
        }

        log(`Logging in as ${email}...`);
        const res = await axios.post(`${BASE_URL}/auth/login`, {
            email,
            password
        });

        if (res.data.success) {
            AUTH_TOKEN = res.data.data.token;
            REFRESH_TOKEN = res.data.data.refreshToken;
            USER_ID = res.data.data.user.id;
            log('Login successful. Tokens acquired.');
            return res.data.data;
        }
    } catch (err) {
        log(`Login failed: ${err.message}`, 'ERROR');
        if (err.code) log(`Code: ${err.code}`, 'ERROR');
        if (err.response) log(`Response: ${JSON.stringify(err.response.data)}`, 'ERROR');
        process.exit(1);
    }
}

async function testDoubleRefresh() {
    log('\n--- TEST 1: Double Refresh Concurrency ---');
    // Get a fresh pair first
    const loginData = await login();
    const rt = loginData.refreshToken;

    log('Sending two concurrent refresh requests with the SAME token...');
    const p1 = axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken: rt });
    const p2 = axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken: rt });

    const results = await Promise.allSettled([p1, p2]);

    const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
    const failures = results.filter(r => r.status === 'rejected');

    // We expect exactly ONE success and ONE failure (or two failures if race is very tight and both see used status)
    // But ideally one wins.
    log(`Successes: ${successes.length}, Failures: ${failures.length}`);

    if (successes.length === 1 && failures.length === 1) {
        // Check failure reason
        const err = failures[0].reason;
        if (err.response && err.response.status === 401) {
            const msg = err.response.data.message || '';
            if (msg.includes('reuse detected')) {
                log('PASS: One succeeded, one failed with Reuse Detection (as expected for strict one-time use).', 'SUCCESS');
            } else {
                log(`PASS: One succeeded, one failed with ${err.response.status}`, 'SUCCESS');
            }
        } else {
            log(`WARN: One failed but not 401? Status: ${err.response?.status}`, 'WARN');
        }
    } else if (successes.length === 2) {
        log('FAIL: Both refresh requests succeeded! (Race condition not handled)', 'FAIL');
    } else {
        log('WARN: Both failed or unexpected outcome.', 'WARN');
        failures.forEach((f, i) => {
            log(`Failure ${i + 1}: ${f.reason.message}`, 'ERROR');
            if (f.reason.response) log(`Response ${i + 1}: ${JSON.stringify(f.reason.response.data)}`, 'ERROR');
        });
    }
}

async function testRefreshTokenReuse() {
    log('\n--- TEST 2: Refresh Token Reuse & Revocation ---');
    // 1. Login to get RT1
    const data1 = await login();
    const rt1 = data1.refreshToken;

    // 2. Refresh RT1 -> get RT2 (valid usage)
    log('Using RT1 to get RT2...');
    let rt2;
    try {
        const res = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken: rt1 });
        rt2 = res.data.data.refreshToken;
        log('RT1 consumed, RT2 obtained.');
    } catch (err) {
        log(`Failed initial refresh (unexpected): ${err.message}`, 'ERROR');
        if (err.response) log(`Response: ${JSON.stringify(err.response.data)}`, 'ERROR');
        return;
    }

    // 3. Try access with RT2 (should work, or just verify it exists)
    // We'll skip access check and go straight to reuse attack

    // 4. ATTACK: Use RT1 again
    log('ATTACK: Reusing RT1...');
    try {
        await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken: rt1 });
        log('FAIL: Reuse of RT1 Succeeded! Security Breach.', 'FAIL');
    } catch (err) {
        if (err.response && err.response.status === 401) {
            log('PASS: Reuse of RT1 failed with 401.', 'SUCCESS');
            const msg = err.response.data.error?.message || err.response.data.message || '';
            if (msg.includes('reuse detected')) {
                log('PASS: Exact error message confirms reuse detection logic.', 'SUCCESS');
            }
        } else {
            log(`WARN: Reuse failed but with unexpected status: ${err.response?.status}`, 'WARN');
        }
    }

    // 5. Verify RT2 is now revoked (Family Revocation)
    log('Verifying RT2 is now revoked (Family Revocation)...');
    try {
        await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken: rt2 });
        log('FAIL: RT2 still works! Family revocation failed.', 'FAIL');
    } catch (err) {
        if (err.response && err.response.status === 401) {
            const msg = err.response.data.error?.message || err.response.data.message || '';
            if (msg.includes('reuse detected') || msg.includes('revoked')) {
                log('PASS: RT2 revoked successfully.', 'SUCCESS');
            } else {
                log(`PASS: RT2 failed with 401 (${msg})`, 'SUCCESS');
            }
        } else {
            log(`WARN: RT2 failed with unexpected status: ${err.response?.status}`, 'WARN');
        }
    }
}

async function testFinalizeConflict() {
    log('\n--- TEST 3: Finalize Conflict (409) ---');
    // 1. Create a DRAFT report
    await login(); // Ensure headers
    const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };
    let reportId;

    try {
        const res = await axios.post(`${BASE_URL}/reports`, {
            title: 'Conflict Test Report',
            client: 'Test Corp',
            industry: 'Solar',
            status: 'REVIEW' // Must be REVIEW or APPROVED to finalize
        }, { headers });
        reportId = res.data.data.id;
        log(`Created report ${reportId} in REVIEW status.`);
    } catch (err) {
        log(`Failed to create report: ${err.message}`, 'ERROR');
        if (err.response) log(`Response: ${JSON.stringify(err.response.data)}`, 'ERROR');
        return;
    }

    // 2. Send two finalize requests concurrently
    log('Sending two concurrent FINALIZE requests...');
    const p1 = axios.post(`${BASE_URL}/reports/${reportId}/finalize`, {}, { headers });
    const p2 = axios.post(`${BASE_URL}/reports/${reportId}/finalize`, {}, { headers });

    const results = await Promise.allSettled([p1, p2]);

    const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
    const conflicts = results.filter(r => r.status === 'rejected' && r.reason.response?.status === 409);

    log(`Successes: ${successes.length}, Conflicts (409): ${conflicts.length}`);

    if (successes.length === 1 && conflicts.length === 1) {
        log('PASS: Exact Behavior! One success, one 409 Conflict.', 'SUCCESS');
    } else if (successes.length === 2) {
        log('FAIL: Double Finalization! Both requests succeeded (Bad!)', 'FAIL');
    } else {
        log(`WARN: Unexpected result: ${results.map(r => r.status == 'rejected' ? r.reason.response?.status : 200).join(', ')}`, 'WARN');
    }
}

async function run() {
    log('Starting Security Verification...');

    try {
        log('🛠️  Skipping Auto-Migration (Already Applied)...');
        // await runEnterpriseMigration();
        log('✅ Database Schema Check Skipped');
    } catch (err) {
        log(`WARN: Migration auto-run failed: ${err.message}`, 'WARN');
    }

    await testDoubleRefresh();
    await testRefreshTokenReuse();
    await testFinalizeConflict();
    log('\nVerification Complete.');
}

run();
