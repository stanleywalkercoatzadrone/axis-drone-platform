import express from 'express';
import {
    getAllPersonnel,
    getPersonnelById,
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    getPersonnelAuthorizations,
    updatePersonnelAuthorization,
    getPersonnelBanking,
    updatePersonnelBanking,
    uploadPersonnelDocument,
    getPersonnelDocuments,
    uploadPersonnelPhoto,
    analyzePersonnelDocument,
    getPilotPerformance,
    updatePerformanceConfig,
    getPerformanceConfig
} from '../controllers/personnelController.js';
import { getPilotMatches } from '../controllers/pilotMatchingController.js';
import {
    getPilotAvailability,
    updateAvailability,
    checkAssignmentConflict,
    getSyncStatus
} from '../controllers/availabilityController.js';

import { uploadSingle } from '../utils/fileUpload.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ── Static routes MUST come before /:id wildcard ──────────────────────────────

// GET /api/personnel
router.get('/', getAllPersonnel);

// POST /api/personnel
router.post('/', createPersonnel);

// Performance config (static — must be before /:id)
router.get('/performance/config', getPerformanceConfig);
router.put('/performance/config', updatePerformanceConfig);

// AI analyze-document (static — must be before /:id)
router.post('/analyze-document', uploadSingle, analyzePersonnelDocument);

// AI Pilot Matching (static — must be before /:id)
router.post('/matching', getPilotMatches);

// ── Parameterised routes (:id) ─────────────────────────────────────────────────

// GET /api/personnel/:id
router.get('/:id', getPersonnelById);

// PUT /api/personnel/:id
router.put('/:id', updatePersonnel);

// DELETE /api/personnel/:id
router.delete('/:id', deletePersonnel);

// Authorizations
router.get('/:id/authorizations', getPersonnelAuthorizations);
router.post('/:id/authorizations', updatePersonnelAuthorization);

// Banking
router.get('/:id/banking', getPersonnelBanking);
router.put('/:id/banking', updatePersonnelBanking);

// Documents
router.get('/:id/documents', getPersonnelDocuments);
router.post('/:id/documents', uploadSingle, uploadPersonnelDocument);

// Photo
router.post('/:id/photo', uploadSingle, uploadPersonnelPhoto);

// Performance metrics
router.get('/:id/performance', getPilotPerformance);

// Availability
router.get('/:pilotId/availability', getPilotAvailability);
router.post('/:pilotId/availability', updateAvailability);
router.post('/:pilotId/check-conflict', checkAssignmentConflict);
router.get('/:pilotId/sync-status', getSyncStatus);

export default router;
