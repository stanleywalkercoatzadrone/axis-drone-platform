import express from 'express';
import { protect, authorize } from '../../middleware/auth.js';
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
router.post('/configs', authorize('ADMIN'), createOnboardingConfig);
router.get('/configs/:id', getOnboardingConfig);
router.put('/configs/:id', authorize('ADMIN'), updateOnboardingConfig);

// Settings & Progress
router.get('/:clientId/settings', getClientSettings);
router.put('/:clientId/settings', authorize('ADMIN'), updateClientSettings);
router.put('/:id/step', authorize('ADMIN'), updateOnboardingStep);

export default router;
