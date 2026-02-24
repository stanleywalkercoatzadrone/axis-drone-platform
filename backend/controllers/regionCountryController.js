import pool from '../config/database.js';

export const getRegions = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM regions ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching regions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch regions' });
    }
};

export const getCountries = async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT c.*, r.name as region_name FROM countries c JOIN regions r ON c.region_id = r.id';
        const params = [];

        if (status) {
            query += ' WHERE c.status = $1';
            params.push(status);
        }

        query += ' ORDER BY c.name ASC';

        const { rows } = await pool.query(query, params);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch countries' });
    }
};

export const toggleCountryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ENABLED', 'DISABLED'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const { rows } = await pool.query(
            'UPDATE countries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Country not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error updating country status:', error);
        res.status(500).json({ success: false, message: 'Failed to update country status' });
    }
};
