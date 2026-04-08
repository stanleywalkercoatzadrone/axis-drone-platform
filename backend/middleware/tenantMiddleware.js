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
 * Append a tenant_id WHERE clause to an existing SQL query.
 * Automatically handles parameter numbering.
 *
 * Usage:
 *   const { sql, params } = withTenantQuery(
 *     'SELECT * FROM reports WHERE id = $1',
 *     [reportId],
 *     req.tenantId
 *   );
 *   const result = await query(sql, params);
 *
 * @param {string} sql       - SQL query string (may already have WHERE clause)
 * @param {any[]}  params    - Existing query parameters
 * @param {string} tenantId  - Tenant ID to scope by
 * @param {string} [alias]   - Optional table alias (e.g. 'd' for 'd.tenant_id')
 * @returns {{ sql: string, params: any[] }}
 */
export const withTenantQuery = (sql, params = [], tenantId, alias = null) => {
    const col      = alias ? `${alias}.tenant_id` : 'tenant_id';
    const paramIdx = params.length + 1;
    const hasWhere = /\bWHERE\b/i.test(sql);
    const clause   = hasWhere
        ? ` AND ${col} = $${paramIdx}`
        : ` WHERE ${col} = $${paramIdx}`;

    return {
        sql:    sql.trim() + clause,
        params: [...params, tenantId],
    };
};

/**
 * Legacy helper (kept for backward compatibility).
 * Prefer withTenantQuery for new code.
 */
export const withTenant = (sql, params, tenantId) => {
    return withTenantQuery(sql, params, tenantId);
};

