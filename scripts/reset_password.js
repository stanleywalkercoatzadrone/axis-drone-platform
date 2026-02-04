
import { Client } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

import fs from 'fs';

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config({ path: envPath });
}

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function resetPassword() {
    try {
        await client.connect();

        const email = 'stanley.walker@coatzadroneusa.com';
        const newPassword = 'password123';

        console.log(`Resetting password for ${email}...`);

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        const res = await client.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id',
            [hash, email]
        );

        if (res.rows.length === 0) {
            console.log('❌ User not found!');
        } else {
            console.log(`✅ Password reset successfully to: ${newPassword}`);
        }

    } catch (err) {
        console.error('Error resetting password:', err);
    } finally {
        await client.end();
    }
}

resetPassword();
