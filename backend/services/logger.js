/**
 * Centralized Logging Service for GCP Cloud Logging
 * Provides structured logging with severity levels and metadata
 */

import { Logging } from '@google-cloud/logging';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Initialize GCP Logging client (only in production)
let logging;
let log;

if (isProduction && process.env.GCP_PROJECT_ID) {
    try {
        logging = new Logging({
            projectId: process.env.GCP_PROJECT_ID
        });
        log = logging.log('axis-backend');
    } catch (error) {
        console.error('Failed to initialize GCP Logging:', error);
    }
}

/**
 * Log levels matching GCP Cloud Logging severity
 */
const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    NOTICE: 'NOTICE',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    CRITICAL: 'CRITICAL',
    ALERT: 'ALERT',
    EMERGENCY: 'EMERGENCY'
};

/**
 * Write log entry to GCP Cloud Logging or console
 */
async function writeLog(severity, message, metadata = {}) {
    const timestamp = new Date().toISOString();

    const logEntry = {
        severity,
        message,
        timestamp,
        ...metadata,
        service: 'axis-backend',
        version: '1.0.0'
    };

    // In development, use console
    if (isDevelopment) {
        const consoleMethod = severity === 'ERROR' || severity === 'CRITICAL' ? 'error' :
            severity === 'WARNING' ? 'warn' : 'log';
        console[consoleMethod](`[${severity}] ${message}`, metadata);
        return;
    }

    // In production, send to GCP Cloud Logging
    if (log) {
        try {
            const entry = log.entry({
                severity,
                resource: {
                    type: 'global'
                }
            }, logEntry);

            await log.write(entry);
        } catch (error) {
            // Fallback to console if GCP logging fails
            console.error('GCP Logging failed:', error);
            console.log(logEntry);
        }
    } else {
        // Fallback to console if GCP not configured
        console.log(logEntry);
    }
}

/**
 * Logger class with convenience methods
 */
class Logger {
    constructor(context = {}) {
        this.context = context;
    }

    // Create a scoped logger with additional context
    child(additionalContext) {
        return new Logger({ ...this.context, ...additionalContext });
    }

    debug(message, metadata = {}) {
        return writeLog(LogLevel.DEBUG, message, { ...this.context, ...metadata });
    }

    info(message, metadata = {}) {
        return writeLog(LogLevel.INFO, message, { ...this.context, ...metadata });
    }

    notice(message, metadata = {}) {
        return writeLog(LogLevel.NOTICE, message, { ...this.context, ...metadata });
    }

    warn(message, metadata = {}) {
        return writeLog(LogLevel.WARNING, message, { ...this.context, ...metadata });
    }

    error(message, metadata = {}) {
        return writeLog(LogLevel.ERROR, message, { ...this.context, ...metadata });
    }

    critical(message, metadata = {}) {
        return writeLog(LogLevel.CRITICAL, message, { ...this.context, ...metadata });
    }

    // Log HTTP request
    logRequest(req, res, duration) {
        const metadata = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('user-agent'),
            ip: req.ip,
            userId: req.user?.id,
            tenantId: req.user?.tenantId
        };

        const severity = res.statusCode >= 500 ? LogLevel.ERROR :
            res.statusCode >= 400 ? LogLevel.WARNING :
                LogLevel.INFO;

        return writeLog(severity, `${req.method} ${req.url}`, metadata);
    }

    // Log AI/LLM operations
    logAIOperation(operation, input, output, metadata = {}) {
        return writeLog(LogLevel.INFO, `AI Operation: ${operation}`, {
            operation,
            inputSize: JSON.stringify(input).length,
            outputSize: JSON.stringify(output).length,
            ...metadata,
            category: 'ai'
        });
    }

    // Log security events
    logSecurityEvent(event, metadata = {}) {
        return writeLog(LogLevel.WARNING, `Security Event: ${event}`, {
            event,
            ...metadata,
            category: 'security'
        });
    }
}

// Create default logger instance
const logger = new Logger();

// Export logger and Logger class
export { Logger, logger, LogLevel };
