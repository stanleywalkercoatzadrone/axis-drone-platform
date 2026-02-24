import db from '../config/database.js';

/**
 * AI Pilot Matching Controller
 * Suggests pilots for missions based on proximity, ratings, and certifications
 */

export const getPilotMatches = async (req, res) => {
    try {
        const { missionLat, missionLong, requiredRole, maxDistanceMiles = 100 } = req.body;

        if (!missionLat || !missionLong) {
            return res.status(400).json({ success: false, message: 'Mission coordinates required' });
        }

        const tenantId = req.user.tenantId;

        // SQL Query using Haversine formula for distance
        // 3959 is earth radius in miles
        const query = `
            SELECT p.*, 
                (3959 * acos(cos(radians($1)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude)))) AS distance,
                cs.status as compliance_status
            FROM personnel p
            LEFT JOIN (
                SELECT 
                    pilot_id,
                    CASE 
                        WHEN COUNT(*) FILTER (WHERE expiration_date < NOW()) > 0 THEN 'expired'
                        WHEN COUNT(*) FILTER (WHERE expiration_date < NOW() + INTERVAL '30 days' AND expiration_date >= NOW()) > 0 THEN 'expiring_soon'
                        WHEN COUNT(*) > 0 THEN 'compliant'
                        ELSE 'pending'
                    END as status
                FROM pilot_documents
                GROUP BY pilot_id
            ) cs ON p.id = cs.pilot_id
            WHERE (p.tenant_id = $3 OR (p.tenant_id IS NULL AND $3 IS NULL))
            AND p.role IN ($4, 'Both')
            AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            HAVING (3959 * acos(cos(radians($1)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude)))) <= p.max_travel_distance
            ORDER BY distance ASC, p.average_rating DESC
            LIMIT 10;
        `;

        // Note: HAVING is not directly supported in standard SELECT without GROUP BY in some DBs, 
        // we might need to wrap in a subquery or repeat the formula in WHERE.

        const refinedQuery = `
            SELECT * FROM (
                SELECT p.*, 
                    (3959 * acos(cos(radians($1)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude)))) AS distance,
                    cs.status as compliance_status
                FROM personnel p
                LEFT JOIN (
                    SELECT 
                        pilot_id,
                        CASE 
                            WHEN COUNT(*) FILTER (WHERE expiration_date < NOW()) > 0 THEN 'expired'
                            WHEN COUNT(*) FILTER (WHERE expiration_date < NOW() + INTERVAL '30 days' AND expiration_date >= NOW()) > 0 THEN 'expiring_soon'
                            WHEN COUNT(*) > 0 THEN 'compliant'
                            ELSE 'pending'
                        END as status
                    FROM pilot_documents
                    GROUP BY pilot_id
                ) cs ON p.id = cs.pilot_id
                WHERE (p.tenant_id = $3 OR (p.tenant_id IS NULL AND $3 IS NULL))
                AND (p.role = $4 OR p.role = 'Both')
                AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            ) AS distance_query
            WHERE distance <= max_travel_distance
            ORDER BY distance ASC, average_rating DESC
            LIMIT 10;
        `;

        const result = await db.query(refinedQuery, [missionLat, missionLong, tenantId, requiredRole || 'Pilot']);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Pilot Match Error:', error);
        res.status(500).json({ success: false, message: 'Matching failed', error: error.message });
    }
};
