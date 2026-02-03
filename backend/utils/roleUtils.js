/**
 * Role Normalization Utilities
 * 
 * Handles runtime normalization of role strings to ensure backward compatibility
 * with existing tokens that may use different role formats (ADMIN vs admin, etc.)
 */

/**
 * Normalize a role string to standard format
 * @param {string} roleString - Raw role string from token/database
 * @returns {string|null} - Normalized role or null if invalid
 */
export function normalizeRole(roleString) {
    if (!roleString) return null;

    // Convert to lowercase and replace slashes/spaces with underscores
    const normalized = roleString.toLowerCase().replace(/[\/\s]/g, '_');

    // Map variants to standard roles
    if (['admin', 'administrator'].includes(normalized)) {
        return 'admin';
    }

    if (['pilot_technician', 'pilot', 'technician', 'pilot-technician'].includes(normalized)) {
        return 'pilot_technician';
    }

    // Return as-is for other roles (future-proofing)
    return normalized;
}

/**
 * Check if user has admin role
 * @param {object} user - User object with role property
 * @returns {boolean}
 */
export function isAdmin(user) {
    return normalizeRole(user?.role) === 'admin';
}

/**
 * Check if user has pilot_technician role
 * @param {object} user - User object with role property
 * @returns {boolean}
 */
export function isPilot(user) {
    return normalizeRole(user?.role) === 'pilot_technician';
}

/**
 * Check if user has any of the specified roles
 * @param {object} user - User object with role property
 * @param {string[]} roles - Array of role strings to check
 * @returns {boolean}
 */
export function hasAnyRole(user, roles) {
    const userRole = normalizeRole(user?.role);
    return roles.some(role => normalizeRole(role) === userRole);
}

/**
 * Get display name for a role
 * @param {string} role - Role string
 * @returns {string}
 */
export function getRoleDisplayName(role) {
    const normalized = normalizeRole(role);

    const displayNames = {
        'admin': 'Administrator',
        'pilot_technician': 'Pilot/Technician'
    };

    return displayNames[normalized] || normalized;
}
