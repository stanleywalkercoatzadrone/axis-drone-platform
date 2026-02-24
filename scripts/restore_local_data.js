
import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcryptjs';

const connectionString = "postgresql://postgres:postgres@localhost:5432/skylens_db";

async function restoreData() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to local database');

        // 1. Restore Primary User
        const adminEmail = "stanley.walker@coatzadroneusa.com";
        const password = "password123";
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const tenantId = "default";

        console.log(`Checking for user ${adminEmail}...`);
        const userRes = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (userRes.rows.length === 0) {
            await client.query(
                `INSERT INTO users (email, password_hash, full_name, role, permissions, tenant_id) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [adminEmail, passwordHash, 'Stanley Walker', 'ADMIN', JSON.stringify(['*']), tenantId]
            );
            console.log(`✅ Created user ${adminEmail}`);
        } else {
            console.log(`ℹ️ User ${adminEmail} already exists`);
        }

        // 2. Map Industries
        const industriesRes = await client.query('SELECT id, key FROM industries');
        const industryMapping = {};
        industriesRes.rows.forEach(row => {
            industryMapping[row.key] = row.id;
        });

        // 3. Restore Clients and Link Sites
        const clientsToRestore = [
            { name: 'Urban Real Estate', industryKey: 'construction' },
            { name: 'GreenEnergy Corp', industryKey: 'solar' },
            { name: 'Telco Giant', industryKey: 'telecom' }
        ];

        for (const c of clientsToRestore) {
            console.log(`Restoring client ${c.name}...`);
            let clientId;
            const existingClient = await client.query('SELECT id FROM clients WHERE name = $1', [c.name]);

            if (existingClient.rows.length === 0) {
                const industryId = industryMapping[c.name.includes('Real Estate') ? 'construction' : (c.name.includes('Solar') ? 'solar' : 'telecom')];
                const newClient = await client.query(
                    'INSERT INTO clients (name, industry_id) VALUES ($1, $2) RETURNING id',
                    [c.name, industryId]
                );
                clientId = newClient.rows[0].id;
                console.log(`✅ Created client ${c.name} (${clientId})`);
            } else {
                clientId = existingClient.rows[0].id;
                console.log(`ℹ️ Client ${c.name} already exists`);
            }

            // Link existing sites
            const updateRes = await client.query(
                'UPDATE sites SET client_id = $1 WHERE client = $2 AND client_id IS NULL',
                [clientId, c.name]
            );
            console.log(`✅ Linked ${updateRes.rowCount} sites to ${c.name}`);
        }

        console.log('🎉 Data restoration complete!');
    } catch (err) {
        console.error('❌ Restoration failed:', err);
    } finally {
        await client.end();
    }
}

restoreData();
