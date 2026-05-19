import { AppError } from './errorHandler.js';

/**
 * Tenant Isolation Middleware
 * 
 * Ensures that every request is strictly scoped to a tenant.
 * It expects the tenantId to be present on the req.user object (set by protect middleware).
 */
export const tenantContext = (req, res, next) => {
    if (!req.user || !req.user.tenantId) {
        return next(new AppError('Tenant context missing. Authentication required.', 401));
    }

    // Attach tenant ID to a standard property for controllers to use
    req.tenantId = req.user.tenantId;

    // Safety: If it's a 'default' tenant, we might want to log it for auditing
    if (req.tenantId === 'default') {
        // console.log(`[AUDIT] Request using default tenant for user ${req.user.id}`);
    }

    next();
};

/**
 * Helper to wrap database queries with tenant isolation
 * This can be used in repositories or controllers to ensure WHERE clauses always include tenant_id.
 */
export const withTenant = (query, params, tenantId) => {
    // This is a simplified helper. In a real repository pattern, 
    // the tenantId would be automatically injected into all query builders.

    // Example usage: 
    // const sql = `SELECT * FROM reports WHERE id = $1 AND tenant_id = $2`;
    // return query(sql, [id, tenantId]);

    return {
        query,
        params: [...params, tenantId]
    };
};
