import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    getSessions,
    startSession,
    endSession,
    pauseWeather,
    resumeSession,
    adminOverride,
    getTimeline,
    editSession
} from '../controllers/missionSessionController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET  /api/sessions/:missionId           — list all sessions (pilots + admins)
router.get('/:missionId', getSessions);

// POST /api/sessions/:missionId/start     — pilots start a session
router.post('/:missionId/start', startSession);

// POST /api/sessions/:missionId/end       — pilots end a session
router.post('/:missionId/end', endSession);

// POST /api/sessions/:missionId/pause-weather — pilots pause for weather
router.post('/:missionId/pause-weather', pauseWeather);

// POST /api/sessions/:missionId/resume    — pilots resume a paused mission
router.post('/:missionId/resume', resumeSession);

// GET  /api/sessions/:missionId/timeline  — Phase 4 event log
router.get('/:missionId/timeline', getTimeline);

// PATCH /api/sessions/:missionId/override — admin manual override
router.patch('/:missionId/override', adminOverride);  // controller checks role internally

// PATCH /api/sessions/:missionId/session/:sessionId — edit individual session fields
router.patch('/:missionId/session/:sessionId', editSession);

export default router;
