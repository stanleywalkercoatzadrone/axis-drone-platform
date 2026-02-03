
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

// Hardcoded connection string for safety in this environment
const connectionString = "postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:6543/postgres";

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function testLogin() {
    const email = "stanley.walker@coatzadroneusa.com";
    const password = "password123";

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
