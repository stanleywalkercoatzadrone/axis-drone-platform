/**
 * pilotMetrics.js — Routes for Phase 8 pilot metrics/scoring
 */
import express from 'express';
import { getPilotMetrics, getLeaderboard } from '../controllers/pilotMetricsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/leaderboard', protect, getLeaderboard);
router.get('/:pilotId', protect, getPilotMetrics);

export default router;
