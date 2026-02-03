import { query } from '../config/database.js';

async function resetUsers() {
    try {
        console.log('⚠️  DELETING ALL USERS (and cascading data)...');

        // 1. Clear dependent tables first to avoid Foreign Key violations
        await query('DELETE FROM audit_logs');
        await query('DELETE FROM refresh_tokens');
        await query('DELETE FROM system_settings'); // OR UPDATE system_settings SET updated_by = NULL

        // Note: You might want to keep Reports/Deployments? 
        // If so, you'd need to set their user_id/tenant_id to NULL or a seed user.
        // For a full "Clean Slate", we delete them:
        await query('DELETE FROM reports');
        await query('DELETE FROM deployments');

        // 2. Now delete users
        // Note: This relies on ON DELETE CASCADE for related tables (like refresh_tokens).
        // If other tables (like reports) restrict deletion, this might fail, 
        // but for a "fresh start" on a dev/test DB, this is usually what's needed.
        const result = await query('DELETE FROM users RETURNING id');

        console.log(`✅ Deleted ${result.rowCount} users.`);
        console.log('---');
        console.log('You can now register your Admin account again with the correct email.');
        console.log('Remember: Master Admin Passkey is SKYLENS-ADMIN-2025');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error resetting users:', err.message);
        if (err.code === '23503') {
            console.error('Hint: Some data (like Reports or Deployments) still references these users.');
            console.error('You may need to clear those tables first or manually fix foreign key constraints.');
        }
        process.exit(1);
    }
}

resetUsers();
