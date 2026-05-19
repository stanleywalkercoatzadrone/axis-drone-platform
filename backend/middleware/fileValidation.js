/**
 * fileValidation.js
 * Global reusable file validation middleware factory.
 *
 * Usage:
 *   import { validateFileMiddleware } from '../middleware/fileValidation.js';
 *   import { ALLOWED_IMAGE_TYPES } from '../utils/fileUpload.js';
 *
 *   router.post('/upload',
 *     upload.single('file'),
 *     validateFileMiddleware(ALLOWED_IMAGE_TYPES),
 *     myController
 *   );
 *
 * SECURITY:
 *   - Reads actual binary magic bytes via file-type (NOT Content-Type header)
 *   - Attaches req.file.detectedType for downstream use
 *   - Rejects immediately if MIME not in allowedTypes
 */

import { validateFileMagicBytes } from '../utils/fileUpload.js';

/**
 * Express middleware factory — validates file magic bytes against an allowlist.
 * @param {Set} allowedTypes  - Set of allowed MIME strings (from fileUpload.js exports)
 * @param {object} [options]
 * @param {boolean} [options.required=true]  - If false, passes through when no file present
 */
export const validateFileMiddleware = (allowedTypes, { required = true } = {}) => {
    return async (req, res, next) => {
        try {
            if (!req.file || !req.file.buffer) {
                if (required) {
                    return res.status(400).json({ success: false, message: 'No file provided' });
                }
                return next();
            }

            const detected = await validateFileMagicBytes(req.file, allowedTypes);

            // Attach detected type for downstream controllers
            req.file.detectedType = detected;

            return next();
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'File validation failed'
            });
        }
    };
};

/**
 * Middleware factory for multi-file uploads (req.files array).
 * Validates every file in the array against the allowlist.
 * @param {Set} allowedTypes
 */
export const validateFilesMiddleware = (allowedTypes) => {
    return async (req, res, next) => {
        const files = req.files || [];
        if (files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files provided' });
        }

        for (const file of files) {
            try {
                const detected = await validateFileMagicBytes(file, allowedTypes);
                file.detectedType = detected;
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: `File "${file.originalname}" rejected: ${err.message}`
                });
            }
        }

        return next();
    };
};
