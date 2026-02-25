import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';
import { getSignedUploadUrl } from '../services/cloudStorage.js';
import { logger } from '../services/logger.js';

// Send a magical link to a new candidate
export const sendCandidatePacket = async (req, res, next) => {
    try {
        const { candidate_email, payload } = req.body;
        if (!candidate_email) throw new AppError('Candidate email is required', 400);

        const token = crypto.randomBytes(32).toString('hex');

        // Expires in 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const result = await pool.query(
            `INSERT INTO candidate_packets (candidate_email, token, status, payload_json, expires_at)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, token`,
            [candidate_email, token, 'sent', payload || {}, expiresAt]
        );

        const packet = result.rows[0];

        // TODO: In production, integrate SendGrid or AWS SES here to actually email the link
        const magicLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/candidate-portal/${token}`;

        logger.info('Candidate packet sent', { email: candidate_email, packetId: packet.id });

        res.status(200).json({
            success: true,
            message: 'Candidate packet generated and sent successfully',
            data: { magicLink, packetId: packet.id } // Send link back for testing/admin copy
        });
    } catch (error) {
        next(error);
    }
};

// Public endpoint for candidate to view their packet requirements
export const getCandidatePacket = async (req, res, next) => {
    try {
        const { token } = req.params;

        const result = await pool.query(
            `SELECT id, candidate_email, status, payload_json, expires_at 
             FROM candidate_packets WHERE token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            throw new AppError('Invalid or expired magic link', 404);
        }

        const packet = result.rows[0];

        if (new Date(packet.expires_at) < new Date()) {
            throw new AppError('This secure link has expired', 403);
        }

        // Mark as opened if it's the first time
        if (packet.status === 'sent') {
            await pool.query('UPDATE candidate_packets SET status = $1 WHERE id = $2', ['opened', packet.id]);
            packet.status = 'opened';
        }

        res.status(200).json({
            success: true,
            data: packet
        });
    } catch (error) {
        next(error);
    }
};

// Public endpoint for candidate to upload artifacts and submit packet
export const submitCandidatePacket = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { documents, metadata } = req.body; // Documents array should have storage paths or metadata

        const packetCheck = await pool.query('SELECT id, status FROM candidate_packets WHERE token = $1', [token]);
        if (packetCheck.rows.length === 0) throw new AppError('Invalid token', 404);

        const packetId = packetCheck.rows[0].id;

        // Update the payload/documents and mark as submitted
        await pool.query(
            `UPDATE candidate_packets 
             SET status = 'submitted', 
                 payload_json = jsonb_set(COALESCE(payload_json, '{}'::jsonb), '{submission}', $1::jsonb),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [JSON.stringify({ documents, metadata, submittedAt: new Date().toISOString() }), packetId]
        );

        logger.info('Candidate packet submitted', { packetId });

        res.status(200).json({
            success: true,
            message: 'Packet submitted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Generates an upload URL for candidate docs
export const getCandidateUploadUrl = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { filename, contentType } = req.body;

        const packetCheck = await pool.query('SELECT id FROM candidate_packets WHERE token = $1', [token]);
        if (packetCheck.rows.length === 0) throw new AppError('Invalid token', 404);

        const packetId = packetCheck.rows[0].id;

        // Generate a secure path in GCS 
        const destination = `candidate-uploads/${packetId}/${crypto.randomUUID()}-${filename}`;

        const urlInfo = await getSignedUploadUrl({
            destination,
            contentType
        });

        res.status(200).json({
            success: true,
            data: urlInfo
        });
    } catch (error) {
        next(error);
    }
};

// Admin view for all packets
export const listCandidatePackets = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, candidate_email, status, expires_at, created_at, updated_at 
             FROM candidate_packets ORDER BY created_at DESC`
        );

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};
