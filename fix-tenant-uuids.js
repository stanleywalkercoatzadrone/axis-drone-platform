#!/usr/bin/env node

// Fix tenant_id column type and generate proper UUIDs
import pkg from 'pg';
import { randomUUID } from 'crypto';
const { Pool } = pkg;

const DATABASE_URL = 'postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixTenantIds() {
    try {
        console.log('🔧 Fixing tenant_id columns...\n');

        // Step 1: Generate a UUID for each user
        const users = await pool.query('SELECT id, email, tenant_id FROM users');

        for (const user of users.rows) {
            const newTenantId = randomUUID();
            console.log(`Updating user ${user.email}: ${user.tenant_id} -> ${newTenantId}`);

            await pool.query(
                'UPDATE users SET tenant_id = $1 WHERE id = $2',
                [newTenantId, user.id]
            );
        }

        console.log('\n✅ All users updated with UUID tenant_ids');

        // Step 2: Drop default values
        console.log('\n🔧 Dropping default values...');

        await pool.query(`ALTER TABLE users ALTER COLUMN tenant_id DROP DEFAULT;`);
        await pool.query(`ALTER TABLE deployments ALTER COLUMN tenant_id DROP DEFAULT;`);

        console.log('✅ Default values dropped');

        // Step 3: Change column type to UUID
        console.log('\n🔧 Converting tenant_id column to UUID type...');

        await pool.query(`
            ALTER TABLE users 
            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
        `);

        console.log('✅ users.tenant_id converted to UUID');

        await pool.query(`
            ALTER TABLE deployments 
            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
        `);

        console.log('✅ deployments.tenant_id converted to UUID');

        console.log('\n✅ All tenant_id columns fixed!');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        await pool.end();
        process.exit(1);
    }
}

fixTenantIds();
