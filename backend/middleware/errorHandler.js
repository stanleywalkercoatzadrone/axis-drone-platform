import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const errorHandler = (err, req, res, next) => {
    // Log invalid/unhandled errors to console
    console.error("🔥 UNHANDLED ERROR:", err);

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
    const stack = process.env.NODE_ENV === 'development' ? err.stack : undefined;

    // If the request expects JSON (API) → send JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1) || req.path.startsWith('/api/')) {
        return res.status(statusCode).json({
            success: false,
            message,
            stack
        });
    }

    // Otherwise render a friendly error page
    res.status(statusCode).render('error', {
        title: statusCode === 404 ? 'Page Not Found' : 'Something went wrong',
        message,
        stack,
        tryAgainUrl: req.originalUrl,
        homeUrl: '/'
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
