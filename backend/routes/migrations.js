import express from 'express';
import { runMigration } from '../controllers/migrationController.js';

const router = express.Router();

// Emergency Migration Route - uses secret key instead of token
router.post('/run', async (req, res, next) => {
    // Check for secret key in query or headers
    const secret = req.query.secret || req.headers['x-migration-secret'];

    if (secret !== 'axis2026') {
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid secret' });
    }
    next();
}, runMigration);
export default router;
