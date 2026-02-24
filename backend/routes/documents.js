import express from 'express';
import { getDocuments } from '../controllers/documentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/documents
router.get('/', getDocuments);

export default router;
