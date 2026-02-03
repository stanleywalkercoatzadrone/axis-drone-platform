import express from 'express';
import { getSystemSettings, updateSystemSetting, linkMasterDrive, unlinkMasterDrive, getSystemHealth } from '../controllers/systemController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/settings', getSystemSettings);
router.get('/health-status', getSystemHealth);
router.put('/settings', updateSystemSetting);
router.post('/settings', updateSystemSetting);
router.post('/master-drive/link', linkMasterDrive);
router.post('/master-drive/unlink', unlinkMasterDrive);

export default router;
