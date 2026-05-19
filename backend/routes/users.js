import express from 'express';
import { getUsers, createUser, batchCreateUsers, updateUser, deleteUser, resetUserPassword, resendUserInvite } from '../controllers/userController.js';
import { protect, authorize, authorizePerm } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes require authentication

router.get('/', authorize('ADMIN'), getUsers);
router.post('/', authorize('ADMIN'), authorizePerm('MANAGE_USERS'), createUser);
router.post('/batch', authorize('ADMIN'), authorizePerm('MANAGE_USERS'), batchCreateUsers);
router.put('/:id', authorize('ADMIN'), authorizePerm('MANAGE_USERS'), updateUser);
router.post('/:id/reset-password', authorize('ADMIN'), authorizePerm('MANAGE_USERS'), resetUserPassword);
router.delete('/:id', authorize('ADMIN'), authorizePerm('MANAGE_USERS'), deleteUser);
router.post('/:id/resend-invite', authorize('ADMIN'), authorizePerm('MANAGE_USERS'), resendUserInvite);

export default router;
