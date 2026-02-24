import express from 'express';
const router = express.Router();
import * as uploadController from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';

// All routes require authentication
router.use(protect);

router.post('/jobs', uploadController.createJob);
router.get('/jobs', uploadController.listJobs);
router.get('/jobs/:id', uploadController.getJob);
router.post('/jobs/:id/files', uploadController.addFiles);
router.post('/jobs/:id/exceptions', uploadController.createException);

export default router;
