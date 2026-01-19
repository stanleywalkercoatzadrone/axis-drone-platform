import express from 'express';
import {
    getAllPersonnel,
    getPersonnelById,
    createPersonnel,
    updatePersonnel,
    deletePersonnel
} from '../controllers/personnelController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

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

export default router;
