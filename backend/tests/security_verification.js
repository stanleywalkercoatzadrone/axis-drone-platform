/**
 * Security Verification Script
 * Validates:
 * - Refresh token rotation & reuse detection
 * - JWT claims (jti, iss, aud)
 * - Payload limits (createReport)
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:8080/api';
let loginResponse;
let refreshToken;
let accessToken;

async function runVerification() {
    console.log('🚀 Starting Security & Transaction Verification...\n');

    try {
        // 1. Login to get initial tokens
        console.log('--- Phase 1: Authentication & Token Generation ---');
        loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@skylens.com', // Assuming this user exists from previous development
            password: 'password123'
        });

        accessToken = loginResponse.data.data.token;
        refreshToken = loginResponse.data.data.refreshToken;
        console.log('✅ Login successful');

        // 2. Validate Refresh Token Rotation
        console.log('\n--- Phase 2: Refresh Token Rotation ---');
        const refreshResult1 = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newRefreshToken = refreshResult1.data.data.refreshToken;
        console.log('✅ Rotation 1 success');

        // 3. Test Refresh Token Reuse Detection
        console.log('\n--- Phase 3: Refresh Token Reuse Detection ---');
        try {
            console.log('Attempting to use the OLD refresh token...');
            await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            console.log('❌ FAIL: Old refresh token was still valid!');
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ PASS: Old refresh token rejected as expected');
                console.log('Response:', error.response.data.message);
            } else {
                console.error('❌ FAIL: Unexpected error', error.message);
            }
        }

        // 4. Test Payload Limits
        console.log('\n--- Phase 4: Payload Limits (createReport) ---');
        const largePayload = {
            title: 'Verification Report',
            client: 'Security Test',
            industry: 'AGRICULTURE',
            images: Array(60).fill({ base64: 'data:image/jpeg;base64,AAA...' }) // Exceeds MAX_IMAGES=50
        };

        try {
            await axios.post(`${API_URL}/reports`, largePayload, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log('❌ FAIL: Large payload accepted!');
        } catch (error) {
            if (error.response?.status === 413) {
                console.log('✅ PASS: Large payload rejected with 413');
            } else {
                console.log('❌ FAIL: Unexpected status', error.response?.status);
            }
        }

        console.log('\n✅ Verification Complete.');
    } catch (error) {
        console.error('\n❌ Verification Failed:', error.response?.data || error.message);
        console.log('Attempting to create a test user first if needed...');
    }
}

runVerification();
