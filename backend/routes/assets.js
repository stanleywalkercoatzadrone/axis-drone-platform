import express from 'express';
import {
    getSites,
    getSiteById,
    getAssets,
    getAssetById,
    updateAsset,
    getAssetEvents
} from '../controllers/assetController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// Site Context Routes
router.get('/sites', getSites);
router.get('/sites/:id', getSiteById);

// Asset Grid Routes
// GET /api/assets/sites/:siteId/assets
router.get('/sites/:siteId/assets', getAssets);

// Individual Asset Operations
// GET /api/assets/:id
router.get('/:id', getAssetById);
// PATCH /api/assets/:id
router.patch('/:id', updateAsset);
// GET /api/assets/:id/events
router.get('/:id/events', getAssetEvents);

export default router;
