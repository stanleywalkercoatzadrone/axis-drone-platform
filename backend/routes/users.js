import express from 'express';
import { getUsers, createUser, batchCreateUsers, updateUser, deleteUser, resetUserPassword } from '../controllers/userController.js';
import { protect, authorize, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes require authentication

router.get('/', authorize('ADMIN'), getUsers);
router.post('/', authorize('ADMIN'), checkPermission('MANAGE_USERS'), createUser);
router.post('/batch', authorize('ADMIN'), checkPermission('MANAGE_USERS'), batchCreateUsers);
router.put('/:id', authorize('ADMIN'), checkPermission('MANAGE_USERS'), updateUser);
router.post('/:id/reset-password', authorize('ADMIN'), checkPermission('MANAGE_USERS'), resetUserPassword);
router.delete('/:id', authorize('ADMIN'), checkPermission('MANAGE_USERS'), deleteUser);

export default router;
