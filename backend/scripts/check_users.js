import pool, { query } from '../config/database.js';

async function checkUsers() {
    try {
        console.log('Connecting to database...');
        const result = await query('SELECT id, email, full_name, role, permissions FROM users ORDER BY created_at DESC');

        console.log(`Found ${result.rows.length} users:`);
        console.table(result.rows.map(u => ({
            email: u.email,
            role: u.role,
            permissions: typeof u.permissions === 'string' ? u.permissions : JSON.stringify(u.permissions),
            id: u.id
        })));

    } catch (err) {
        console.error('Error querying users:', err);
    } finally {
        await pool.end();
    }
}

checkUsers();
