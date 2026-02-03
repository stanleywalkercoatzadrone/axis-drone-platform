
import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = "postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:6543/postgres";

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function resetPassword() {
    const email = "stanley.walker@coatzadroneusa.com";
    const newPassword = "password123";

    console.log(`🔄 Resetting password for: ${email}`);

    try {
        await client.connect();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const res = await client.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email',
            [hashedPassword, email]
        );

        if (res.rowCount === 0) {
            console.error(`❌ User ${email} not found!`);
            // Create user if not exists? No, safer to just report.
        } else {
            console.log(`✅ Password updated for ${email} (ID: ${res.rows[0].id})`);
            console.log(`🔑 New Password: ${newPassword}`);
        }

    } catch (err) {
        console.error('❌ Error updating password:', err);
    } finally {
        await client.end();
    }
}

resetPassword();
