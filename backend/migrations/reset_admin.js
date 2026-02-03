import bcrypt from 'bcryptjs';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

// Pool config (copied from database.js logic)
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'skylens_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(poolConfig);

async function resetAdmin() {
    try {
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('generated hash:', hashedPassword);

        const res = await pool.query(
            `UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email`,
            [hashedPassword, 'admin@coatzadroneusa.com']
        );

        if (res.rowCount > 0) {
            console.log('✅ Admin password reset successfully to: admin123');
        } else {
            console.log('⚠️ Admin user not found, inserting...');
            await pool.query(
                `INSERT INTO users (email, password_hash, full_name, company_name, role, permissions)
                 VALUES ($1, $2, 'System Administrator', 'CoatzadroneUSA', 'ADMIN', '["CREATE_REPORT", "MANAGE_USERS", "VIEW_MASTER_VAULT", "DELETE_REPORT", "APPROVE_REPORT", "MANAGE_SETTINGS"]'::jsonb)`,
                ['admin@coatzadroneusa.com', hashedPassword]
            );
            console.log('✅ Admin user created with password: admin123');
        }
    } catch (err) {
        console.error('❌ Error resetting password:', err);
    } finally {
        await pool.end();
    }
}

resetAdmin();
