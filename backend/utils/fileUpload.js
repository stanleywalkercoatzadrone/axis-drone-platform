import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Permissive file filter - allows any file
const fileFilter = (req, file, cb) => {
    // We trust the extension and mimetype but don't strictly block anything 
    // to meet the user's "accept any files" requirement.
    cb(null, true);
};

export const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // Increased to 100MB for multiple/video files
    },
    fileFilter
});

// Generic middlewares
export const uploadSingle = upload.single('file'); // Generic field name 'file'
export const uploadMultiple = upload.array('files', 50); // Generic field name 'files', up to 50 files

// Legacy mappings for backward compatibility
export const uploadImage = upload.single('image');
export const uploadImages = upload.array('images', 20);
export const uploadDocument = upload.single('document');
