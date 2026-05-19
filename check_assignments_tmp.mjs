import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: 'postgresql://postgres.nkhiiwleyjsmvvdtkcud:d9hn6m1radFKNmFY@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        // 1. Check users and their roles
        const users = await pool.query(`SELECT email, role, tenant_id FROM users ORDER BY created_at DESC LIMIT 10`);
        console.log('\n=== USERS ===');
        users.rows.forEach(r => console.log(`  ${r.email} | role=${r.role} | tenant=${r.tenant_id}`));

        // 2. Check personnel records - email populated?
        const personnel = await pool.query(`SELECT id, full_name, email, role, tenant_id FROM personnel ORDER BY created_at DESC LIMIT 10`);
        console.log('\n=== PERSONNEL ===');
        personnel.rows.forEach(r => console.log(`  ${r.full_name} | email=${r.email || 'NULL'} | role=${r.role} | tenant=${r.tenant_id}`));

        // 3. Check deployment_personnel rows
        const dp = await pool.query(`
            SELECT dp.deployment_id, dp.personnel_id, p.full_name, p.email, d.title
            FROM deployment_personnel dp
            JOIN personnel p ON p.id = dp.personnel_id
            JOIN deployments d ON d.id = dp.deployment_id
            ORDER BY dp.created_at DESC LIMIT 10
        `);
        console.log('\n=== DEPLOYMENT_PERSONNEL ===');
        if (dp.rows.length === 0) console.log('  (empty - no assignments exist)');
        dp.rows.forEach(r => console.log(`  ${r.full_name} (${r.email}) → ${r.title}`));

        // 4. Check deployments
        const deps = await pool.query(`SELECT id, title, status FROM deployments ORDER BY created_at DESC LIMIT 5`);
        console.log('\n=== DEPLOYMENTS ===');
        deps.rows.forEach(r => console.log(`  [${r.id}] ${r.title} | ${r.status}`));

        await pool.end();
    } catch(e) {
        console.error('ERROR:', e.message);
        await pool.end();
    }
}
run();
