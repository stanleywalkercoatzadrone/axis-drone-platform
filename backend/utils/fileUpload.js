import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler.js';

// Configure multer for memory storage
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
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter
});

export const uploadSingle = upload.single('image');
export const uploadFile = upload.single('file');
export const uploadAny = upload.any();
export const uploadMultiple = upload.array('images', 20);
