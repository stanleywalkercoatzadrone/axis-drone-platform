
import { query } from '../config/database.js';
import { hashPassword } from '../services/tokenService.js';

async function batchLoadUsers() {
    console.log('--- Starting Batch User Load from Personnel ---');

    const TEMP_PASSWORD = 'Axis2026!';
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
        // 1. Fetch all personnel
        const personnelResult = await query('SELECT full_name, email, role FROM personnel');
        const personnel = personnelResult.rows;

        console.log(`Found ${personnel.length} personnel records.`);

        // 2. Hash the temporary password once (or per user if we want different ones, but once is fine for batch)
        const passwordHash = await hashPassword(TEMP_PASSWORD);

        for (const person of personnel) {
            try {
                // 3. Check if user already exists
                const existingUser = await query('SELECT id FROM users WHERE email = $1', [person.email]);

                if (existingUser.rows.length > 0) {
                    console.log(`Skipping ${person.email} - User already exists.`);
                    skippedCount++;
                    continue;
                }

                // 4. Determine permissions based on role
                // Default permissions for personnel
                const permissions = ['CREATE_REPORT', 'VIEW_REPORTS'];

                // 5. Insert into users table
                await query(
                    `INSERT INTO users (email, password_hash, full_name, role, permissions)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        person.email,
                        passwordHash,
                        person.full_name,
                        'USER', // Assign general USER role; they can be promoted later if needed
                        JSON.stringify(permissions)
                    ]
                );

                console.log(`Successfully created user account for ${person.full_name} (${person.email})`);
                createdCount++;
            } catch (err) {
                console.error(`Error processing ${person.email}:`, err.message);
                errorCount++;
            }
        }

        console.log('--- Batch Load Complete ---');
        console.log(`Summary: Created: ${createdCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
        console.log(`Temporary Password for all new accounts: ${TEMP_PASSWORD}`);

    } catch (err) {
        console.error('Fatal error during batch load:', err.message);
    } finally {
        process.exit(0);
    }
}

batchLoadUsers();
