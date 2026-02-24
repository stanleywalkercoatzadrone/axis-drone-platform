import express from 'express';
import { uploadImage as uploadController, analyzeImage, updateAnnotations, deleteImage } from '../controllers/imageController.js';
import { protect } from '../middleware/auth.js';
import { uploadMultiple } from '../utils/fileUpload.js';

const router = express.Router();

router.use(protect);

router.post('/upload', uploadMultiple, uploadController);
router.post('/:id/analyze', analyzeImage);
router.put('/:id/annotations', updateAnnotations);
router.delete('/:id', deleteImage);

export default router;
