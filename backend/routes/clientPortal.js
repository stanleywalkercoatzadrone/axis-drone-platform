import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getClientProjects,
    getClientMissions,
    getClientLBD,
    getClientDeliverables,
    getClientActivity,
} from '../controllers/clientPortalController.js';

const router = express.Router();

const clientAndAdmin = authorize('admin', 'client', 'client_user', 'customer');

router.get('/projects',     protect, clientAndAdmin, getClientProjects);
router.get('/missions',     protect, clientAndAdmin, getClientMissions);
router.get('/lbd',          protect, clientAndAdmin, getClientLBD);
router.get('/deliverables', protect, clientAndAdmin, getClientDeliverables);
router.get('/activity',     protect, clientAndAdmin, getClientActivity);

export default router;
