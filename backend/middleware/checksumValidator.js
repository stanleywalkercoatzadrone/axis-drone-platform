/**
 * Checksum Validator Middleware — Axis Enterprise Platform
 *
 * Validates the SHA-256 checksum of uploaded files when the client provides
 * the X-File-Checksum header. Non-breaking: if header is absent, passes through.
 *
 * Client Usage:
 *   const checksum = await crypto.subtle.digest('SHA-256', fileBuffer);
 *   headers['X-File-Checksum'] = bufferToHex(checksum);
 *
 * Server:
 *   import { checksumValidator } from '../middleware/checksumValidator.js';
 *   router.post('/upload', protect, checksumValidator, uploadHandler);
 */

import crypto from 'crypto';

/**
 * Validate file checksum if X-File-Checksum header is present.
 * Requires multer to have already processed the file (req.file or req.files).
 * Non-breaking: passes through if no checksum header or no file.
 */
export const checksumValidator = (req, res, next) => {
    const providedChecksum = req.headers['x-file-checksum'];

    // Non-breaking: no header = skip validation
    if (!providedChecksum) {
        return next();
    }

    // Get file buffer (multer memory storage)
    const file = req.file || req.files?.[0];
    if (!file || !file.buffer) {
        return next(); // No file yet (streaming upload, or wrong middleware order)
    }

    const computedChecksum = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');

    if (computedChecksum.toLowerCase() !== providedChecksum.toLowerCase()) {
        return res.status(400).json({
            success: false,
            error: 'File integrity check failed. Checksum mismatch.',
            expected: providedChecksum,
            computed: computedChecksum,
            requestId: req.requestId,
        });
    }

    // Attach checksum to file object for controller use
    file.sha256 = computedChecksum;
    next();
};

/**
 * Compute SHA-256 checksum of a buffer. Utility for controllers.
 * @param {Buffer} buffer
 * @returns {string} hex checksum
 */
export const computeChecksum = (buffer) =>
    crypto.createHash('sha256').update(buffer).digest('hex');
