import express from 'express';
import { register, login, logout, getMe, updateMe, refreshAccessToken, updatePassword, verifyInvitationToken, setPasswordWithToken } from '../controllers/authController.js';
import { getGoogleAuthUrl, googleCallback, linkGoogleDrive, unlinkGoogleDrive } from '../controllers/googleAuthController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);

// Public self-service signup for clients — no admin secret required
router.post('/client-register', async (req, res, next) => {
    req.body.role = 'client';          // force client role
    req.body.adminSecret = undefined;  // no admin secret needed
    req.body.isClientSelfSignup = true;
    next();
}, register);

router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.post('/refresh', refreshAccessToken);
router.post('/refresh-token', refreshAccessToken);
router.put('/password', protect, updatePassword);
router.get('/invitation/:token', verifyInvitationToken);
router.post('/set-password-with-token', setPasswordWithToken);

// Google OAuth routes
router.get('/google', getGoogleAuthUrl);
router.get('/google/callback', googleCallback);
router.post('/google/link', protect, linkGoogleDrive);
router.post('/google/unlink', protect, unlinkGoogleDrive);

export default router;
