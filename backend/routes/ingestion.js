import express from 'express';
const router = express.Router();
import * as ingestionController from '../controllers/ingestionController.js';
import { protect } from '../middleware/auth.js';

// All routes require authentication
router.use(protect);

router.post('/jobs', ingestionController.createJob);
router.get('/jobs', ingestionController.listJobs);
router.get('/jobs/:id', ingestionController.getJob);
router.post('/jobs/:id/files', ingestionController.addFiles);
router.post('/jobs/:id/exceptions', ingestionController.createException);

export default router;
