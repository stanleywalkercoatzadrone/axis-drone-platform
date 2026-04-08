import { query } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Resolves a user's effective roles and permissions, including scoped and legacy roles.
 */
export const resolveEffectivePermissions = async (userId, userRole) => {
    // 1. Map Legacy Roles
    const mappedRoles = [];
    if (userRole === 'ADMIN') mappedRoles.push('internal_admin');
    if (userRole === 'pilot_technician') mappedRoles.push('external_contributor');

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
    // Admin always has full access
    if (user.role === 'ADMIN') return true;

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
        // Special case: pilot_technician can access assigned missions
        if (user.role === 'pilot_technician') {
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
    // (Existing personnel table uses email to link occasionally, or shared IDs)
    const assignmentResult = await query(
        `SELECT 1 FROM deployment_personnel dp
         JOIN personnel p ON dp.personnel_id = p.id
         JOIN users u ON p.email = u.email
         WHERE u.id = $1 AND dp.deployment_id = $2`,
        [userId, missionId]
    );

    if (assignmentResult.rows.length > 0) return true;

    // 2. Check monitoring team
    const monitoringResult = await query(
        `SELECT 1 FROM monitoring_team
         WHERE user_id = $1 AND deployment_id = $2`,
        [userId, missionId]
    );

    return monitoringResult.rows.length > 0;
};

/**
 * Checks if a user can mutate a specific asset.
 */
export const canMutateAsset = async (userId, userRole, assetId) => {
    if (userRole === 'ADMIN') return true;

    const assetResult = await query(
        `SELECT created_by_user_id FROM assets WHERE id = $1`,
        [assetId]
    );

    if (assetResult.rows.length === 0) return false;

    return assetResult.rows[0].created_by_user_id === userId;
};
