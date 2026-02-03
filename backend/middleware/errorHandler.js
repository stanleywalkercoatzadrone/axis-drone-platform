import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Write crucial error details to a specific log file we can read
    const logPath = path.join(__dirname, '../../latest_error.log');
    const timestamp = new Date().toISOString();
    const logData = `[${timestamp}] ${err.stack || err.message}\nRequest: ${req.method} ${req.originalUrl}\nBody: ${JSON.stringify(req.body)}\n-------------------\n`;

    try {
        fs.appendFileSync(logPath, logData);
        // Also overwrite a 'last_error.txt' for easy single-read
        fs.writeFileSync(path.join(__dirname, '../../last_error.txt'), logData);
    } catch (e) {
        console.error('Failed to write error log:', e);
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        error: {
            message
        }
    });
};

export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
