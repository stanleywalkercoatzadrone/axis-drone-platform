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
router.post('/portal/:token/upload', upload.single('document'), onboardingController.uploadDocument);

export default router;
