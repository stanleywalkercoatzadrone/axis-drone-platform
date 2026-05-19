/**
 * API v1 - Missions Intelligence Routes
 */

import express from 'express';
import { protect, authorizePerm } from '../../middleware/auth.js';
import { aggregateMissionData } from '../../services/intelligenceAggregator.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

/**
 * GET /api/v1/missions/:id/intelligence
 * Aggregates all environmental and technical data for a mission.
 * Used for automated report population.
 */
router.get('/:id/intelligence', protect, authorizePerm('CREATE_REPORT'), async (req, res, next) => {
    try {
        const { id } = req.params;

        logger.info('Fetching mission intelligence', { 
            missionId: id, 
            userId: req.user.id 
        });

        const intelligence = await aggregateMissionData(id);

        res.status(200).json({
            success: true,
            version: '1.0',
            data: intelligence
        });
    } catch (error) {
        logger.error('Failed to aggregate mission intelligence', { 
            missionId: req.params.id, 
            error: error.message 
        });
        next(error);
    }
});

export default router;
