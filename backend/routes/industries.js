import express from 'express';
import { protect } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// GET /api/industries
router.get('/', protect, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM industries ORDER BY name ASC');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching industries:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

export default router;
