import express from 'express';
import { syncToVault, getSyncLogs } from '../controllers/syncController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/vault', syncToVault);
router.get('/logs/:reportId', getSyncLogs);

export default router;
