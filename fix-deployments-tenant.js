#!/usr/bin/env node

// Add tenant_id to deployments table
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is required. Refusing to run against an implicit production database.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function addTenantIdColumn() {
    try {
        console.log('🔧 Adding tenant_id column to deployments table...');

        // Add tenant_id column if it doesn't exist
        await pool.query(`
            ALTER TABLE deployments 
            ADD COLUMN IF NOT EXISTS tenant_id UUID;
        `);

        console.log('✅ tenant_id column added to deployments');

        // Set tenant_id for existing rows (use first tenant from users table)
        const result = await pool.query(`
            UPDATE deployments 
            SET tenant_id = (SELECT tenant_id::uuid FROM users LIMIT 1)
            WHERE tenant_id IS NULL;
        `);

        console.log(`✅ Updated ${result.rowCount} existing deployment rows with tenant_id`);

        // Make it NOT NULL
        await pool.query(`
            ALTER TABLE deployments 
            ALTER COLUMN tenant_id SET NOT NULL;
        `);

        console.log('✅ tenant_id column set to NOT NULL');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

addTenantIdColumn();
