import { AppError } from './errorHandler.js';
import { isPilot } from '../utils/roleUtils.js';

/**
 * Mission Guard Middleware
 * 
 * Prevents pilot_technician users from mutating mission core data.
 * This is a backend-enforced security control; UI hiding is not sufficient.
 */

/**
 * Middleware to prevent pilots from mutating mission/deployment core fields
 * Apply this to POST/PUT/PATCH routes for deployments/missions
 */
export const preventPilotMissionMutation = (req, res, next) => {
    if (isPilot(req.user)) {
        throw new AppError(
            'Pilots cannot modify mission core data. Contact an administrator for changes.',
            403
        );
    }
    next();
};

/**
 * Middleware to allow pilots to only update specific allowed fields
 * Use this for routes where pilots can update limited fields (e.g., daily logs)
 */
export const restrictPilotMissionFields = (allowedFields = []) => {
    return (req, res, next) => {
        if (isPilot(req.user)) {
            // Check if any disallowed fields are being updated
            const requestedFields = Object.keys(req.body);
            const disallowedFields = requestedFields.filter(
                field => !allowedFields.includes(field)
            );

            if (disallowedFields.length > 0) {
                throw new AppError(
                    `Pilots cannot modify these fields: ${disallowedFields.join(', ')}`,
                    403
                );
            }
        }
        next();
    };
};
