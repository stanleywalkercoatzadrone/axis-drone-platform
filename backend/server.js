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

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

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

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for now to avoid issues with inline scripts/styles
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
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

// API Routes
app.use('/api/auth', authRoutes);
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
    console.log(`🚀 Axis Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔌 WebSocket server ready`);
});

export { io };
