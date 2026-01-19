import db from '../config/database.js';

/**
 * Helper to map personnel database row to camelCase
 */
const mapPersonnelRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        fullName: row.full_name,
        role: row.role,
        email: row.email,
        phone: row.phone,
        certificationLevel: row.certification_level,
        dailyPayRate: row.daily_pay_rate ? parseFloat(row.daily_pay_rate) : 0,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

/**
 * Get all personnel with optional role filter
 */
export const getAllPersonnel = async (req, res) => {
    try {
        const { role, status } = req.query;

        let query = 'SELECT * FROM personnel WHERE 1=1';
        const params = [];

        if (role) {
            params.push(role);
            query += ` AND role = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows.map(mapPersonnelRow)
        });
    } catch (error) {
        console.error('Error fetching personnel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch personnel',
            error: error.message
        });
    }
};

/**
 * Get personnel by ID
 */
export const getPersonnelById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'SELECT * FROM personnel WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        res.json({
            success: true,
            data: mapPersonnelRow(result.rows[0])
        });
    } catch (error) {
        console.error('Error fetching personnel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch personnel',
            error: error.message
        });
    }
};

/**
 * Create new personnel
 */
export const createPersonnel = async (req, res) => {
    try {
        const {
            fullName,
            role,
            email,
            phone,
            certificationLevel,
            dailyPayRate,
            status
        } = req.body;

        // Validation
        if (!fullName || !role || !email) {
            return res.status(400).json({
                success: false,
                message: 'Full name, role, and email are required'
            });
        }

        if (!['Pilot', 'Technician'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role must be either Pilot or Technician'
            });
        }

        const result = await db.query(
            `INSERT INTO personnel 
            (full_name, role, email, phone, certification_level, daily_pay_rate, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                fullName,
                role,
                email,
                phone || null,
                certificationLevel || null,
                dailyPayRate || 0,
                status || 'Active'
            ]
        );

        res.status(201).json({
            success: true,
            data: mapPersonnelRow(result.rows[0]),
            message: 'Personnel created successfully'
        });
    } catch (error) {
        console.error('Error creating personnel:', error);

        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create personnel',
            error: error.message
        });
    }
};

/**
 * Update personnel
 */
export const updatePersonnel = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            fullName,
            role,
            email,
            phone,
            certificationLevel,
            dailyPayRate,
            status
        } = req.body;

        // Check if personnel exists
        const checkResult = await db.query(
            'SELECT id FROM personnel WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        const result = await db.query(
            `UPDATE personnel 
            SET full_name = COALESCE($1, full_name),
                role = COALESCE($2, role),
                email = COALESCE($3, email),
                phone = COALESCE($4, phone),
                certification_level = COALESCE($5, certification_level),
                daily_pay_rate = COALESCE($6, daily_pay_rate),
                status = COALESCE($7, status)
            WHERE id = $8
            RETURNING *`,
            [fullName, role, email, phone, certificationLevel, dailyPayRate, status, id]
        );

        res.json({
            success: true,
            data: mapPersonnelRow(result.rows[0]),
            message: 'Personnel updated successfully'
        });
    } catch (error) {
        console.error('Error updating personnel:', error);

        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update personnel',
            error: error.message
        });
    }
};

/**
 * Delete personnel
 */
export const deletePersonnel = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM personnel WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Personnel not found'
            });
        }

        res.json({
            success: true,
            message: 'Personnel deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting personnel:', error);

        // Handle foreign key constraint violation
        if (error.code === '23503') {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete personnel with existing daily logs or deployments'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete personnel',
            error: error.message
        });
    }
};
