import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { getCache, setCache } from '../config/redis.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            throw new AppError('Not authorized to access this route', 401);
        }

        // Check if token is blacklisted
        const blacklisted = await getCache(`blacklist:${token}`);
        if (blacklisted) {
            throw new AppError('Token has been revoked', 401);
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check cache for user data
        let user = await getCache(`user:${decoded.id}`);

        if (!user) {
            // If not in cache, fetch from database
            const { query } = await import('../config/database.js');
            const result = await query(
                'SELECT id, email, full_name, company_name, role, permissions FROM users WHERE id = $1',
                [decoded.id]
            );

            if (result.rows.length === 0) {
                throw new AppError('User not found', 404);
            }

            user = result.rows[0];
            // Cache user data for 1 hour
            await setCache(`user:${decoded.id}`, user, 3600);
        }

        // Transform to camelCase for consistency
        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            companyName: user.company_name,
            role: user.role,
            permissions: user.permissions
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
        if (!roles.includes(req.user.role)) {
            throw new AppError(
                `User role '${req.user.role}' is not authorized to access this route`,
                403
            );
        }
        next();
    };
};

export const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user.permissions || !req.user.permissions.includes(permission)) {
            throw new AppError(
                `You do not have permission to perform this action`,
                403
            );
        }
        next();
    };
};
