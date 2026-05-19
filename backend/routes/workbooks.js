import express from 'express';
import multer from 'multer';
import { uploadWorkbook, processWorkbook, getMappingTemplates, saveMappingTemplate, getWorkbookHistory } from '../controllers/workbookController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateFileMagicBytes, ALLOWED_DATA_TYPES } from '../utils/fileUpload.js';

const router = express.Router();

// SECURITY: memoryStorage + 10MB cap + magic byte validation
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }  // 10MB — workbooks don't need more
});

router.use(protect);

// Admin only endpoints
router.post('/upload', authorize('ADMIN'), upload.single('file'), async (req, res, next) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
        await validateFileMagicBytes(req.file, ALLOWED_DATA_TYPES);
    } catch (typeErr) {
        return res.status(400).json({ success: false, message: typeErr.message });
    }
    return uploadWorkbook(req, res, next);
});
router.post('/process', authorize('ADMIN'), processWorkbook);
router.post('/templates', authorize('ADMIN'), saveMappingTemplate);
router.get('/templates', authorize('ADMIN'), getMappingTemplates);
router.get('/history', authorize('ADMIN'), getWorkbookHistory);

export default router;
