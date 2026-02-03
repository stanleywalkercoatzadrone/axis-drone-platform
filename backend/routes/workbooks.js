import express from 'express';
import multer from 'multer';
import { uploadWorkbook, processWorkbook, getMappingTemplates, saveMappingTemplate, getWorkbookHistory } from '../controllers/workbookController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(protect);

// Admin only endpoints
router.post('/upload', authorize('ADMIN'), upload.single('file'), uploadWorkbook);
router.post('/process', authorize('ADMIN'), processWorkbook);
router.post('/templates', authorize('ADMIN'), saveMappingTemplate);
router.get('/templates', authorize('ADMIN'), getMappingTemplates);
router.get('/history', authorize('ADMIN'), getWorkbookHistory);

export default router;
