/**
 * LBD Routes
 * Role-based access for Line-By-line Defect tracking
 */
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getLBDForProject,
    createLBDEntry,
    updateLBDEntry,
    getLBDAnalytics,
} from '../controllers/lbdController.js';

const router = express.Router();

// Admin only — aggregate analytics
router.get('/analytics', protect, authorize('admin'), getLBDAnalytics);

// Admin + Pilot + Client — read per project
router.get('/:projectId',
    protect,
    authorize('admin', 'pilot_technician', 'pilot', 'field_operator', 'senior_inspector', 'client', 'client_user', 'customer'),
    getLBDForProject
);

// Admin + Pilot — write
router.post('/',
    protect,
    authorize('admin', 'pilot_technician', 'pilot', 'field_operator', 'senior_inspector'),
    createLBDEntry
);

router.put('/:id',
    protect,
    authorize('admin', 'pilot_technician', 'pilot', 'field_operator', 'senior_inspector'),
    updateLBDEntry
);

export default router;
