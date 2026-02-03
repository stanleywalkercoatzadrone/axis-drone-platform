import { query } from '../config/database.js';

/**
 * Finds a user by email or full name.
 */
export const findUserBySearch = async (searchTerm) => {
    if (!searchTerm) return null;

    // 1. Try exact email match
    const emailResult = await query(
        'SELECT id FROM users WHERE email = $1',
        [searchTerm.trim().toLowerCase()]
    );
    if (emailResult.rows.length > 0) return emailResult.rows[0].id;

    // 2. Try exact full name match
    const nameResult = await query(
        'SELECT id FROM users WHERE LOWER(full_name) = $1',
        [searchTerm.trim().toLowerCase()]
    );
    if (nameResult.rows.length > 0) return nameResult.rows[0].id;

    return null;
};
