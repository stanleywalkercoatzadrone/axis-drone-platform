import db from '../config/database.js';

/**
 * Availability Controller
 * Manages pilot availability, blackout dates, and scheduling conflicts
 */

export const getPilotAvailability = async (req, res) => {
    try {
        const { pilotId } = req.params;
        const tenantId = req.user.tenantId;

        const result = await db.query(
            `SELECT * FROM pilot_availability 
             WHERE pilot_id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
             ORDER BY start_time ASC`,
            [pilotId, tenantId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch availability' });
    }
};

export const updateAvailability = async (req, res) => {
    try {
        const { pilotId } = req.params;
        const { availabilityBlocks } = req.body; // Array of blocks
        const tenantId = req.user.tenantId;

        if (!Array.isArray(availabilityBlocks)) {
            return res.status(400).json({ success: false, message: 'availabilityBlocks must be an array' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Simple approach: Delete existing and re-insert or update
            // For now, let's just allow appending/updating specific ones if ID is provided
            for (const block of availabilityBlocks) {
                if (block.id) {
                    await client.query(
                        `UPDATE pilot_availability 
                         SET start_time = $1, end_time = $2, type = $3, recurrence = $4, description = $5 
                         WHERE id = $6 AND pilot_id = $7`,
                        [block.startTime, block.endTime, block.type, block.recurrence, block.description, block.id, pilotId]
                    );
                } else {
                    await client.query(
                        `INSERT INTO pilot_availability (pilot_id, tenant_id, start_time, end_time, type, recurrence, description)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [pilotId, tenantId, block.startTime, block.endTime, block.type, block.recurrence, block.description]
                    );
                }
            }

            await client.query('COMMIT');
            res.json({ success: true, message: 'Availability updated successfully' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ success: false, message: 'Failed to update availability' });
    }
};

export const checkAssignmentConflict = async (req, res) => {
    try {
        const { pilotId, startTime, endTime } = req.body;

        // 1. Check blackout dates in pilot_availability
        const availabilityCheck = await db.query(
            `SELECT * FROM pilot_availability 
             WHERE pilot_id = $1 
             AND type = 'BLACKOUT'
             AND (
                (start_time, end_time) OVERLAPS ($2, $3)
             )`,
            [pilotId, startTime, endTime]
        );

        // 2. Check existing mission assignments (from deployments)
        // Note: deployments table has 'date' column but we might need more granular time tracking
        const missionCheck = await db.query(
            `SELECT d.id, d.title, d.date 
             FROM deployments d
             JOIN deployment_personnel dp ON d.id = dp.deployment_id
             WHERE dp.personnel_id = $1
             AND d.status NOT IN ('Cancelled', 'Archived')
             AND d.date = $2::date`, // Simplified for now as deployments currently only use date
            [pilotId, startTime]
        );

        const conflicts = {
            hasConflict: availabilityCheck.rows.length > 0 || missionCheck.rows.length > 0,
            blackouts: availabilityCheck.rows,
            missions: missionCheck.rows
        };

        res.json({
            success: true,
            data: conflicts
        });
    } catch (error) {
        console.error('Conflict check error:', error);
        res.status(500).json({ success: false, message: 'Conflict check failed' });
    }
};

export const getSyncStatus = async (req, res) => {
    try {
        const { pilotId } = req.params;
        const result = await db.query(
            `SELECT * FROM availability_sync WHERE pilot_id = $1`,
            [pilotId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch sync status' });
    }
};
