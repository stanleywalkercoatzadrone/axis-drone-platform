import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getClients,
    getClient,
    createClient,
    updateClient,
    getStakeholders,
    addStakeholder
} from '../controllers/clientController.js';

const router = express.Router();

router.use(protect);

router.get('/', getClients);
router.post('/', authorize('admin'), createClient);
router.get('/:id', getClient);
router.put('/:id', authorize('admin'), updateClient);
router.get('/:id/stakeholders', getStakeholders);
router.post('/:id/stakeholders', authorize('admin'), addStakeholder);

export default router;
