/**
 * Mission Routes
 * RBAC-protected endpoints for mission management
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    createMission,
    assignPilot,
    getAllMissions,
    getAssignedMissions,
    getCompletedMissions,
    getMissionKML,
} from '../controllers/missionController.js';

const router = express.Router();

// Admin only
router.post('/create', protect, authorize('admin'), createMission);
router.post('/assign', protect, authorize('admin'), assignPilot);
router.get('/', protect, authorize('admin'), getAllMissions);

// Admin + Pilot
router.get('/assigned', protect, authorize('admin', 'pilot_technician', 'pilot', 'field_operator', 'senior_inspector'), getAssignedMissions);
router.get('/kml/:missionId', protect, authorize('admin', 'pilot_technician', 'pilot', 'field_operator', 'senior_inspector'), getMissionKML);

// Admin + Pilot + Client
router.get('/completed', protect, authorize('admin', 'pilot_technician', 'pilot', 'field_operator', 'senior_inspector', 'client', 'client_user', 'customer'), getCompletedMissions);

export default router;
