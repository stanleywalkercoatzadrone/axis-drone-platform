import db from './config/database.js';

async function test() {
    console.log("Connected to DB via pool.");

    try {
        const email = 'walkerst@me.com';

        // 1. Check existing user
        const existing = await db.query('SELECT id, email, role, auth_version FROM users WHERE email = $1', [email]);
        console.log("Existing user before UPSERT:", existing.rows);

        // 2. Try the EXACT UPSERT query
        const mappedRole = 'FIELD_OPERATOR';
        const invitationTokenHash = 'test_hash';
        const invitationExpires = new Date();
        const tenantId = existing.rows.length > 0 ? '60cb5d30-bfae-4aa6-a83d-0d6c5478d1fb' : null; // guess tenant id from previous context or query

        console.log("Running UPSERT simulation...");
        const userRes = await db.query(
            `INSERT INTO users (
                email, full_name, role, permissions, tenant_id,
                invitation_token_hash, invitation_expires_at, force_password_reset
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            ON CONFLICT (email) DO UPDATE SET
                role = EXCLUDED.role,
                auth_version = users.auth_version + 1,
                invitation_token_hash = EXCLUDED.invitation_token_hash,
                invitation_expires_at = EXCLUDED.invitation_expires_at,
                force_password_reset = true,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, email, role`,
            [
                email,
                'Stanley Walker',
                mappedRole,
                JSON.stringify(['PILOT_ACCESS']),
                tenantId, // we don't know exact tenant ID, use NULL if we must, wait, tenant_id might be NOT NULL?
                invitationTokenHash,
                invitationExpires
            ]
        );
        console.log("UPSERT Returned Rows:", userRes.rows);

    } catch (e) {
        console.error("Query Error:", e.message);
    } finally {
        process.exit(0);
    }
}

test();
