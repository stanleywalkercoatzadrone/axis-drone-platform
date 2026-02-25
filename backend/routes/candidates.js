import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    sendCandidatePacket,
    getCandidatePacket,
    submitCandidatePacket,
    getCandidateUploadUrl,
    listCandidatePackets
} from '../controllers/candidateController.js';

const router = express.Router();

// --- Public Endpoints (Token Based) ---
router.get('/public/:token', getCandidatePacket);
router.post('/public/:token/upload-url', getCandidateUploadUrl);
router.post('/public/:token/submit', submitCandidatePacket);

// --- Admin Endpoints ---
router.use(protect);
router.use(authorize('ADMIN'));

router.post('/send', sendCandidatePacket);
router.get('/', listCandidatePackets);

export default router;
