import express from 'express';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';
import { 
    createOnboardingConfig, 
    getOnboardingConfig, 
    updateOnboardingConfig,
    getClientSettings,
    updateClientSettings,
    updateOnboardingStep
} from '../../controllers/onboardingController.js';

const router = express.Router();

router.use(protect);

// Configs (Internal/Admin)
router.post('/configs', restrictTo('ADMIN'), createOnboardingConfig);
router.get('/configs/:id', getOnboardingConfig);
router.put('/configs/:id', restrictTo('ADMIN'), updateOnboardingConfig);

// Settings & Progress
router.get('/:clientId/settings', getClientSettings);
router.put('/:clientId/settings', restrictTo('ADMIN'), updateClientSettings);
router.put('/:id/step', restrictTo('ADMIN'), updateOnboardingStep);

export default router;
