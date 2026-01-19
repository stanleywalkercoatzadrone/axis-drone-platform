import express from 'express';
import { getReports, getReport, createReport, updateReport, finalizeReport, deleteReport } from '../controllers/reportController.js';
import { protect, checkPermission } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getReports);
router.get('/:id', getReport);
router.post('/', checkPermission('CREATE_REPORT'), createReport);
router.put('/:id', checkPermission('EDIT_REPORT'), updateReport);
router.post('/:id/finalize', checkPermission('CREATE_REPORT'), finalizeReport);
router.delete('/:id', checkPermission('DELETE_REPORT'), deleteReport);

export default router;
