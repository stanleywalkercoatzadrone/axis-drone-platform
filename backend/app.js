import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import fs from 'fs';
import './config/env.js';

console.log('🔄 Loading App Logic (app.js)...');

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
import onboardingRoutes from './routes/onboarding.js';
import workbookRoutes from './routes/workbooks.js';
import workItemRoutes from './routes/workItems.js';
import clientRoutes from './routes/clients.js';
import industryRoutes from './routes/industries.js';
import uploadRoutes from './routes/uploads.js';
import documentRoutes from './routes/documents.js';
import aiRoutes from './routes/ai.js';
import regionCountryRoutes from './routes/regionCountryRoutes.js';
import v1Routes from './routes/v1/index.js';
import migrationRoutes from './routes/migrations.js';
import claimsReportRoutes from '../modules/ai-reporting/backend/claimsReportRoutes.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { standardLimiter, authLimiter } from './middleware/rateLimiter.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Enable trust proxy for Cloud Run/Load Balancers
app.set('trust proxy', 1);

// Allowed origins for CORS (dev: any localhost port; prod: FRONTEND_URL)
const getAllowedOrigins = () => {
    if (process.env.FRONTEND_URL) return [process.env.FRONTEND_URL];
    // In development, allow any localhost port
    return true; // allows all origins — tighten in production via FRONTEND_URL
};

// Initialize Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: getAllowedOrigins(),
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});


// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:", "https://unpkg.com"],
            connectSrc: ["'self'", "https://api.openai.com", "https://generativelanguage.googleapis.com", "https://api.open-meteo.com", "https://nominatim.openstreetmap.org"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: getAllowedOrigins(),
    credentials: true
}));

app.use(compression());
app.use(morgan('combined'));

// DEBUG REQUEST LOGGER
app.use((req, res, next) => {
    const traceLog = 'api_trace.log';

    // Using a more standard approach if fs is already available or just use console.log which goes to server.log
    console.log(`📡 [DEBUG] ${req.method} ${req.url} - ${new Date().toISOString()}`);

    // Also log to a dedicated file if it's a personnel request
    if (req.url.includes('/personnel')) {
        try {
            const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
            fs.appendFileSync(traceLog, logEntry);
        } catch (e) {
            console.error('Trace logging failed:', e.message);
        }
    }
    next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve static files
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Health check endpoint (ALSO in app.js for redundancy)
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

// API v1 Routes
app.use('/api/v1', v1Routes);

// API Routes
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
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/workbooks', workbookRoutes);
app.use('/api/work-items', workItemRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/industries', industryRoutes);
app.use('/api/regions', regionCountryRoutes);

app.use('/api/uploads', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/migrations', migrationRoutes);
app.use('/api/claims-reports', claimsReportRoutes);
app.use('/api/*', notFound);
app.use(errorHandler);

// Serve uploaded files (onboarding templates, documents, etc.)
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res, path) => {
        if (path.toLowerCase().endsWith('.pdf')) {
            // Force download on mobile/desktop
            res.setHeader('Content-Disposition', 'attachment');
        }
    }
}));

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// Export httpServer and io
export { httpServer, app, io };

console.log('✅ App Logic Loaded');
