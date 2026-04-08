/**
 * pilotMissionOwnership.js
 * Pilot Access Streamlining — Phase 1
 * Phase 12: Security event logging added.
 */
import { query } from '../config/database.js';
import { AppError } from './errorHandler.js';
import { normalizeRole } from '../utils/roleUtils.js';
import { logSecurityEvent, SECURITY_EVENTS } from '../utils/securityLogger.js';

/**
 * Verify pilot is assigned to the mission via deployment_personnel.
 * Falls back to Supabase JSONB assigned_team if not in deployment_personnel.
 * Admins always pass through.
 */
export const verifyPilotMissionOwnership = async (req, res, next) => {
    try {
        const { missionId } = req.params;
        const userId = req.user?.id;
        const role = normalizeRole(req.user?.role);

        // Admins bypass — they have universal mission visibility
        if (role === 'admin') return next();

        if (!missionId || !userId) {
            throw new AppError('Mission access denied', 403);
        }

        // Check assignment via deployment_personnel (PostgreSQL path)
        const personnelCheck = await query(
            `SELECT dp.id
             FROM deployment_personnel dp
             INNER JOIN personnel p ON p.id = dp.personnel_id
             WHERE dp.deployment_id = $1 AND p.user_id = $2
             LIMIT 1`,
            [missionId, userId]
        );

        if (personnelCheck.rows.length > 0) {
            return next();
        }

        // Fallback: check deployments.assigned_team JSONB column
        const jsonbCheck = await query(
            `SELECT id FROM deployments
             WHERE id = $1
             AND (
                 assigned_to = $2
                 OR assigned_team @> $3::jsonb
             )
             LIMIT 1`,
            [missionId, userId, JSON.stringify([{ user_id: userId }])]
        );

        if (jsonbCheck.rows.length > 0) {
            return next();
        }

        // Access denied — log to console and security_events table (Phase 12)
        console.warn(`[PILOT-ISOLATION] UNAUTHORIZED ACCESS ATTEMPT: user=${userId} role=${role} missionId=${missionId} ip=${req.ip}`);
        await logSecurityEvent({
            userId,
            eventType: SECURITY_EVENTS.UNAUTHORIZED_MISSION_ACCESS,
            resource: `/api/pilot/secure/missions/${missionId}`,
            ipAddress: req.ip,
            metadata: { role, missionId, userAgent: req.headers['user-agent'] }
        });

        throw new AppError('Access denied: this mission is not assigned to you.', 403);
    } catch (e) {
        if (e instanceof AppError) return next(e);
        console.error('[pilotMissionOwnership] Error:', e.message);
        return next(new AppError('Mission access check failed', 500));
    }
};
