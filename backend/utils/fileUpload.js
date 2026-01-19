import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Allow images, docs, sheets, kml, etc.
    const allowedTypes = /jpeg|jpg|png|webp|tiff|pdf|csv|xlsx|xls|kml|xml|json|zip|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    // Mimetype check can be tricky for some of these, trust extension for now primarily or check broad implementation
    // For simplicity in this dev environment, if extension matches, we allow.

    if (extname) {
        return cb(null, true);
    } else {
        cb(new AppError('File type not supported', 400));
    }
};

export const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter
});

export const uploadSingle = upload.single('image');
export const uploadMultiple = upload.array('images', 20);
