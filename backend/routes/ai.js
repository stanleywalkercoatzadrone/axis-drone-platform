import express from 'express';
import { getAnalysisResults, logDecision, getPromptTemplates, generateText } from '../controllers/aiController.js';
import { protect, authorize } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply protection to all AI routes
router.use(protect);

router.get('/analysis/:reportId', getAnalysisResults);
router.get('/templates', authorize('ADMIN'), getPromptTemplates);
router.post('/generate-text', aiLimiter, generateText);

// Logging decisions often happens from background processes or automated workflows
router.post('/log-decision', aiLimiter, logDecision);

export default router;
