import { query } from '../config/database.js';

/**
 * @desc    Get all sites
 * @route   GET /api/assets/sites
 * @access  Private
 */
export const getSites = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM sites ORDER BY name ASC'
        );

        res.status(200).json({
            status: 'success',
            results: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all assets (optionally filtered by site_id)
 * @route   GET /api/assets
 * @access  Private
 */
export const getAssets = async (req, res, next) => {
    try {
        const { site_id, category } = req.query;
        let queryStr = 'SELECT * FROM assets WHERE 1=1';
        const params = [];

        if (site_id) {
            params.push(site_id);
            queryStr += ` AND site_id = $${params.length}`;
        }

        if (category && category !== 'All') {
            params.push(category);
            queryStr += ` AND category = $${params.length}`;
        }

        queryStr += ' ORDER BY name ASC';

        const result = await query(queryStr, params);

        // Map database fields (snake_case) to frontend fields (camelCase) if necessary
        // In this project, types.ts uses camelCase for some fields but the DB uses snake_case
        const assets = result.rows.map(row => ({
            id: row.id,
            siteId: row.site_id,
            name: row.name,
            category: row.category,
            location: row.location,
            status: row.status,
            lastInspectionDate: row.last_inspection_date,
            nextInspectionDate: row.next_inspection_date,
            metadata: row.metadata
        }));

        res.status(200).json({
            status: 'success',
            results: assets.length,
            data: assets
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get a single site by ID
 * @route   GET /api/assets/sites/:id
 * @access  Private
 */
export const getSiteById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM sites WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Site not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};
