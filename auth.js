import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { getCache, setCache } from '../config/redis.js';
import crypto from 'crypto';
import { resolveEffectivePermissions, can } from '../services/permissionService.js';
import { normalizeRole, isAdmin } from '../utils/roleUtils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ISS = process.env.JWT_ISS || 'axis-drone-platform';
const JWT_AUD = process.env.JWT_AUD || 'axis-drone-client';

const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Log Authorization header to server for debugging
        if (req.originalUrl?.includes('/personnel') || req.url?.includes('/personnel')) {
            console.log(`[AUTH DEBUG] Request to ${req.originalUrl || req.url} - Header: ${authHeader ? authHeader.substring(0, 20) + '...' : 'MISSING'}`);
        }

        if (!authHeader?.startsWith('Bearer ')) {
            throw new AppError('Not authorized. Use Bearer scheme.', 401);
        }
        const token = authHeader.slice(7).trim();

        // Demo/Sandbox bypass
        if (token === 'DEMO_TOKEN_UNRESTRICTED' || token === 'DEMO_TOKEN') {
            req.user = {
                id: 'demo-user',
                email: 'demo@axis.ai',
                fullName: 'Demo Principal',
                role: 'admin',
                effectiveRoles: ['admin'],
                permissions: ['CREATE_REPORT', 'EDIT_REPORT', 'DELETE_REPORT', 'RELEASE_REPORT', 'MANAGE_USERS', 'MANAGE_SETTINGS', 'VIEW_MASTER_VAULT'],
                tenantId: 'demo-tenant'
            };
            return next();
        }

        // Use SHA256 of token for blacklist key to prevent abuse
        const tokenHash = sha256(token);
        const blacklisted = await getCache(`blacklist:${tokenHash}`);
        if (blacklisted) {
            throw new AppError('Token has been revoked', 401);
        }

        // Verify token with strict options
        const decoded = jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: JWT_ISS,
            audience: JWT_AUD,
            clockTolerance: 10 // Handle slight clock drift
        });

        // Check cache for user data
        let user = await getCache(`user:${decoded.id}`);

        if (!user) {
            const { query } = await import('../config/database.js');
            const result = await query(
                'SELECT id, email, full_name, company_name, role, permissions, auth_version, tenant_id FROM users WHERE id = $1',
                [decoded.id]
            );

            if (result.rows.length === 0) {
                throw new AppError('User not found', 401);
            }

            user = result.rows[0];

            // Cache for short duration (5 min) for security-critical data
            await setCache(`user:${decoded.id}`, user, 300);
        }

        // Validate auth_version (Global logout)
        if (user.auth_version !== decoded.auth_version) {
            throw new AppError('Session expired. Please log in again.', 401);
        }

        // Resolve effective permissions (roles and granular keys)
        const effective = await resolveEffectivePermissions(user.id, user.role);

        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            role: user.role,
            effectiveRoles: effective.roles,
            permissions: effective.permissions, // Merged legacy + new permissions
            bindings: effective.bindings,
            authVersion: user.auth_version,
            tenantId: user.tenant_id
        };
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            next(new AppError('Invalid token', 401));
        } else if (error.name === 'TokenExpiredError') {
            next(new AppError('Token expired', 401));
        } else {
            next(error);
        }
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        // Normalize both the user's role and the required roles for comparison
        const userRole = normalizeRole(req.user.role);
        const normalizedRequiredRoles = roles.map(r => normalizeRole(r));

        // Check if user's normalized role matches any required role
        const hasRole = normalizedRequiredRoles.includes(userRole) ||
            req.user.effectiveRoles.some(r => normalizedRequiredRoles.includes(normalizeRole(r)));

        if (!hasRole) {
            throw new AppError(
                `User role '${req.user.role}' is not authorized to access this route`,
                403
            );
        }
        next();
    };
};

export const authorizePerm = (permission) => {
    return (req, res, next) => {
        // Admin always has full access (using normalized role check)
        if (isAdmin(req.user) || req.user.effectiveRoles.includes('internal_admin')) {
            return next();
        }

        if (!req.user.permissions.includes(permission)) {
            throw new AppError(
                `You do not have permission to perform this action (${permission})`,
                403
            );
        }
        next();
    };
};

/**
 * Middleware for scoped permission checks (e.g. checking mission access via mission ID in params)
 */
export const checkScopedPermission = (permission, scopeIdParam = 'id', scopeType = 'mission') => {
    return async (req, res, next) => {
        const scopeId = req.params[scopeIdParam];
        const context = { [scopeType + 'Id']: scopeId };

        const isAllowed = await can(req.user, permission, context);

        if (!isAllowed) {
            throw new AppError(`Not authorized for this ${scopeType} (${permission})`, 403);
        }
        next();
    };
};

export const restrictTo = authorize;
