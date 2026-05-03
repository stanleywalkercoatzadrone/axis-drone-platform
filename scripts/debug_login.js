
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function testLogin() {
    const email = "stanley.walker@coatzadroneusa.com";
    const password = process.env.DEBUG_LOGIN_PASSWORD;
    if (!password) throw new Error('DEBUG_LOGIN_PASSWORD is required.');

    console.log(`🧪 Testing Login for: ${email}`);

    try {
        await client.connect();

        // 1. Get User
        const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (res.rows.length === 0) {
            console.error('❌ User NOT FOUND in database.');
            process.exit(1);
        }

        const user = res.rows[0];
        console.log('✅ User Found:', user.id, user.role);

        // 2. Check Password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            console.error('❌ Password Verification FAILED.');
            console.log('⚠️  NOTE: The password in DB does not match "password123".');
            process.exit(1);
        }
        console.log('✅ Password Verified.');

        // 3. Check Tenant
        if (!user.tenant_id) {
            console.error('❌ User has NO tenant_id.');
        } else {
            console.log('✅ Tenant ID present:', user.tenant_id);
        }

        console.log('🎉 Login Logic should SUCCESS for this user.');

    } catch (err) {
        console.error('❌ Script Error:', err);
    } finally {
        await client.end();
    }
}

testLogin();
