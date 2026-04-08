#!/usr/bin/env node
/**
 * provision-tenant.js
 * Manually create a new SaaS tenant + admin user without going through the public signup page.
 * Use this to onboard your first customers before self-serve is live.
 *
 * Usage:
 *   node provision-tenant.js \
 *     --org "Acme Solar" \
 *     --slug "acme-solar" \
 *     --email "admin@acmesolar.com" \
 *     --name "Jane Smith" \
 *     --plan pro
 *
 * The script will prompt for a password securely, then create the tenant.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Parse CLI args
const args = process.argv.slice(2);
const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
};

const orgName  = get('--org');
const slug     = get('--slug');
const email    = get('--email');
const name     = get('--name');
const plan     = get('--plan') || 'starter';

if (!orgName || !slug || !email || !name) {
    console.error('Usage: node provision-tenant.js --org "Name" --slug "slug" --email "email" --name "Full Name" [--plan starter|pro|enterprise]');
    process.exit(1);
}

const PLAN_LIMITS = {
    starter:    { max_pilots: 3,  max_missions: 10,  ai_reports: false, white_label: false },
    pro:        { max_pilots: 15, max_missions: -1,  ai_reports: true,  white_label: false },
    enterprise: { max_pilots: -1, max_missions: -1,  ai_reports: true,  white_label: true  },
};

if (!PLAN_LIMITS[plan]) {
    console.error(`Invalid plan "${plan}". Choose: starter, pro, enterprise`);
    process.exit(1);
}

// Prompt for password
const rl = createInterface({ input: process.stdin, output: process.stdout });
const askPassword = () => new Promise(resolve => {
    process.stdout.write('Set admin password (min 8 chars): ');
    // Hide input
    process.stdin.setRawMode?.(true);
    let pwd = '';
    process.stdin.on('data', function handler(char) {
        char = char.toString();
        if (char === '\n' || char === '\r' || char === '\u0004') {
            process.stdin.setRawMode?.(false);
            process.stdin.removeListener('data', handler);
            process.stdout.write('\n');
            resolve(pwd);
        } else if (char === '\u007f') {
            pwd = pwd.slice(0, -1);
        } else {
            pwd += char;
        }
    });
});

async function run() {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    console.log(`\n📋 Provisioning tenant:`);
    console.log(`   Org:   ${orgName}`);
    console.log(`   Slug:  ${cleanSlug}`);
    console.log(`   Email: ${email}`);
    console.log(`   Name:  ${name}`);
    console.log(`   Plan:  ${plan}\n`);

    const password = await askPassword();
    rl.close();

    if (password.length < 8) {
        console.error('❌ Password must be at least 8 characters.');
        process.exit(1);
    }

    // Dynamic imports AFTER dotenv is loaded
    const { query } = await import('../config/database.js');
    const { hashPassword } = await import('../services/tokenService.js');

    const pwdHash = await hashPassword(password);

    // Create tenant
    const tenantRes = await query(
        `INSERT INTO tenants (name, slug, plan, owner_email, plan_limits)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET plan = EXCLUDED.plan
         RETURNING id, slug`,
        [orgName, cleanSlug, plan, email, JSON.stringify(PLAN_LIMITS[plan])]
    );
    const tenant = tenantRes.rows[0];
    console.log(`✅ Tenant created/updated: ${tenant.slug} (${tenant.id})`);

    // Create admin user
    await query(
        `INSERT INTO users (email, password_hash, full_name, role, tenant_id, company_name, permissions)
         VALUES ($1, $2, $3, 'admin', $4, $5, $6)
         ON CONFLICT (email) DO UPDATE
           SET tenant_id = EXCLUDED.tenant_id,
               company_name = EXCLUDED.company_name,
               password_hash = EXCLUDED.password_hash`,
        [email, pwdHash, name, cleanSlug, orgName, JSON.stringify(['admin:all'])]
    );
    console.log(`✅ Admin user created: ${email}`);
    console.log(`\n🎉 Done! ${email} can now log in to the Axis platform.\n`);

    process.exit(0);
}

run().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
