import express from 'express';
import { runMigration } from '../controllers/migrationController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// ── All migration routes require authentication + admin role ──────────────────
// SECURITY: Removed hardcoded secret 'axis2026' — anyone with the secret could
// run arbitrary migrations or reset any user's password.
// Now enforced via JWT protect + admin RBAC like all other sensitive routes.
router.use(protect);
router.use(authorize('admin', 'ADMIN'));

// POST /api/migrations/run  — Execute a named migration
router.post('/run', runMigration);

// NOTE: The /reset-user-pass endpoint has been permanently removed.
// Reason: It allowed arbitrary user password resets via a hardcoded query-param
// secret, leaked all user emails on failed lookups, and had no rate limiting.
// Use the Admin Dashboard → Users panel to manage user passwords.

export default router;
