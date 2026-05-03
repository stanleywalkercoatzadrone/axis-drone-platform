
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

async function resetPassword() {
    const email = "stanley.walker@coatzadroneusa.com";
    const newPassword = process.env.RESET_PASSWORD;
    if (!newPassword) throw new Error('RESET_PASSWORD is required.');

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
