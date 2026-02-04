import pool, { query } from '../config/database.js';

async function fixPermissions() {
    try {
        console.log('Fixing permissions for admin@coatzadroneusa.com...');

        const fullPermissions = [
            'CREATE_REPORT',
            'DELETE_REPORT',
            'EDIT_REPORT',
            'MANAGE_SETTINGS',
            'MANAGE_USERS',
            'RELEASE_REPORT',
            'VIEW_MASTER_VAULT'
        ];

        const result = await query(
            `UPDATE users 
             SET permissions = $1 
             WHERE email = 'admin@coatzadroneusa.com' AND role = 'ADMIN'
             RETURNING id, email, role, permissions`,
            [JSON.stringify(fullPermissions)]
        );

        if (result.rows.length > 0) {
            console.log('Successfully updated permissions:', result.rows[0]);
        } else {
            console.log('User not found or already has correct role.');
        }

    } catch (err) {
        console.error('Error updating permissions:', err);
    } finally {
        await pool.end();
    }
}

fixPermissions();
