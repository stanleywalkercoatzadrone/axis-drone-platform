import express from 'express';
import { getSites, getAssets, getSiteById } from '../controllers/assetController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply protection to all routes
router.use(protect);

router.get('/sites', getSites);
router.get('/sites/:id', getSiteById);
router.get('/', getAssets);

export default router;
