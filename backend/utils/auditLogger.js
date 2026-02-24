
import { query } from '../config/database.js';

/**
 * Log an audit event
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * @param {string} resourceType - Type of resource affected (e.g., 'PERSONNEL', 'MISSION')
 * @param {string} resourceId - ID of the resource affected
 * @param {object} details - Additional details about the action (e.g., changed fields)
 * @param {string} tenantId - Tenant ID
 */
export const logAudit = async (userId, action, resourceType, resourceId, details, tenantId) => {
    try {
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, action, resourceType, resourceId, JSON.stringify(details), tenantId]
        );
    } catch (error) {
        console.error('Audit Log Error:', error);
        // Don't throw, we don't want to break the main flow if audit logging fails
    }
};
