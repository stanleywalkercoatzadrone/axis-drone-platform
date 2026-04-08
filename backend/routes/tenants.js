import express from 'express';
import {
    registerTenant,
    getMyTenant,
    getTenantUsers,
    inviteUserToTenant,
} from '../controllers/tenantController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────────────────
// Self-serve org registration (no auth required)
router.post('/register', registerTenant);

// ── Protected ──────────────────────────────────────────────────────────────
router.use(protect);

// Any authenticated user can view their own org
router.get('/me', getMyTenant);

// Admin-only: manage users within this org
router.get('/me/users', authorize('admin'), getTenantUsers);
router.post('/me/invite', authorize('admin'), inviteUserToTenant);

export default router;
