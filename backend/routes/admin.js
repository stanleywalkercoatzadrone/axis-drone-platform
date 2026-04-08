/**
 * AXIS INTELLIGENCE MODULE — Admin-Only Routes
 * 
 * New routes ONLY. Does not modify any existing routes.
 * All routes require: authenticated + admin role.
 * 
 * Routes:
 *   POST   /api/admin/missions/:missionId/intelligence          — Generate + save intel report
 *   GET    /api/admin/missions/:missionId/intelligence          — Fetch latest intel record
 *   POST   /api/admin/missions/:missionId/intelligence/simulate — Run scenario simulation
 */

import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { generateMissionIntel, getLatestMissionIntel, getMissionSimulations } from '../services/axisIntelEngine.js';
import { query } from '../config/database.js';

const router = express.Router();

// All admin routes require authentication
router.use(protect);

// All admin routes require admin role
router.use(authorize('admin', 'ADMIN'));

// ─────────────────────────────────────────────────────────────
// POST /api/admin/missions/:missionId/intelligence
// Generate AI intelligence report for a mission
// ─────────────────────────────────────────────────────────────
router.post('/missions/:missionId/intelligence', async (req, res) => {
    const { missionId } = req.params;

    if (!missionId) {
        return res.status(400).json({ success: false, message: 'missionId is required' });
    }

    try {
        const result = await generateMissionIntel(missionId, null);

        if (!result.success) {
            return res.status(422).json({
                success: false,
                message: result.error || 'Intel generation failed',
                missionId
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Axis Intelligence Report generated',
            data: result
        });

    } catch (err) {
        console.error('[AdminRoute] /intelligence POST error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Internal error during intelligence generation'
        });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/admin/missions/:missionId/intelligence
// Fetch latest persisted intelligence record + simulations
// ─────────────────────────────────────────────────────────────
router.get('/missions/:missionId/intelligence', async (req, res) => {
    const { missionId } = req.params;

    try {
        const [intel, simulations] = await Promise.all([
            getLatestMissionIntel(missionId),
            getMissionSimulations(missionId)
        ]);

        return res.status(200).json({
            success: true,
            data: {
                intel: intel || null,
                simulations: simulations || [],
                missionId
            }
        });

    } catch (err) {
        console.error('[AdminRoute] /intelligence GET error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch intelligence data'
        });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/admin/missions/:missionId/intelligence/simulate
// Run a scenario simulation with overrides
// Does NOT overwrite primary intel record
// ─────────────────────────────────────────────────────────────
router.post('/missions/:missionId/intelligence/simulate', async (req, res) => {
    const { missionId } = req.params;
    const overrides = req.body || {};

    // Validate override fields
    const allowedOverrides = ['pilotCount', 'windSpeed', 'defectProbability', 'startDelayDays'];
    const receivedKeys = Object.keys(overrides);
    const invalidKeys = receivedKeys.filter(k => !allowedOverrides.includes(k));

    if (invalidKeys.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Invalid simulation parameters: ${invalidKeys.join(', ')}. Allowed: ${allowedOverrides.join(', ')}`
        });
    }

    if (receivedKeys.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'At least one simulation override parameter is required'
        });
    }

    try {
        const result = await generateMissionIntel(missionId, overrides);

        if (!result.success) {
            return res.status(422).json({
                success: false,
                message: result.error || 'Simulation failed',
                missionId
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Simulation complete — results saved to simulation log (original record unchanged)',
            data: result
        });

    } catch (err) {
        console.error('[AdminRoute] /intelligence/simulate POST error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Internal error during simulation'
        });
    }
});

export default router;
