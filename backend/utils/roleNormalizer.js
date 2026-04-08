/**
 * Role Normalizer — Axis Enterprise Platform
 *
 * Maps all legacy and variant role names to canonical lowercase equivalents.
 * Used during auth token decode to ensure consistent role comparisons.
 *
 * This is ADDITIVE — it does not remove or rename roles in the DB.
 * It only normalizes at runtime for comparison purposes.
 */

/**
 * Map of legacy/variant role names → canonical lowercase role.
 * Add new mappings here as the role system evolves.
 */
const ROLE_MAP = {
    // Admin variants
    'ADMIN':           'admin',
    'Admin':           'admin',
    'administrator':   'admin',
    'ADMINISTRATOR':   'admin',
    'internal_admin':  'admin',

    // Pilot variants
    'PILOT':                'pilot_technician',
    'Pilot':                'pilot_technician',
    'pilot':                'pilot_technician',
    'PILOT_TECHNICIAN':     'pilot_technician',

    // Field operator variants
    'FIELD_OPERATOR':       'field_operator',
    'Field Operator':       'field_operator',
    'field operator':       'field_operator',

    // Senior inspector variants
    'SENIOR_INSPECTOR':     'senior_inspector',
    'Senior Inspector':     'senior_inspector',
    'senior inspector':     'senior_inspector',

    // Client variants
    'CLIENT':               'client',
    'Client':               'client',
    'CLIENT_USER':          'client_user',
    'customer':             'client',
    'CUSTOMER':             'client',

    // Auditor variants
    'AUDITOR':              'auditor',
    'Auditor':              'auditor',

    // Operations variants
    'OPERATIONS':           'operations',
    'Operations':           'operations',
    'ops':                  'operations',

    // Analyst variants
    'ANALYST':              'analyst',
    'Analyst':              'analyst',

    // User variants
    'USER':                 'user',
    'User':                 'user',
};

/**
 * Normalize a role string to its canonical lowercase form.
 * Returns the input as-is (lowercased) if not found in the map.
 *
 * @param {string} role - Raw role string from DB or JWT
 * @returns {string} Normalized role
 */
export const normalizeRole = (role) => {
    if (!role) return 'user';
    return ROLE_MAP[role] || role.toLowerCase();
};

/**
 * Check if a normalized role is an admin role.
 * Supports both 'admin' and 'ADMIN' (normalizes first).
 */
export const isAdmin = (userOrRole) => {
    const role = typeof userOrRole === 'string'
        ? normalizeRole(userOrRole)
        : normalizeRole(userOrRole?.role);
    return role === 'admin';
};

/**
 * Check if a normalized role is a pilot role.
 */
export const isPilot = (userOrRole) => {
    const role = typeof userOrRole === 'string'
        ? normalizeRole(userOrRole)
        : normalizeRole(userOrRole?.role);
    return role === 'pilot_technician';
};

/**
 * Check if a normalized role is a client role.
 */
export const isClient = (userOrRole) => {
    const role = typeof userOrRole === 'string'
        ? normalizeRole(userOrRole)
        : normalizeRole(userOrRole?.role);
    return role === 'client' || role === 'client_user';
};

/**
 * Check if user is in-house (admin, operations, analyst, auditor, field operator).
 */
export const isInHouse = (userOrRole) => {
    const role = typeof userOrRole === 'string'
        ? normalizeRole(userOrRole)
        : normalizeRole(userOrRole?.role);
    return ['admin', 'operations', 'analyst', 'auditor', 'field_operator', 'senior_inspector', 'user'].includes(role);
};
