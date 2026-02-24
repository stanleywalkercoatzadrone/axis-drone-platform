import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeRole } from '../utils/roleUtils.js';

/**
 * Resolves a user's effective roles and permissions, including scoped and legacy roles.
 */
export const resolveEffectivePermissions = async (userId, userRole) => {
    const normalizedRole = normalizeRole(userRole);

    // 1. Map Legacy Roles
    const mappedRoles = [];
    if (normalizedRole === 'admin') mappedRoles.push('internal_admin');
    if (normalizedRole === 'pilot_technician') mappedRoles.push('external_contributor');
    if (normalizedRole === 'client_user') mappedRoles.push('external_stakeholder');

    // 2. Fetch Scoped Bindings
    const bindingsResult = await query(
        `SELECT r.name as role_name, b.scope_type, b.scope_id
         FROM user_role_bindings b
         JOIN roles r ON b.role_id = r.id
         WHERE b.user_id = $1`,
        [userId]
    );

    const bindings = bindingsResult.rows.map(row => ({
        role: row.role_name,
        scopeType: row.scope_type,
        scopeId: row.scope_id
    }));

    const effectiveRoles = [...new Set([...mappedRoles, ...bindings.map(b => b.role)])];

    // 3. Fetch All Permissions for Effective Roles
    const permissionsResult = await query(
        `SELECT DISTINCT p.key
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name = ANY($1)`,
        [effectiveRoles]
    );

    const permissions = permissionsResult.rows.map(row => row.key);

    return {
        roles: effectiveRoles,
        bindings,
        permissions
    };
};

/**
 * Checks if a user has a specific permission in a given context.
 */
export const can = async (user, permissionKey, context = {}) => {
    const normalizedRole = normalizeRole(user.role);

    // Admin always has full access
    if (normalizedRole === 'admin') return true;

    const { roles, bindings, permissions } = await resolveEffectivePermissions(user.id, user.role);

    if (!permissions.includes(permissionKey)) return false;

    // If it's a global permission and user has it, return true
    // (internal_admin permissions are global)
    if (roles.includes('internal_admin')) return true;

    // Scoped check
    if (context.customerId) {
        const hasCustomerAccess = bindings.some(b =>
            (b.scopeType === 'customer' && b.scopeId === context.customerId) ||
            (b.scopeType === 'global')
        );
        if (!hasCustomerAccess) return false;
    }

    if (context.projectId) {
        const hasProjectAccess = bindings.some(b =>
            (b.scopeType === 'project' && b.scopeId === context.projectId) ||
            (b.scopeType === 'customer' && b.scopeId === context.customerId) ||
            (b.scopeType === 'global')
        );
        if (!hasProjectAccess) return false;
    }

    if (context.missionId) {
        // Restricted roles must be explicitly assigned to the mission
        if (['pilot_technician', 'client_user'].includes(normalizedRole)) {
            const isAssigned = await canAccessMission(user.id, context.missionId);
            if (!isAssigned) return false;
        }
    }

    return true;
};

/**
 * Checks if a user is assigned to a specific mission (deployment).
 * Checks both personnel assignments and monitoring team.
 */
export const canAccessMission = async (userId, missionId) => {
    // 1. Check if user is linked to personnel and assigned to deployment
    const assignmentResult = await query(
        `SELECT 1 FROM deployment_personnel dp
         JOIN personnel p ON dp.personnel_id = p.id
         JOIN users u ON p.email = u.email
         WHERE u.id = $1 AND dp.deployment_id = $2`,
        [userId, missionId]
    );

    if (assignmentResult.rows.length > 0) return true;

    // 2. Check monitoring team (deployment_monitoring_users table)
    const monitoringResult = await query(
        `SELECT 1 FROM deployment_monitoring_users
         WHERE user_id = $1 AND deployment_id = $2`,
        [userId, missionId]
    );

    return monitoringResult.rows.length > 0;
};

/**
 * Checks if a user can mutate a specific asset.
 */
export const canMutateAsset = async (userId, userRole, assetId) => {
    if (normalizeRole(userRole) === 'admin') return true;

    const assetResult = await query(
        `SELECT created_by_user_id FROM assets WHERE id = $1`,
        [assetId]
    );

    if (assetResult.rows.length === 0) return false;

    return assetResult.rows[0].created_by_user_id === userId;
};
