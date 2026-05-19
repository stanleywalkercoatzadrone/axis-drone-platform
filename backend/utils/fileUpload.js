import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler.js';

// ── Magic-byte MIME validation ─────────────────────────────────────────────────
// SECURITY: Validates actual file binary signature — NOT the Content-Type header,
// which is trivially spoofed. Prevents .exe-disguised-as-.jpg, polyglot files, etc.
// file-type is a pure-ESM package; dynamic import used for compatibility.
let _fileTypeFromBuffer = null;
const getFileTypeFromBuffer = async () => {
    if (!_fileTypeFromBuffer) {
        const ft = await import('file-type');
        _fileTypeFromBuffer = ft.fileTypeFromBuffer;
    }
    return _fileTypeFromBuffer;
};

// Allowed MIME types by upload category
export const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
    'image/gif', 'image/bmp',
]);
export const ALLOWED_DOC_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
    'application/pdf',
]);
export const ALLOWED_DATA_TYPES = new Set([
    'application/zip', 'application/octet-stream',  // KMZ, LAS, LAZ
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
]);

/**
 * Validate a multer file object by reading its actual binary magic bytes.
 * @param {object} file            - multer file (must have file.buffer)
 * @param {Set}    allowedTypes    - set of allowed MIME strings (defaults to images + PDF)
 * @returns {{ mime, ext }}        - detected type info
 * @throws Error on rejected/undetectable types
 */
export const validateFileMagicBytes = async (file, allowedTypes = ALLOWED_DOC_TYPES) => {
    if (!file || !file.buffer || file.buffer.length < 4) {
        throw new AppError('No file buffer available for validation', 400);
    }

    const fileTypeFromBuffer = await getFileTypeFromBuffer();
    const detected = await fileTypeFromBuffer(file.buffer);

    // Some plain-text formats (CSV, KML, XML) have no magic bytes — allow if extension matches known-safe list
    const plainTextExts = new Set(['.csv', '.kml', '.xml', '.json', '.txt', '.md', '.xyz']);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!detected) {
        if (plainTextExts.has(ext)) return { mime: 'text/plain', ext: ext.slice(1) };
        throw new AppError('Unable to detect file type — binary signature missing or unrecognised', 400);
    }

    if (!allowedTypes.has(detected.mime)) {
        throw new AppError(`File type rejected: ${detected.mime} is not permitted`, 400);
    }

    return detected;
};

/**
 * Sanitize a filename: strip path traversal, null bytes, dangerous chars, cap length.
 * Returns a UUID-based safe name with a detected-MIME extension.
 */
export const safeFilename = (detectedMime) => {
    const extMap = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
        'image/tiff': '.tiff', 'image/gif': '.gif', 'image/bmp': '.bmp',
        'application/pdf': '.pdf', 'application/zip': '.zip',
    };
    const ext = extMap[detectedMime] || '.bin';
    return `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`;
};

// ── Shared multer config ───────────────────────────────────────────────────────
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = /jpeg|jpg|png|webp|tiff|tif|gif|bmp|svg|pdf|csv|xlsx|xls|xlsm|doc|docx|kml|kmz|xml|json|zip|txt|md|las|laz|ply|pcd|xyz|e57|bin|mp4|mov|avi|mkv|webm/;

// Explicitly block dangerous executables regardless of other checks
const BLOCKED_EXTENSIONS = /\.(exe|sh|bat|cmd|ps1|php|py|rb|pl|js|mjs|cjs|jar|war|dll|so|dylib|dmg|pkg|app|vbs|wsf|hta)$/i;

const fileFilter = (req, file, cb) => {
    // Block dangerous executables first
    if (BLOCKED_EXTENSIONS.test(file.originalname)) {
        return cb(new AppError('File type not permitted (executable files are blocked)', 400));
    }

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED_EXTENSIONS.test(ext)) {
        return cb(null, true);
    }
    cb(new AppError('File type not supported', 400));
};

export const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024  // 50MB
    },
    fileFilter
});

export const uploadSingle   = upload.single('image');
export const uploadFile     = upload.single('file');
export const uploadAny      = upload.any();
export const uploadMultiple = upload.array('images', 20);
