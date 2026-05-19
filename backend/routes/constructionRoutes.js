import express from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { protect, authorize } from '../middleware/auth.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: path.join(__dirname, '../../uploads/') });
import {
    getProjects,
    createProject,
    getProjectDetails,
    uploadEvidence,
    deleteEvidence,
    reportIssue,
    generateDailyReport,
    createActionItem,
    updateSettings,
    generateReportDraft,
    updateProjectPhases
} from '../controllers/constructionController.js';

const router = express.Router();

// Apply auth middleware to all construction routes
router.use(protect);

const adminAuth = authorize('admin', 'superadmin', 'internal');
const pilotAuth = authorize('admin', 'superadmin', 'internal', 'pilot', 'pilot_technician', 'PILOT_TECHNICIAN');

router.get('/projects', pilotAuth, getProjects);
router.post('/projects', adminAuth, createProject);
router.get('/projects/:id', pilotAuth, getProjectDetails);
router.post('/projects/:id/evidence', pilotAuth, upload.single('evidence'), uploadEvidence);
router.delete('/projects/:id/evidence/:evidenceId', adminAuth, deleteEvidence);
router.post('/projects/:id/issues', pilotAuth, reportIssue);
router.post('/projects/:id/reports', adminAuth, generateDailyReport);
router.post('/projects/:id/action-items', adminAuth, createActionItem);
router.put('/projects/:id/settings', adminAuth, updateSettings);
router.post('/projects/:id/reports/generate', adminAuth, generateReportDraft);
router.post('/projects/:id/phases/config', adminAuth, updateProjectPhases);

export default router;
