import express from 'express';
import { uploadImage, analyzeImage, updateAnnotations, deleteImage, getImageMetadata } from '../controllers/imageController.js';
import { protect } from '../middleware/auth.js';
import { uploadSingle } from '../utils/fileUpload.js';

const router = express.Router();

router.use(protect);

router.post('/upload', uploadSingle, uploadImage);
router.get('/metadata', getImageMetadata);
router.post('/:id/analyze', analyzeImage);
router.put('/:id/annotations', updateAnnotations);
router.delete('/:id', deleteImage);

export default router;
