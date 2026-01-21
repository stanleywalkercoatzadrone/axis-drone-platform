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

// Import services
import { logger } from './services/logger.js';

// Import socket handlers
import { initializeSocketHandlers } from './sockets/index.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
    }
});

const PORT = process.env.PORT || process.env.BACKEND_PORT || 8080;

// Security middleware with CSP enabled
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Vite in dev
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

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(compression());

// Custom morgan format with logger integration
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim(), { category: 'http' })
    }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Axis Backend',
        version: '1.0.0'
    });
});

// Apply standard rate limiting to all API routes
app.use('/api/', standardLimiter);

// API v1 Routes (AI Intelligence Layer)
app.use('/api/v1', v1Routes);

// API Routes with specific rate limiters
app.use('/api/auth', authLimiter, authRoutes); // Strict limiter for auth
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

// Initialize Socket.io handlers
initializeSocketHandlers(io);

// Error handling
// Note: We place notFound after API routes but BEFORE the wildcard handler 
// so unknown API routes get a 404 JSON response.
app.use('/api/*', notFound);
app.use(errorHandler);

// Serve static files from the 'dist' directory (Production only or when needed)
// Navigate up one level from 'backend' to find 'dist'
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// SPA Fallback: Serve index.html for any other non-API requests
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info('Axis Backend started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
    logger.info(`Health check available at http://localhost:${PORT}/health`);
    logger.info('WebSocket server initialized');
});

export { io };
