import express from 'express';
import { getWorkItems, updateWorkItemStatus, addWorkItemNote, getWorkItemUpdates, addWorkItemAsset } from '../controllers/workItemController.js';
import { protect } from '../middleware/auth.js';
import { uploadSingle } from '../utils/fileUpload.js';

const router = express.Router();

router.use(protect);

router.get('/', getWorkItems);
router.patch('/:id/status', updateWorkItemStatus);
router.post('/:id/notes', addWorkItemNote);
router.get('/:id/updates', getWorkItemUpdates);
router.post('/:id/assets', uploadSingle, addWorkItemAsset);

export default router;
