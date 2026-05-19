/**
 * backfill_riverstart_iv.js
 * Finds the most recent "Riverstart IV" (or similar) mission, reads its invoices,
 * and inserts/upserts them into vendor_expenses (the financial ledger).
 * Safe to re-run — uses ON CONFLICT DO NOTHING on inv_number.
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        'postgresql://postgres.nkhiiwleyjsmvvdtkcud:%21Qaz1976T%40ylor2008@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false },
});

async function run() {
    const client = await pool.connect();
    try {
        // 1. Find the Riverstart IV mission (most recent match)
        const missionRes = await client.query(`
            SELECT id, title, site_name, date, tenant_id
            FROM deployments
            WHERE title ILIKE '%riverstart%'
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (missionRes.rows.length === 0) {
            console.log('❌ No Riverstart mission found. Trying partial match...');
            // Broader fallback
            const fallback = await client.query(`
                SELECT id, title, site_name, date, tenant_id
                FROM deployments
                ORDER BY created_at DESC
                LIMIT 10
            `);
            console.log('Most recent missions:');
            fallback.rows.forEach(r => console.log(' -', r.title, '|', r.site_name));
            return;
        }

        const mission = missionRes.rows[0];
        console.log(`✅ Found mission: "${mission.title}" (${mission.id})`);
        console.log(`   Site: ${mission.site_name} | Date: ${mission.date}`);

        // 2. Get all invoices for this mission
        const invoicesRes = await client.query(`
            SELECT i.id, i.amount, i.status, i.created_at,
                   p.full_name as pilot_name
            FROM invoices i
            JOIN personnel p ON i.personnel_id = p.id
            WHERE i.deployment_id = $1
            ORDER BY i.created_at ASC
        `, [mission.id]);

        console.log(`\n📋 Found ${invoicesRes.rows.length} invoice(s) for this mission`);

        if (invoicesRes.rows.length === 0) {
            console.log('No invoices to backfill.');
            return;
        }

        // 3. Upsert each into vendor_expenses
        let inserted = 0, skipped = 0;
        for (const inv of invoicesRes.rows) {
            const invDate = new Date(inv.created_at);
            const yr = invDate.getFullYear();
            const mo = invDate.toLocaleString('en-US', { month: 'long' });
            const isPaid = inv.status === 'PAID';

            const result = await client.query(`
                INSERT INTO vendor_expenses
                    (vendor_name, project_name, inv_number, inv_date, inv_year, inv_month,
                     inv_status, invoice_amount, stanley_addon, paid_to_vendor, paid_to_stanley,
                     notes, tenant_id)
                VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, 0, $9, 0, $10, $11)
                ON CONFLICT (inv_number) DO NOTHING
            `, [
                inv.pilot_name || 'Unknown Pilot',
                mission.title,
                inv.id,                          // inv_number = invoice UUID
                inv.created_at,
                yr,
                mo,
                isPaid ? 'Paid' : 'Unpaid',
                inv.amount,
                isPaid ? inv.amount : 0,         // paid_to_vendor if already paid
                mission.site_name ? `Backfill: ${mission.site_name}` : 'Backfill: Riverstart IV',
                mission.tenant_id || null,
            ]);

            if (result.rowCount > 0) {
                console.log(`  ✅ Inserted: ${inv.pilot_name} — $${Number(inv.amount).toFixed(2)} [${inv.status}]`);
                inserted++;
            } else {
                console.log(`  ⏭️  Skipped (already exists): ${inv.pilot_name}`);
                skipped++;
            }
        }

        console.log(`\n✅ Done — ${inserted} inserted, ${skipped} skipped`);

    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
