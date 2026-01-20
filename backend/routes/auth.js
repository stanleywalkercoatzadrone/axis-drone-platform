import express from 'express';
import { register, login, logout, getMe, updateMe, refreshAccessToken, updatePassword } from '../controllers/authController.js';
import { getGoogleAuthUrl, googleCallback, linkGoogleDrive, unlinkGoogleDrive } from '../controllers/googleAuthController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.post('/refresh', refreshAccessToken);
router.put('/password', protect, updatePassword);

// Google OAuth routes
router.get('/google', getGoogleAuthUrl);
router.get('/google/callback', googleCallback);
router.post('/google/link', protect, linkGoogleDrive);
router.post('/google/unlink', protect, unlinkGoogleDrive);

export default router;
