import { query } from '../config/database.js';

async function listUsers() {
    try {
        console.log('--- Current Users in Database ---');
        const result = await query('SELECT id, email, full_name, role, tenant_id, auth_version FROM users ORDER BY created_at DESC');

        if (result.rows.length === 0) {
            console.log('No users found.');
        } else {
            console.table(result.rows);
        }
        process.exit(0);
    } catch (err) {
        console.error('Error listing users:', err);
        process.exit(1);
    }
}

listUsers();
