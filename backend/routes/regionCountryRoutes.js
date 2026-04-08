import express from 'express';
import { getRegions, getCountries, toggleCountryStatus, seedRegionsCountries } from '../controllers/regionCountryController.js';
import { protect, authorize } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

router.get('/', protect, getRegions);
router.get('/regions', protect, getRegions);
router.get('/countries', protect, getCountries);
router.patch('/countries/:id/status', protect, authorize('admin'), toggleCountryStatus);
router.post('/seed', protect, authorize('admin'), seedRegionsCountries);

/**
 * GET /api/regions/countries/:id/pilots
 * Returns all personnel assigned to a country
 */
router.get('/countries/:id/pilots', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT p.id, p.full_name AS name, p.email, p.role, p.status
             FROM personnel p
             WHERE p.country_id = $1 AND (p.tenant_id = $2 OR p.tenant_id IS NULL)
             ORDER BY p.full_name ASC`,
            [id, req.user.tenantId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[country/pilots GET]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/regions/countries/:id/pilots
 * Assign a pilot to a country (sets personnel.country_id)
 */
router.post('/countries/:id/pilots', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;       // country id
        const { personnelId } = req.body;
        if (!personnelId) return res.status(400).json({ success: false, message: 'personnelId required' });

        await db.query(
            `UPDATE personnel SET country_id = $1 WHERE id = $2 AND (tenant_id = $3 OR tenant_id IS NULL)`,
            [id, personnelId, req.user.tenantId]
        );
        res.json({ success: true, message: 'Pilot assigned to country' });
    } catch (err) {
        console.error('[country/pilots POST]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/regions/countries/:id/pilots/:personnelId
 * Remove a pilot from a country (sets country_id to NULL)
 */
router.delete('/countries/:id/pilots/:personnelId', protect, authorize('admin'), async (req, res) => {
    try {
        const { personnelId } = req.params;
        await db.query(
            `UPDATE personnel SET country_id = NULL WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
            [personnelId, req.user.tenantId]
        );
        res.json({ success: true, message: 'Pilot removed from country' });
    } catch (err) {
        console.error('[country/pilots DELETE]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/regions/countries/:id/available-pilots
 * Returns personnel NOT yet assigned to this country
 */
router.get('/countries/:id/available-pilots', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT p.id, p.full_name AS name, p.email, p.role, p.status
             FROM personnel p
             WHERE (p.country_id != $1 OR p.country_id IS NULL)
               AND (p.tenant_id = $2 OR p.tenant_id IS NULL)
             ORDER BY p.full_name ASC`,
            [id, req.user.tenantId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[country/available-pilots]', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;

