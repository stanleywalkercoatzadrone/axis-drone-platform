import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import './config/env.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';
import imageRoutes from './routes/images.js';
import syncRoutes from './routes/sync.js';
import auditRoutes from './routes/audit.js';
import systemRoutes from './routes/system.js';
import personnelRoutes from './routes/personnel.js';
import deploymentRoutes from './routes/deployments.js';
import invoiceRoutes from './routes/invoices.js';
import assetRoutes from './routes/assets.js';
import v1Routes from './routes/v1/index.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { standardLimiter, authLimiter } from './middleware/rateLimiter.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || process.env.BACKEND_PORT || 8080;

// Basic middleware (no external dependencies)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.openai.com", "https://generativelanguage.googleapis.com"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple console logging initially (logger will be initialized after startup)
app.use(morgan('combined'));

// Health check endpoint (no dependencies)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Axis Backend',
        version: '1.0.0'
    });
});

// Apply rate limiting
app.use('/api/', standardLimiter);

// API v1 Routes (AI Intelligence Layer)
app.use('/api/v1', v1Routes);

// API Routes with specific rate limiters
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/assets', assetRoutes);

// Serve static files (frontend)
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback
app.use(notFound);
app.use(errorHandler);

app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// ============================================================================
// CRITICAL: START SERVER IMMEDIATELY (CLOUD RUN REQUIREMENT)
// ============================================================================
// Cloud Run requires the server to bind to PORT within the startup timeout.
// All external service initialization happens AFTER this point.
// ============================================================================

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Axis Backend started');
    console.log(`✅ Listening on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);

    // ========================================================================
    // POST-STARTUP: Initialize external services (non-blocking)
    // ========================================================================
    // These services are initialized AFTER the server is listening.
    // Failures here will be logged but will NOT terminate the process.
    // ========================================================================

    initializeExternalServices();
});

// ============================================================================
// EXTERNAL SERVICE INITIALIZATION (NON-BLOCKING)
// ============================================================================

async function initializeExternalServices() {
    console.log('🔄 Initializing external services...');

    // Initialize logger (GCP Cloud Logging)
    try {
        const { logger } = await import('./services/logger.js');

        // Replace morgan with logger integration
        app.use(morgan('combined', {
            stream: {
                write: (message) => logger.info(message.trim(), { category: 'http' })
            }
        }));

        logger.info('Axis Backend started', {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            version: '1.0.0'
        });

        console.log('✅ Logger initialized');
    } catch (error) {
        console.error('⚠️  Logger initialization failed (non-fatal):', error.message);
        console.log('ℹ️  Continuing with console logging');
    }

    // Initialize Socket.io
    try {
        const io = new Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                credentials: true
            }
        });

        const { initializeSocketHandlers } = await import('./sockets/index.js');
        initializeSocketHandlers(io);

        console.log('✅ WebSocket server initialized');
    } catch (error) {
        console.error('⚠️  Socket.io initialization failed (non-fatal):', error.message);
        console.log('ℹ️  Real-time features will be unavailable');
    }

    // Test database connection
    try {
        const { query } = await import('./config/database.js');
        await query('SELECT 1');
        console.log('✅ Database connection verified');
    } catch (error) {
        console.error('⚠️  Database connection failed (non-fatal):', error.message);
        console.log('ℹ️  Database-dependent features will be unavailable');
    }

    console.log('✅ External services initialization complete');
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📥 SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

export { httpServer };
