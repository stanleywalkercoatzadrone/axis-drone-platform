import express from 'express';
import { upload } from '../utils/fileUpload.js';
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
    getMyDocuments,
    uploadMyDocument,
    getPersonnelDocuments,
    uploadPersonnelDocument,
    deletePersonnelDocument,
    uploadPersonnelPhoto,
    viewPersonnelDocument,
    analyzePersonnelDocument,
    getPilotPerformance,
    updatePerformanceConfig,
    getPerformanceConfig,
    initPerformanceDB,
    provisionPilotAccount
} from '../controllers/personnelController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/init/performance-db', initPerformanceDB);

// All routes require authentication
router.use(protect);

// GET /api/personnel - Get all personnel
router.get('/', getAllPersonnel);

// GET /api/personnel/:id - Get personnel by ID
router.get('/:id', getPersonnelById);

// POST /api/personnel - Create new personnel
router.post('/', createPersonnel);

// PUT /api/personnel/:id - Update personnel
router.put('/:id', updatePersonnel);

// DELETE /api/personnel/:id - Delete personnel
router.delete('/:id', deletePersonnel);

// POST /api/personnel/:id/provision - Provision account
router.post('/:id/provision', provisionPilotAccount);

// Banking endpoints
router.get('/:id/banking', getPersonnelBanking);
router.put('/:id/banking', updatePersonnelBanking);

// Authorizations endpoints
router.get('/:id/authorizations', getPersonnelAuthorizations);
router.put('/:id/authorizations', updatePersonnelAuthorization);

// Documents endpoints
router.get('/me/documents', getMyDocuments);
router.post('/me/documents', upload.single('file'), uploadMyDocument);
router.get('/:id/documents', getPersonnelDocuments);
router.post('/:id/documents', upload.single('file'), uploadPersonnelDocument);
router.delete('/:id/documents/:docId', deletePersonnelDocument);
router.get('/:id/documents/:docId/view', viewPersonnelDocument);

// Document Analysis endpoint
router.post('/analyze-document', upload.single('file'), analyzePersonnelDocument);

// Photo endpoint
router.post('/:id/photo', upload.single('file'), uploadPersonnelPhoto);

// Performance endpoints - Note: config overrides must come before :id to prevent capturing 'performance' as an id
router.get('/performance/config', getPerformanceConfig);
router.put('/performance/config', updatePerformanceConfig);
router.get('/:id/performance', getPilotPerformance);

export default router;
