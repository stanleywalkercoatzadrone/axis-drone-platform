import express from 'express';
import { getSystemSettings, updateSystemSetting, linkMasterDrive, unlinkMasterDrive, getSystemHealth, logError } from '../controllers/systemController.js';
import { protect, authorize } from '../middleware/auth.js';
import { getFlagSummary } from '../config/featureFlags.js';
import { eventBus } from '../events/eventBus.js';
import { workerStatus } from '../workers/aiWorker.js';

const router = express.Router();

// Public logging endpoint
router.post('/log-error', logError);

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/settings', getSystemSettings);
router.get('/health-status', getSystemHealth);
router.put('/settings', updateSystemSetting);
router.post('/settings', updateSystemSetting);
router.post('/master-drive/link', linkMasterDrive);
router.post('/master-drive/unlink', unlinkMasterDrive);

/**
 * GET /api/system/flags
 * Returns current feature flag state. Admin only.
 * Safe to expose — contains no secrets, only boolean values.
 */
router.get('/flags', (req, res) => {
    res.json({
        success: true,
        data: {
            ...getFlagSummary(),
            aiWorker: workerStatus(),
            eventBus: eventBus.stats(),
        },
        requestId: req.requestId,
    });
});

export default router;

