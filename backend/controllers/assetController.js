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
            WHERE 1=1
        `;
        const params = [];

        if (industryKey) {
            params.push(industryKey);
            queryStr += ` AND i.key = $${params.length}`;
        }

        if (req.query.clientId) {
            params.push(req.query.clientId);
            queryStr += ` AND s.client_id = $${params.length}`;
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
        console.log('GET /api/assets - User:', req.user); // Debug log
        const { site_id, category, countryId, industryKey } = req.query;

        let queryStr = `
            SELECT a.* 
            FROM assets a
            LEFT JOIN sites s ON a.site_id = s.id
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN industries i ON c.industry_id = i.id
            WHERE 1=1
        `;
        const params = [];

        if (industryKey) {
            params.push(industryKey);
            queryStr += ` AND i.key = $${params.length}`;
        }

        if (site_id) {
            params.push(site_id);
            queryStr += ` AND a.site_id = $${params.length}`;
        }

        // Note: Assets are not yet strictly linked to Country in the DB Schema (via Site). 
        // Future: Add country_id to sites table for strict filtering.
        // For now, we return all assets if countryId is provided, or we could implement a join if needed.
        // But since sites table lacks country_id, we skip this filter to avoid errors.
        if (countryId) {
            // params.push(countryId);
            // queryStr += ` AND ... `; 
        }

        if (category && category !== 'All') {
            params.push(category);
            queryStr += ` AND a.category = $${params.length}`;
        }

        queryStr += ' ORDER BY a.asset_key ASC';

        const result = await query(queryStr, params);

        // Map database fields (snake_case) to frontend fields (camelCase) if necessary
        // In this project, types.ts uses camelCase for some fields but the DB uses snake_case
        const assets = result.rows.map(row => ({
            id: row.id,
            siteId: row.site_id,
            name: row.asset_key, // Map name to asset_key as 'name' column doesn't exist
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
