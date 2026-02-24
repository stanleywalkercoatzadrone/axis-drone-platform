/**
 * Onboarding Routes
 */

import express from 'express';
import * as onboardingController from '../controllers/onboardingController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../utils/fileUpload.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/send', protect, onboardingController.sendOnboardingPackage);
router.get('/packages', protect, onboardingController.getAllPackages);
router.get('/packages/:personnelId', protect, onboardingController.getPackageByPersonnelId);

// Public routes (no authentication - accessed via secure token)
router.get('/portal/:token', onboardingController.getOnboardingPortal);
router.post('/portal/:token/upload', upload.array('files', 10), onboardingController.uploadDocument);
router.post('/portal/:token/complete', onboardingController.completeOnboardingPackage);

// Client Onboarding Wizard Routes
router.post('/configs', protect, onboardingController.createOnboardingConfig);
router.get('/configs/:id', protect, onboardingController.getOnboardingConfig);
router.put('/configs/:id', protect, onboardingController.updateOnboardingConfig);
router.put('/:clientId/settings', protect, onboardingController.updateClientSettings);
router.get('/:clientId/settings', protect, onboardingController.getClientSettings);
router.put('/:id/step', protect, onboardingController.updateOnboardingStep);

export default router;
