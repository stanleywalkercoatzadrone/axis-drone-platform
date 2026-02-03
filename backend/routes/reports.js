import express from 'express';
import { getReports, getReport, createReport, updateReport, finalizeReport, deleteReport } from '../controllers/reportController.js';
import { protect, authorizePerm } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

const jsonLarge = express.json({ limit: '100mb' });

router.get('/', getReports);
router.get('/:id', getReport);
router.post('/', jsonLarge, authorizePerm('CREATE_REPORT'), createReport);
router.put('/:id', jsonLarge, authorizePerm('EDIT_REPORT'), updateReport);
router.post('/:id/finalize', authorizePerm('FINALIZE_REPORT'), finalizeReport);
router.delete('/:id', authorizePerm('DELETE_REPORT'), deleteReport);

export default router;
