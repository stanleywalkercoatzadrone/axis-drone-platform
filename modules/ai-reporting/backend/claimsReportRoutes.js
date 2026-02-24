/**
 * Enterprise AI Insurance Report Generator — Routes
 * Module: /modules/ai-reporting
 */

import express from 'express';
import multer from 'multer';
import {
    listReports, getReport, createReport, updateReport, deleteReport,
    uploadReportImages, analyzeReportImage, generateNarrative,
    finalizeReport, addComment, resolveComment, updateApproval,
    getPortfolioDashboard
} from './claimsReportController.js';
import { protect } from '../../../backend/middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(protect);

// Portfolio dashboard
router.get('/dashboard', getPortfolioDashboard);

// Report CRUD
router.get('/', listReports);
router.post('/', createReport);
router.get('/:id', getReport);
router.put('/:id', updateReport);
router.delete('/:id', deleteReport);

// Images
router.post('/:id/images', upload.array('images', 50), (req, res, next) => {
    req.body.reportId = req.params.id;
    uploadReportImages(req, res, next);
});

// AI
router.post('/images/:id/analyze', analyzeReportImage);
router.post('/:id/generate-narrative', generateNarrative);

// Workflow
router.post('/:id/finalize', finalizeReport);
router.put('/:id/approval', updateApproval);

// Collaboration
router.post('/:id/comments', addComment);
router.put('/:id/comments/:commentId/resolve', resolveComment);

export default router;
