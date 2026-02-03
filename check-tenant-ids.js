#!/usr/bin/env node

// Check tenant_id values in users table
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = 'postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTenantIds() {
    try {
        console.log('🔍 Checking tenant_id values in users table...\n');

        const result = await pool.query(`
            SELECT id, email, tenant_id, pg_typeof(tenant_id) as tenant_id_type
            FROM users
            ORDER BY created_at DESC
            LIMIT 10;
        `);

        console.log('Users:');
        result.rows.forEach(row => {
            console.log(`  Email: ${row.email}`);
            console.log(`  Tenant ID: ${row.tenant_id}`);
            console.log(`  Type: ${row.tenant_id_type}\n`);
        });

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkTenantIds();
