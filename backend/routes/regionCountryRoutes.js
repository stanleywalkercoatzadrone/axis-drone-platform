import express from 'express';
import { getRegions, getCountries, toggleCountryStatus } from '../controllers/regionCountryController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getRegions);
router.get('/countries', protect, getCountries);
router.patch('/countries/:id/status', protect, authorize('admin'), toggleCountryStatus);

export default router;
