import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as pricingController from '../controllers/claimsPricingController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// --- CATALOG ROUTES ---
router.get('/categories', pricingController.getPricingCategories);
router.get('/items', pricingController.getPricingItems);

// --- REPORT LINE ITEMS ROUTES ---
router.get('/reports/:reportId/items', pricingController.getReportLineItems);
router.post('/reports/:reportId/items', pricingController.addReportLineItem);
router.put('/reports/:reportId/items/:itemId', pricingController.updateReportLineItem);
router.delete('/reports/:reportId/items/:itemId', pricingController.deleteReportLineItem);

export default router;
