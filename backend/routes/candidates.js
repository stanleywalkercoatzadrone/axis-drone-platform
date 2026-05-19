import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    sendCandidatePacket,
    getCandidatePacket,
    submitCandidatePacket,
    getCandidateUploadUrl,
    listCandidatePackets,
    sendPreOnboardingDocs
} from '../controllers/candidateController.js';

const router = express.Router();

// --- Public Endpoints (Token Based) ---
router.get('/public/:token', getCandidatePacket);
router.post('/public/:token/upload-url', getCandidateUploadUrl);
router.post('/public/:token/submit', submitCandidatePacket);

// --- Admin Endpoints ---
router.use(protect);
router.use(authorize('ADMIN'));

router.post('/send', sendCandidatePacket);
router.post('/send-docs', sendPreOnboardingDocs);
router.get('/', listCandidatePackets);

// DELETE /api/candidates/:id — hard-delete a candidate packet
router.delete('/:id', async (req, res) => {
    try {
        const { query } = await import('../config/database.js');
        const result = await query(
            `DELETE FROM candidate_packets WHERE id = $1 RETURNING id`,
            [req.params.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }
        res.json({ success: true, message: 'Candidate deleted' });
    } catch (e) {
        console.error('[DELETE /candidates/:id]', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;
