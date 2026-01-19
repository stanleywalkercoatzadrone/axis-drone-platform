
import { query } from '../config/database.js';

async function removePersonnelUsers() {
    console.log('--- Removing Personnel-based User Accounts ---');

    try {
        // 1. Fetch all personnel emails
        const personnelResult = await query('SELECT email FROM personnel');
        const emails = personnelResult.rows.map(p => p.email);

        if (emails.length === 0) {
            console.log('No personnel found.');
            return;
        }

        // 2. Delete those emails from the users table (if they are just USER role and not ADMIN)
        const result = await query(
            'DELETE FROM users WHERE email = ANY($1) AND role = \'USER\' RETURNING email',
            [emails]
        );

        console.log(`Successfully removed ${result.rowCount} user accounts.`);
        result.rows.forEach(row => console.log(`- Removed: ${row.email}`));

    } catch (err) {
        console.error('Error removing users:', err.message);
    } finally {
        process.exit(0);
    }
}

removePersonnelUsers();
