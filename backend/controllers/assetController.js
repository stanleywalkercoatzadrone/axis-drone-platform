import { query } from '../config/database.js';

/**
 * @desc    Get all sites
 * @route   GET /api/assets/sites
 * @access  Private
 */
export const getSites = async (req, res, next) => {
    try {
        const { industryKey } = req.query;
        let queryStr = `
            SELECT s.* 
            FROM sites s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN industries i ON c.industry_id = i.id
            WHERE s.tenant_id = $1
        `;
        const params = [req.user.tenantId];

        if (industryKey) {
            params.push(industryKey);
            queryStr += ` AND i.key = $${params.length}`;
        }

        queryStr += ' ORDER BY s.name ASC';

        const result = await query(queryStr, params);

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
        let queryStr = 'SELECT * FROM assets WHERE tenant_id = $1';
        const params = [req.user.tenantId];

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
        const result = await query('SELECT * FROM sites WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);

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
