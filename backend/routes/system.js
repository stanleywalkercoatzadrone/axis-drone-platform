import express from 'express';
import { getSystemSettings, updateSystemSetting, linkMasterDrive, unlinkMasterDrive } from '../controllers/systemController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSetting);
router.post('/master-drive/link', linkMasterDrive);
router.post('/master-drive/unlink', unlinkMasterDrive);

export default router;
