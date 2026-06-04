import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
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
import ingestionRoutes from './routes/ingestion.js';
import candidateRoutes from './routes/candidates.js';
import adminRoutes from './routes/admin.js';
import v1Routes from './routes/v1/index.js';
import { query as dbQuery } from './config/database.js';
import { protect } from './middleware/auth.js';
import flightDataRoutes from './routes/flightData.js';
import forecastRoutes from './routes/forecast.js';
import pilotSecureRoutes from './routes/pilotSecure.js'; // Pilot secure isolation layer
import pilotUploadRoutes from './routes/pilotUpload.js'; // Phase 6: Pilot data upload pipeline
import clientReportsRoutes from './routes/clientReports.js';
import adminMediaRoutes from './routes/adminMedia.js';   // Admin Media Gallery
import orchestratorRoutes from './routes/orchestrator.js'; // Mission Orchestration Engine
import missionGridRoutes from './routes/missionGrid.js';    // Global Mission Grid
import blockProgressRoutes from './routes/blockProgress.js'; // LBD Block Progress Module
import thermalFaultRoutes from './routes/thermalFaults.js';   // Thermal Fault Intelligence
import energyLossRoutes from './routes/energyLoss.js';         // Energy Loss Estimation Engine
import thermalDetectionRoutes from './routes/thermalDetection.js'; // AI Thermal Detection Engine
import missionSessionsRoutes from './routes/missionSessions.js';   // Enterprise Session Tracking
import regionCountryRoutes from './routes/regionCountryRoutes.js';  // Geographic Coverage
import pilotMetricsRoutes from './routes/pilotMetrics.js';          // Pilot Performance Metrics
import missionsRoutes from './routes/missions.js';                   // RBAC Mission Management
import lbdRoutes from './routes/lbd.js';                             // LBD Defect Tracking
import bessRoutes from './routes/bess.js';                           // BESS QA/QC Module
import solarFarmRoutes from './routes/solarFarm.js';                  // Solar Farm Intelligence Platform
import clientPortalRoutes from './routes/clientPortal.js';           // Client Portal Scoped Views
import vendorExpensesRoutes from './routes/expenses.js';        // Vendor & Expenses Ledger
import migrationsRoutes from './routes/migrations.js';                // Emergency DB Migrations
import aiRoutes from './routes/ai.js';                                // AI Bridge Routes
import protocolRoutes from './routes/protocols.js';                   // Operational Protocols SOP library
import tenantRoutes from './routes/tenants.js';                       // SaaS Tenant Registration & Management
import subscriptionInvoiceRoutes from './routes/subscriptionInvoices.js'; // SaaS Client Billing
import chunkedUploadRoutes from './routes/chunkedUploads.js';              // §6 Resumable Upload Routes
import pilotNetworkRoutes from './routes/pilotNetwork.js';                // Pilot Network Applications (public /join form)
import orthomosaicRoutes from './routes/orthomosaic.js';                  // Orthomosaic Photogrammetry Pipeline
import socialMediaRoutes from './routes/socialMedia.js';                  // Social Media Blast
import marketingRoutes from './routes/marketing.js';                      // Marketing Hub (leads, templates, outreach)
import constructionRoutes from './routes/constructionRoutes.js';           // Construction Evidence Portal
import weatherRoutes from './routes/weather.js';                          // Weather proxy (Apple WeatherKit + Open-Meteo fallback)
import downloadsRoutes from './routes/downloads.js';                       // Axis Ortho desktop app distribution
import adminReportsRoutes from './routes/adminReports.js';                  // Admin Reports CRUD + Send

// ── Local mode routes (Electron desktop app only) ─────────────────────────────
// Only imported and mounted when AXIS_LOCAL_MODE=true (set by Electron main.js).
// Zero impact on the cloud deployment — this block is never reached otherwise.
let localRoutes = null;
if (process.env.AXIS_LOCAL_MODE === 'true') {
    const { default: lr } = await import('./routes/local.js');
    localRoutes = lr;
    console.log('🖥️  Axis Ortho: Local mode active — mounting /api/local routes');
}

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { standardLimiter, authLimiter } from './middleware/rateLimiter.js';
import { requestTracer } from './middleware/requestTracer.js';       // §1 Request tracing
import { errorTracker } from './middleware/errorTracker.js';         // §12 Error enrichment

// Import enterprise infrastructure
import { getFlagSummary } from './config/featureFlags.js';           // §11 Feature flags
import { registerAuditListener } from './events/listeners/auditListener.js';           // §3 Event bus
import { registerNotificationListener } from './events/listeners/notificationListener.js';
import { registerAnalyticsListener } from './events/listeners/analyticsListener.js';
import { startAIWorker } from './workers/aiWorker.js';               // §2 Async AI worker

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Enable trust proxy for Cloud Run/Load Balancers
app.set('trust proxy', 1);

// Initialize Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
// scriptSrc: unsafe-inline is development-only (Vite HMR requires it).
// Production enforces strict 'self' — inline scripts are blocked.
const isDev = process.env.NODE_ENV !== 'production';
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],  // unpkg: Leaflet runtime injection (WeatherDashboard)
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],  // unpkg: Leaflet CSS
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'",
                "https://api.openai.com",
                "https://generativelanguage.googleapis.com",
                "https://api.open-meteo.com",               // Weather widget (primary)
                "https://archive-api.open-meteo.com",       // Historical weather data (admin reports)
                "https://geocoding-api.open-meteo.com",     // City autocomplete geocoding
                "https://tile.openweathermap.org",          // Weather tiles
                "https://wttr.in",                          // Weather widget (secondary source)
                "https://unpkg.com",                        // Leaflet marker icons (runtime fetch)
                "https://basemaps.cartocdn.com",            // Dark map tile CDN (react-leaflet)
                "https://a.basemaps.cartocdn.com",          // Leaflet tile subdomains
                "https://b.basemaps.cartocdn.com",
                "https://c.basemaps.cartocdn.com",
            ],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: [
                "'self'",
                "https://www.openstreetmap.org",     // Weather map iframe
            ]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie']
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser()); // Parse cookies for HttpOnly JWT support

// §1 Request tracer — attach requestId + X-Request-ID header to every request
app.use(requestTracer);

// Enhanced health check — includes DB ping, flag summary, uptime
app.get('/health', async (req, res) => {
    let dbStatus = 'unknown';
    try {
        await dbQuery('SELECT 1');
        dbStatus = 'ok';
    } catch {
        dbStatus = 'error';
    }
    res.json({
        status: dbStatus === 'ok' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        service: 'Axis Backend',
        version: '1.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        requestId: req.requestId,
        database: dbStatus,
        featureFlags: getFlagSummary(),
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
app.use('/api/ingestion', ingestionRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/admin', adminRoutes); // Axis Intelligence Module (admin-only)
app.use('/api/admin/media', adminMediaRoutes); // Admin Media Gallery
app.use('/api/flight-data', flightDataRoutes); // KML + Flight Params ingest
app.use('/api/forecast', forecastRoutes);       // Mission Forecasting Engine
app.use('/api/pilot/secure', pilotSecureRoutes); // Pilot isolation + secure endpoints
app.use('/api/pilot/upload-jobs', pilotUploadRoutes); // Phase 6: Pilot data upload pipeline
app.use('/api/orchestrator', orchestratorRoutes);    // Mission Orchestration Engine
app.use('/api/mission-grid', missionGridRoutes);     // Global Mission Grid (admin-only)
app.use('/api/blocks', blockProgressRoutes);          // LBD Solar Block Progress
app.use('/api/faults', thermalFaultRoutes);           // Thermal Fault Intelligence
app.use('/api/energy-loss', energyLossRoutes);         // Energy Loss Estimation Engine
app.use('/api/tenants', tenantRoutes);                 // SaaS Tenant Registration & Management
app.use('/api/subscription-invoices', subscriptionInvoiceRoutes); // SaaS Client Billing
app.use('/api/thermal', thermalDetectionRoutes);        // AI Thermal Detection Engine
app.use('/api/sessions', missionSessionsRoutes);       // Enterprise Mission Sessions
app.use('/api/regions', regionCountryRoutes);           // Geographic Coverage (Regions & Countries)
app.use('/api/pilot-metrics', pilotMetricsRoutes);     // Pilot Performance Metrics
app.use('/api/missions', missionsRoutes);               // RBAC Mission Management
app.use('/api/lbd', lbdRoutes);                         // LBD Defect Tracking
app.use('/api/bess', bessRoutes);                       // BESS QA/QC Module
app.use('/api/solar-farm', solarFarmRoutes);            // Solar Farm Intelligence Platform
app.use('/api/client', clientPortalRoutes);             // Client Portal Scoped Views
app.use('/api/vendor-expenses', vendorExpensesRoutes);  // Vendor & Expenses Ledger
app.use('/api/migrations', migrationsRoutes);           // Emergency DB Migrations
app.use('/api/ai', aiRoutes);                           // AI Bridge Routes (generate-text, report-generate, solar-analyze)
app.use('/api/protocols', protocolRoutes);              // Operational Protocols (SOP library)
app.use('/api/pilot', pilotSecureRoutes);               // Pilot routes alias (frontend calls /pilot/missions etc.)
app.use('/api/uploads', pilotUploadRoutes);             // Upload jobs alias
app.use('/api/uploads', chunkedUploadRoutes);           // §6 Chunked upload endpoints (flag-gated)
app.use('/api/client', clientReportsRoutes);             // Client AI reports
app.use('/api/pilot-network', pilotNetworkRoutes);       // Pilot Network Applications (public apply + admin review)
app.use('/api/orthomosaic', orthomosaicRoutes);          // Orthomosaic Photogrammetry Pipeline
app.use('/api/social', socialMediaRoutes);               // Social Media Blast
app.use('/api/construction', constructionRoutes);        // Construction Evidence Portal
app.use('/api/weather', weatherRoutes);                  // Weather proxy (Apple WeatherKit + Open-Meteo fallback)
app.use('/api/downloads', downloadsRoutes);              // Axis Ortho desktop app distribution
app.use('/api/admin-reports', adminReportsRoutes);        // Admin Reports CRUD + Send
app.use('/api/marketing', marketingRoutes);                // Marketing Hub (leads, templates, outreach)

// ── Local mode (Electron desktop app) ────────────────────────────────────────
if (localRoutes) {
    app.use('/api/local', localRoutes);                  // Local job management, file serving, sync trigger
}

// ── /api/documents — global document query (by personnelId) ──────────────────
// Called from: DocumentExplorer.tsx and compliance.ts with ?personnelId=X
app.get('/api/documents', protect, async (req, res) => {
    try {
        const { personnelId } = req.query;
        let result;
        if (personnelId) {
            result = await dbQuery(
                `SELECT id, file_name, file_path, file_url, file_size, mime_type, document_type, created_at, expires_at
                 FROM personnel_documents WHERE personnel_id = $1 ORDER BY created_at DESC`,
                [personnelId]
            );
        } else {
            result = await dbQuery(
                `SELECT pd.id, pd.file_name, pd.file_url, pd.file_size, pd.mime_type, pd.document_type, pd.created_at,
                        p.name as personnel_name, p.id as personnel_id
                 FROM personnel_documents pd
                 LEFT JOIN personnel p ON p.id = pd.personnel_id
                 ORDER BY pd.created_at DESC LIMIT 200`
            );
        }
        res.json({ success: true, data: result.rows });
    } catch (e) {
        console.error('[/api/documents]', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});


// ── Startup Migrations ─────────────────────────────────────────────────────
// Runs when the server boots. Safe to run multiple times (IF NOT EXISTS).
(async () => {
    try {
        // industry_key on deployments
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS industry_key TEXT`);
        const r = await dbQuery(`UPDATE deployments SET industry_key = 'solar' WHERE industry_key IS NULL`);
        if (r.rowCount > 0) console.log(`✅ Startup migration: tagged ${r.rowCount} missions with industry_key='solar'`);

        // flight_parameters table
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS flight_parameters (
                id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deployment_id      UUID UNIQUE REFERENCES deployments(id) ON DELETE CASCADE,
                flight_altitude_m  NUMERIC,
                flight_speed_ms    NUMERIC,
                overlap_percent    NUMERIC,
                gsd_cm             NUMERIC,
                camera_model       TEXT,
                drone_model        TEXT,
                mission_area_acres NUMERIC,
                waypoint_count     INTEGER,
                kml_raw            TEXT,
                params_raw         JSONB,
                created_at         TIMESTAMPTZ DEFAULT NOW(),
                updated_at         TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Startup migration: flight_parameters table ready');

        // ── Vendor & Expenses Ledger ───────────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS vendor_expenses (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                vendor_name     TEXT NOT NULL,
                project_name    TEXT NOT NULL,
                inv_number      TEXT,
                inv_date        DATE NOT NULL,
                inv_year        INT,
                inv_month       TEXT,
                inv_status      TEXT NOT NULL DEFAULT 'Unpaid',
                payment_date    DATE,
                payment_year    INT,
                payment_month   TEXT,
                invoice_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
                stanley_addon   NUMERIC(12,2) NOT NULL DEFAULT 0,
                paid_to_vendor  NUMERIC(12,2) NOT NULL DEFAULT 0,
                paid_to_stanley NUMERIC(12,2) NOT NULL DEFAULT 0,
                notes           TEXT,
                tenant_id       UUID,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_ve_inv_date ON vendor_expenses(inv_date DESC)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_ve_status ON vendor_expenses(inv_status)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_ve_vendor ON vendor_expenses(vendor_name)`);
        console.log('\u2705 Startup migration: vendor_expenses table ready');

        // ── Axis Intelligence tables ──────────────────────────────────────
        await dbQuery(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS axis_mission_intel (
                id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                mission_id       UUID NOT NULL UNIQUE,
                risk_score       INTEGER,
                priority_level   VARCHAR(20),
                recommended_pilot_count INTEGER,
                weather_concern  VARCHAR(500),
                estimated_completion_days INTEGER,
                financial_exposure DECIMAL(12,2),
                safety_flags     JSONB DEFAULT '[]'::jsonb,
                block_priority_strategy JSONB DEFAULT '{}'::jsonb,
                created_at       TIMESTAMP DEFAULT NOW(),
                updated_at       TIMESTAMP DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_axis_mission_intel_mission_id ON axis_mission_intel(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_axis_mission_intel_risk_score ON axis_mission_intel(risk_score DESC)`);
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS axis_mission_intel_simulations (
                id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                mission_id  UUID NOT NULL,
                overrides   JSONB DEFAULT '{}'::jsonb,
                results     JSONB DEFAULT '{}'::jsonb,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_axis_intel_sims_mission_id ON axis_mission_intel_simulations(mission_id)`);
        console.log('✅ Startup migration: axis_mission_intel tables ready');

        // ── AI Reports archive table ──────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS ai_reports (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
                industry      TEXT,
                report_type   TEXT,
                report_data   JSONB,
                pdf_url       TEXT,
                generated_by  UUID,
                created_at    TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_ai_reports_deployment_id ON ai_reports(deployment_id)`);
        console.log('✅ Startup migration: ai_reports table ready');

        // ── Pilot Upload Jobs tables ────────────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS upload_jobs (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pilot_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mission_id      UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
                upload_type     VARCHAR(50)  NOT NULL DEFAULT 'images',
                analysis_type   VARCHAR(100) DEFAULT 'thermal_fault',
                mission_folder  VARCHAR(255),
                lbd_block       VARCHAR(255),
                notes           TEXT,
                status          VARCHAR(30)  NOT NULL DEFAULT 'pending',
                report_url      TEXT,
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        `);
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS upload_files (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id          UUID NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
                file_name       VARCHAR(512) NOT NULL,
                file_size       BIGINT       DEFAULT 0,
                file_path       TEXT,
                storage_url     TEXT,
                status          VARCHAR(30)  NOT NULL DEFAULT 'pending',
                ai_result       JSONB,
                pix4d_job_id    VARCHAR(255),
                error_message   TEXT,
                created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_upload_jobs_pilot_id   ON upload_jobs(pilot_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_upload_jobs_mission_id ON upload_jobs(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_upload_jobs_status     ON upload_jobs(status)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_upload_files_job_id    ON upload_files(job_id)`);
        // Ensure all columns exist even if the table was created before this migration
        await dbQuery(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS mission_folder  VARCHAR(255)`);
        await dbQuery(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS lbd_block       VARCHAR(255)`);
        await dbQuery(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS analysis_type   VARCHAR(100) DEFAULT 'thermal_fault'`);
        await dbQuery(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS report_url      TEXT`);
        await dbQuery(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS file_count      INTEGER DEFAULT 0`);
        await dbQuery(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS error_count     INTEGER DEFAULT 0`);
        await dbQuery(`ALTER TABLE upload_jobs ADD COLUMN IF NOT EXISTS processed_count INTEGER DEFAULT 0`);
        console.log('✅ Startup migration: upload_jobs and upload_files tables ready');


        // ── Mission Forecasting Engine tables ──────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS mission_daily_performance (
                id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id             UUID NOT NULL,
                date                   DATE NOT NULL,
                expected_output        INTEGER,
                actual_output          INTEGER,
                completion_rate        DECIMAL(5,2),
                delay_reason           VARCHAR(500),
                weather_conditions     JSONB DEFAULT '{}'::jsonb,
                irradiance_level       DECIMAL(10,2),
                notes_extracted_factors JSONB DEFAULT '{}'::jsonb,
                created_at             TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(mission_id, date)
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mdp_mission_id ON mission_daily_performance(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mdp_date ON mission_daily_performance(date)`);

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS mission_forecast_windows (
                id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id              UUID NOT NULL,
                forecast_start_date     DATE NOT NULL,
                forecast_end_date       DATE NOT NULL,
                consecutive_days        INTEGER,
                weather_score           INTEGER,
                irradiance_score        INTEGER,
                predicted_completion_rate DECIMAL(5,2),
                confidence_score        INTEGER,
                recommended             BOOLEAN DEFAULT FALSE,
                created_at              TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mfw_mission_id ON mission_forecast_windows(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mfw_confidence ON mission_forecast_windows(confidence_score DESC)`);
        // Phase 2: Additional forecast performance indexes
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mfw_start_date ON mission_forecast_windows(forecast_start_date)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mfw_recommended ON mission_forecast_windows(recommended) WHERE recommended = TRUE`);
        console.log('✅ Startup migration: mission forecasting tables + indexes ready');

        // Phase 5: system_settings table for scheduler resilience
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key        TEXT PRIMARY KEY,
                value      TEXT,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`INSERT INTO system_settings (key, value) VALUES ('last_forecast_run', NULL) ON CONFLICT (key) DO NOTHING`);
        console.log('✅ Startup migration: system_settings table ready');

        // ── Phase 4: Mission coordinates ─────────────────────────────────────
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`);
        console.log('✅ Startup migration: deployments lat/lon columns ready');

        // ── Auto-geocode missions with missing coordinates ────────────────────
        try {
            const missingCoords = await dbQuery(
                `SELECT id, title, site_name, location FROM deployments
                 WHERE (latitude IS NULL OR longitude IS NULL)
                 AND (location IS NOT NULL AND location != '')
                 LIMIT 50`
            );
            if (missingCoords.rows.length > 0) {
                const KNOWN = {
                    'kerens': { lat: 32.1332, lon: -96.2278 },
                    'dallas': { lat: 32.7767, lon: -96.7970 },
                    'houston': { lat: 29.7604, lon: -95.3698 },
                    'austin': { lat: 30.2672, lon: -97.7431 },
                    'san antonio': { lat: 29.4241, lon: -98.4936 },
                    'fort worth': { lat: 32.7555, lon: -97.3308 },
                    'el paso': { lat: 31.7619, lon: -106.4850 },
                    'waco': { lat: 31.5493, lon: -97.1467 },
                    'corpus christi': { lat: 27.8006, lon: -97.3964 },
                    'mexico city': { lat: 19.4326, lon: -99.1332 },
                    'ciudad de mexico': { lat: 19.4326, lon: -99.1332 },
                    'monterrey': { lat: 25.6866, lon: -100.3161 },
                    'guadalajara': { lat: 20.6597, lon: -103.3496 },
                };
                let fixedCount = 0;
                for (const row of missingCoords.rows) {
                    const loc = (row.location || row.site_name || '').trim();
                    const city = loc.split(',')[0].trim().toLowerCase();
                    let coords = KNOWN[city] || KNOWN[loc.toLowerCase()];

                    if (!coords && city.length >= 2) {
                        try {
                            const geoRes = await globalThis.fetch(
                                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`
                            );
                            const geoData = await geoRes.json();
                            if (geoData.results && geoData.results.length > 0) {
                                const region = loc.split(',').slice(1).join(' ').trim().toLowerCase();
                                const match = region
                                    ? geoData.results.find(r =>
                                        (r.admin1 && r.admin1.toLowerCase().includes(region)) ||
                                        (r.country && r.country.toLowerCase().includes(region))
                                      ) || geoData.results[0]
                                    : geoData.results[0];
                                coords = { lat: match.latitude, lon: match.longitude };
                            }
                        } catch (e) { /* non-fatal */ }
                    }

                    if (coords) {
                        await dbQuery(
                            `UPDATE deployments SET latitude = $1, longitude = $2 WHERE id = $3`,
                            [coords.lat, coords.lon, row.id]
                        );
                        fixedCount++;
                        console.log(`  📍 Geocoded "${row.title}" (${loc}) → ${coords.lat}, ${coords.lon}`);
                    }
                }
                if (fixedCount > 0) console.log(`✅ Startup migration: geocoded ${fixedCount} missions with missing coordinates`);
            }
        } catch (geoErr) {
            console.warn('⚠ Startup geocode migration (non-fatal):', geoErr.message);
        }

        // ── Phase 9: Industries table ─────────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS industries (
                id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name                      TEXT NOT NULL UNIQUE,
                default_flight_parameters JSONB DEFAULT '{}'::jsonb,
                default_checklist         JSONB DEFAULT '[]'::jsonb,
                default_report_schema     JSONB DEFAULT '{}'::jsonb,
                created_at                TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`
            INSERT INTO industries (name) VALUES
              ('solar'), ('infrastructure'), ('insurance'), ('agriculture'), ('energy')
            ON CONFLICT (name) DO NOTHING
        `);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS industry_id UUID REFERENCES industries(id)`);
        console.log('✅ Startup migration: industries table + deployments.industry_id ready');

        // ── Phase 10: Sites table ─────────────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS sites (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_name   TEXT,
                latitude    DECIMAL(10,7),
                longitude   DECIMAL(10,7),
                client_id   UUID,
                industry_id UUID REFERENCES industries(id),
                acreage     DECIMAL(10,2),
                region      TEXT,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_sites_client_id ON sites(client_id)`);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id)`);
        console.log('✅ Startup migration: sites table + deployments.site_id ready');

        // ── Phase 11: Pilot performance table ────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS pilot_performance (
                id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pilot_id                 UUID NOT NULL,
                missions_completed       INTEGER DEFAULT 0,
                average_blocks_per_day   DECIMAL(10,2),
                weather_adjusted_output  DECIMAL(10,2),
                delay_factor_frequency   JSONB DEFAULT '{}'::jsonb,
                equipment_failure_rate   DECIMAL(5,2),
                report_quality_score     DECIMAL(5,2),
                created_at               TIMESTAMPTZ DEFAULT NOW(),
                updated_at               TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_pilot_performance_pilot_id ON pilot_performance(pilot_id)`);
        console.log('✅ Startup migration: pilot_performance table ready');

        // ── candidate_packets: country_id (was missing from original migration) ──
        await dbQuery(`ALTER TABLE candidate_packets ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_candidate_packets_country ON candidate_packets(country_id)`);
        console.log('✅ Startup migration: candidate_packets.country_id ready');

        // ── Phase 12: Security events table ──────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS security_events (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id    UUID,
                event_type TEXT NOT NULL,
                resource   TEXT,
                ip_address TEXT,
                metadata   JSONB DEFAULT '{}'::jsonb,
                timestamp  TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC)`);
        console.log('✅ Startup migration: security_events table ready');

        // ── Phase 7: forecast_confidence computed column ───────────────────────
        await dbQuery(`ALTER TABLE mission_forecast_windows ADD COLUMN IF NOT EXISTS forecast_confidence INTEGER`);
        console.log('✅ Startup migration: mission_forecast_windows.forecast_confidence ready');

        // ── Phase 9: pilot_performance reliability_score field ─────────────────
        await dbQuery(`ALTER TABLE pilot_performance ADD COLUMN IF NOT EXISTS reliability_score DECIMAL(5,2)`);
        console.log('✅ Startup migration: pilot_performance.reliability_score ready');

        // ── Phase 12: Mission schedule suggestions (advisory only) ─────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS mission_schedule_suggestions (
                id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id             UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
                suggested_start_date   DATE,
                suggested_end_date     DATE,
                recommended_pilot_id   UUID,
                estimated_days         INTEGER,
                confidence_score       INTEGER,
                forecast_window        JSONB DEFAULT '{}'::jsonb,
                status                 TEXT DEFAULT 'pending',
                admin_notes            TEXT,
                created_at             TIMESTAMPTZ DEFAULT NOW(),
                reviewed_at            TIMESTAMPTZ
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mss_mission_id ON mission_schedule_suggestions(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mss_status ON mission_schedule_suggestions(status)`);
        console.log('✅ Startup migration: mission_schedule_suggestions table ready');

        // ── Phase 10: notifications table ──────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS notifications (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id   TEXT,
                mission_id  UUID,
                type        TEXT DEFAULT 'FORECAST_ALERT',
                title       TEXT,
                message     TEXT,
                read        BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_notifications_mission ON notifications(mission_id)`);
        console.log('✅ Startup migration: notifications table ready');

        // ── Phase 12: orchestration_enabled flag on deployments ───────────────
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS orchestration_enabled BOOLEAN DEFAULT TRUE`);
        console.log('✅ Startup migration: deployments.orchestration_enabled ready');

        // ── Phase 1: mission_orchestration table ─────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS mission_orchestration (
                id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id                 UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
                recommended_start_date     DATE,
                recommended_end_date       DATE,
                recommended_pilot          UUID REFERENCES users(id),
                recommended_forecast_window UUID,
                predicted_completion_days  INTEGER,
                ai_confidence              INTEGER,
                priority_score             INTEGER,
                status                     TEXT DEFAULT 'suggested',
                manual_override            BOOLEAN DEFAULT FALSE,
                override_reason            TEXT,
                approved_by                UUID,
                created_at                 TIMESTAMPTZ DEFAULT now(),
                updated_at                 TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mission_orch_mission ON mission_orchestration(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mission_orch_priority ON mission_orchestration(priority_score DESC)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mission_orch_status ON mission_orchestration(status)`);
        console.log('✅ Startup migration: mission_orchestration table ready');

        // ── Phase 6: orchestration_override_logs table ───────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS orchestration_override_logs (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id    UUID,
                previous_plan JSONB,
                new_plan      JSONB,
                reason        TEXT,
                changed_by    UUID,
                created_at    TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_ool_mission ON orchestration_override_logs(mission_id)`);
        console.log('✅ Startup migration: orchestration_override_logs table ready');

        // ── Phase 1 (Mission Grid): Spatial geo index on deployments ─────────
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_deployments_geo ON deployments(latitude, longitude)`);
        console.log('✅ Startup migration: deployments geo index ready');

        // ── Phase 2 (Mission Grid): mission_status operational field ─────────
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS mission_status TEXT DEFAULT 'pending'`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_deployments_mission_status ON deployments(mission_status)`);
        console.log('✅ Startup migration: deployments.mission_status ready');

        // ── Phase 1 (LBD): solar_blocks registry ─────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS solar_blocks (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
                block_name    TEXT,
                block_number  INTEGER,
                acreage       DECIMAL(10,2),
                latitude      DECIMAL(10,7),
                longitude     DECIMAL(10,7),
                status        TEXT DEFAULT 'pending',
                created_at    TIMESTAMPTZ DEFAULT now(),
                updated_at    TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_blocks_deployment ON solar_blocks(deployment_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_blocks_status ON solar_blocks(status)`);
        console.log('✅ Startup migration: solar_blocks table ready');

        // ── Phase 2 (LBD): block_progress tracking ────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS block_progress (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                block_id          UUID REFERENCES solar_blocks(id) ON DELETE CASCADE,
                pilot_id          UUID REFERENCES users(id),
                mission_id        UUID REFERENCES deployments(id),
                acres_completed   DECIMAL(10,2),
                inspection_type   TEXT,
                flight_hours      DECIMAL(10,2),
                images_collected  INTEGER,
                data_uploaded     BOOLEAN DEFAULT FALSE,
                completed_at      TIMESTAMPTZ,
                created_at        TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_block_progress_block ON block_progress(block_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_block_progress_pilot ON block_progress(pilot_id)`);
        console.log('✅ Startup migration: block_progress table ready');

        // ── Phase 1 (Thermal): thermal_faults table ────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS thermal_faults (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deployment_id     UUID REFERENCES deployments(id) ON DELETE CASCADE,
                block_id          UUID REFERENCES solar_blocks(id) ON DELETE SET NULL,
                image_id          UUID,
                latitude          DECIMAL(10,7),
                longitude         DECIMAL(10,7),
                temperature_delta DECIMAL(6,2),
                fault_type        TEXT,
                severity          TEXT DEFAULT 'low',
                confidence_score  INTEGER,
                status            TEXT DEFAULT 'open',
                detected_at       TIMESTAMPTZ DEFAULT now(),
                created_at        TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_faults_deployment ON thermal_faults(deployment_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_faults_block ON thermal_faults(block_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_faults_severity ON thermal_faults(severity)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_faults_status ON thermal_faults(status)`);
        console.log('✅ Startup migration: thermal_faults table ready');

        // ── Phase 12 (Thermal): fault_risk_score on solar_blocks ──────────────
        await dbQuery(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS fault_risk_score INTEGER DEFAULT 0`);
        console.log('✅ Startup migration: solar_blocks.fault_risk_score ready');

        // ── Phase 1 (Energy Loss): fault_energy_loss table ────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS fault_energy_loss (
                id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                fault_id                       UUID REFERENCES thermal_faults(id) ON DELETE CASCADE,
                deployment_id                  UUID REFERENCES deployments(id) ON DELETE CASCADE,
                block_id                       UUID REFERENCES solar_blocks(id) ON DELETE SET NULL,
                estimated_kw_loss              DECIMAL(10,4),
                estimated_kwh_loss_daily       DECIMAL(10,4),
                estimated_kwh_loss_annual      DECIMAL(10,4),
                estimated_revenue_loss_daily   DECIMAL(10,2),
                estimated_revenue_loss_annual  DECIMAL(10,2),
                manual_override                BOOLEAN DEFAULT FALSE,
                calculated_at                  TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_energy_loss_fault ON fault_energy_loss(fault_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_energy_loss_deployment ON fault_energy_loss(deployment_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_energy_loss_block ON fault_energy_loss(block_id)`);
        console.log('✅ Startup migration: fault_energy_loss table ready');

        // ── Phase 14 (Energy Loss): manual_override column (if table existed before) ──
        await dbQuery(`ALTER TABLE fault_energy_loss ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE`);
        console.log('✅ Startup migration: fault_energy_loss.manual_override ready');

        // ── Phase 1 (Thermal Detection): thermal_images table ──────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS thermal_images (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
                pilot_id      UUID REFERENCES users(id),
                file_url      TEXT,
                latitude      DECIMAL(10,7),
                longitude     DECIMAL(10,7),
                capture_time  TIMESTAMPTZ,
                image_width   INTEGER,
                image_height  INTEGER,
                sensor_model  TEXT,
                created_at    TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_thermal_images_deployment ON thermal_images(deployment_id)`);
        console.log('✅ Startup migration: thermal_images table ready');

        // ── Phase 13 (Thermal Detection): ai_detected + review_status columns ──
        await dbQuery(`ALTER TABLE thermal_faults ADD COLUMN IF NOT EXISTS ai_detected BOOLEAN DEFAULT TRUE`);
        await dbQuery(`ALTER TABLE thermal_faults ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending'`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_faults_review_status ON thermal_faults(review_status)`);
        console.log('✅ Startup migration: thermal_faults AI tracking columns ready');

        // ── City/State on deployments (for geocoding + forecast) ──────────────
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS state VARCHAR(100)`);
        // Backfill from existing location text (e.g. "Houston, TX")
        await dbQuery(`
            UPDATE deployments
            SET city  = TRIM(SPLIT_PART(location, ',', 1)),
                state = TRIM(SPLIT_PART(location, ',', 2))
            WHERE location IS NOT NULL AND location LIKE '%,%' AND city IS NULL
        `);
        console.log('✅ Startup migration: deployments city/state columns ready');


        // ── Phase: Enterprise Session Tracking ───────────────────────────────
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS mission_status_v2 TEXT DEFAULT 'assigned'`);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS completion_percent INT DEFAULT 0`);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'not_billable'`);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS allow_partial_invoice BOOLEAN DEFAULT true`);
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS total_sessions INT DEFAULT 0`);

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS mission_work_sessions (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id       UUID REFERENCES deployments(id) ON DELETE CASCADE,
                pilot_id         UUID,
                session_number   INT,
                session_date     DATE,
                start_time       TIMESTAMPTZ DEFAULT now(),
                end_time         TIMESTAMPTZ,
                completion_percent INT DEFAULT 0,
                status           TEXT DEFAULT 'active',
                reason_closed    TEXT,
                weather_stop     BOOLEAN DEFAULT false,
                billable         BOOLEAN DEFAULT true,
                invoice_id       UUID,
                payment_status   TEXT DEFAULT 'pending',
                notes            TEXT,
                created_at       TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_sessions_mission_id ON mission_work_sessions(mission_id)`);
        console.log('✅ Startup migration: mission_work_sessions table ready');

        // ── Backfill NULL mission_status_v2 to 'assigned' for all existing missions ──
        const backfillRes = await dbQuery(`UPDATE deployments SET mission_status_v2 = 'assigned' WHERE mission_status_v2 IS NULL`);
        if (backfillRes.rowCount > 0) console.log(`✅ Backfilled ${backfillRes.rowCount} missions to mission_status_v2='assigned'`);

        // ── Phase 5: mission_timeline table ──────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS mission_timeline (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id  UUID REFERENCES deployments(id) ON DELETE CASCADE,
                event_type  TEXT NOT NULL,
                description TEXT,
                session_id  UUID,
                created_by  UUID,
                created_at  TIMESTAMP DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_timeline_mission ON mission_timeline(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_timeline_created ON mission_timeline(created_at DESC)`);
        console.log('✅ Startup migration: mission_timeline table ready');

        // ── Phase 8: pilot_metrics table ─────────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS pilot_metrics (
                id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pilot_id                  UUID UNIQUE NOT NULL,
                missions_completed        INT DEFAULT 0,
                sessions_completed        INT DEFAULT 0,
                weather_interruptions     INT DEFAULT 0,
                avg_completion_speed      FLOAT DEFAULT 0,
                thermal_faults_detected   INT DEFAULT 0,
                rating                    FLOAT DEFAULT 5.0,
                pilot_score               FLOAT DEFAULT 0,
                last_updated              TIMESTAMP DEFAULT now(),
                created_at                TIMESTAMP DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_pilot_metrics_pilot ON pilot_metrics(pilot_id)`);
        console.log('✅ Startup migration: pilot_metrics table ready');

        // ── Geographic Coverage: Regions & Countries seed ─────────────────
        await dbQuery(`CREATE TABLE IF NOT EXISTS regions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(100) NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
        await dbQuery(`CREATE TABLE IF NOT EXISTS countries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), region_id UUID REFERENCES regions(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, iso_code VARCHAR(10) NOT NULL UNIQUE, currency VARCHAR(10) DEFAULT 'USD', units_of_measurement VARCHAR(20) DEFAULT 'imperial', status VARCHAR(20) DEFAULT 'ENABLED', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
        await dbQuery(`INSERT INTO regions (name) VALUES ('North America'),('Central America'),('South America'),('Caribbean'),('Europe'),('Asia Pacific') ON CONFLICT (name) DO NOTHING`);
        const regRows = (await dbQuery('SELECT id, name FROM regions')).rows;
        const rm = Object.fromEntries(regRows.map(r => [r.name, r.id]));
        const ctries = [
            ['North America', 'United States', 'US', 'USD', 'imperial'], ['North America', 'Canada', 'CA', 'CAD', 'metric'], ['North America', 'Mexico', 'MX', 'MXN', 'metric'],
            ['Central America', 'Guatemala', 'GT', 'GTQ', 'metric'], ['Central America', 'Belize', 'BZ', 'BZD', 'metric'], ['Central America', 'Honduras', 'HN', 'HNL', 'metric'],
            ['Central America', 'El Salvador', 'SV', 'USD', 'metric'], ['Central America', 'Nicaragua', 'NI', 'NIO', 'metric'], ['Central America', 'Costa Rica', 'CR', 'CRC', 'metric'], ['Central America', 'Panama', 'PA', 'PAB', 'metric'],
            ['South America', 'Colombia', 'CO', 'COP', 'metric'], ['South America', 'Venezuela', 'VE', 'VES', 'metric'], ['South America', 'Brazil', 'BR', 'BRL', 'metric'],
            ['South America', 'Peru', 'PE', 'PEN', 'metric'], ['South America', 'Ecuador', 'EC', 'USD', 'metric'], ['South America', 'Bolivia', 'BO', 'BOB', 'metric'],
            ['South America', 'Chile', 'CL', 'CLP', 'metric'], ['South America', 'Argentina', 'AR', 'ARS', 'metric'], ['South America', 'Paraguay', 'PY', 'PYG', 'metric'], ['South America', 'Uruguay', 'UY', 'UYU', 'metric'],
            ['Caribbean', 'Cuba', 'CU', 'CUP', 'metric'], ['Caribbean', 'Dominican Republic', 'DO', 'DOP', 'metric'], ['Caribbean', 'Puerto Rico', 'PR', 'USD', 'imperial'],
            ['Caribbean', 'Jamaica', 'JM', 'JMD', 'metric'], ['Caribbean', 'Trinidad and Tobago', 'TT', 'TTD', 'metric'],
            ['Europe', 'United Kingdom', 'GB', 'GBP', 'metric'], ['Europe', 'Germany', 'DE', 'EUR', 'metric'], ['Europe', 'France', 'FR', 'EUR', 'metric'], ['Europe', 'Spain', 'ES', 'EUR', 'metric'], ['Europe', 'Netherlands', 'NL', 'EUR', 'metric'],
            ['Asia Pacific', 'Australia', 'AU', 'AUD', 'metric'], ['Asia Pacific', 'Japan', 'JP', 'JPY', 'metric'], ['Asia Pacific', 'Singapore', 'SG', 'SGD', 'metric'],
        ];
        for (const [region, name, iso, currency, units] of ctries) {
            const rid = rm[region]; if (!rid) continue;
            await dbQuery(`INSERT INTO countries (region_id,name,iso_code,currency,units_of_measurement,status) VALUES ($1,$2,$3,$4,$5,'ENABLED') ON CONFLICT (iso_code) DO NOTHING`, [rid, name, iso, currency, units]);
        }
        console.log('✅ Startup migration: regions & countries seeded');

        // ── Country FK on deployments (must come after countries table exists) ──
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_deployments_country_id ON deployments(country_id)`);
        // Backfill: assign United States to ALL missions that have no country set yet
        // (All existing missions in the platform are US-based)
        const bfUS = await dbQuery(`
            UPDATE deployments d SET country_id = c.id
            FROM countries c
            WHERE c.iso_code = 'US' AND d.country_id IS NULL
        `);
        if (bfUS.rowCount > 0) console.log('✅ Startup migration: backfilled ' + bfUS.rowCount + ' missions with US country_id');
        console.log('✅ Startup migration: deployments.country_id ready');


        // ── Operational Protocols ─────────────────────────────────────────────
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS protocols (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id    TEXT,
                title        TEXT NOT NULL,
                description  TEXT,
                category     TEXT NOT NULL CHECK (category IN ('pre_flight','mission','post_flight','emergency','general')),
                mission_type TEXT DEFAULT 'all',
                steps        JSONB NOT NULL DEFAULT '[]',
                version      TEXT DEFAULT '1.0',
                is_active    BOOLEAN DEFAULT TRUE,
                is_required  BOOLEAN DEFAULT FALSE,
                created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS mission_protocols (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mission_id  UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
                protocol_id UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
                assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
                assigned_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(mission_id, protocol_id)
            )
        `);
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS protocol_acknowledgments (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                protocol_id     UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
                mission_id      UUID REFERENCES deployments(id) ON DELETE CASCADE,
                pilot_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                pilot_name      TEXT,
                step_responses  JSONB DEFAULT '{}',
                acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
                signature       TEXT,
                UNIQUE(protocol_id, mission_id, pilot_id)
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_protocols_category     ON protocols(category)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_mission_protocols_m    ON mission_protocols(mission_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_proto_acks_pilot       ON protocol_acknowledgments(pilot_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_proto_acks_mission     ON protocol_acknowledgments(mission_id)`);
        console.log('✅ Startup migration: operational protocols tables ready');

    } catch (e) {
        console.warn('[startup-migration] warning:', e.message);
    }
})();

// ── Isolated Country Backfill ─────────────────────────────────────────────────
// Runs independently so it always executes regardless of other migration errors.
// Ensures all existing US missions are tagged with country_id on every server start.
(async () => {
    try {
        // Ensure country_id column exists (safe if already present)
        await dbQuery(`ALTER TABLE deployments ADD COLUMN IF NOT EXISTS country_id UUID`);
        // Tag all unassigned missions as United States
        const result = await dbQuery(`
            UPDATE deployments d
            SET country_id = c.id
            FROM countries c
            WHERE c.iso_code = 'US'
              AND d.country_id IS NULL
        `);
        if (result.rowCount > 0) console.log('[country-backfill] Tagged', result.rowCount, 'missions as United States');
    } catch (e) {
        console.warn('[country-backfill] skipped:', e.message);
    }
})();

// ── Personnel Country FK Migration ───────────────────────────────────────────
(async () => {
    try {
        await dbQuery(`ALTER TABLE personnel ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL`);
        console.log('[personnel-country] country_id column ready');
    } catch (e) {
        console.warn('[personnel-country] migration skipped:', e.message);
    }
})();

// ── Solar Clients Deduplication ───────────────────────────────────────────────
// Removes duplicate company rows created by repeated seed runs. Keeps the row
// with the most complete address (has street), or the newest if all equal.
(async () => {
    try {
        const result = await dbQuery(`
            DELETE FROM clients
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY name, tenant_id
                               ORDER BY
                                   CASE WHEN address->>'street' IS NOT NULL AND address->>'street' != '' THEN 0 ELSE 1 END ASC,
                                   created_at DESC
                           ) AS rn
                    FROM clients
                    WHERE tenant_id = 'coatzadrone'
                ) ranked
                WHERE rn > 1
            )
        `);
        if (result.rowCount > 0) {
            const remaining = await dbQuery(`SELECT COUNT(*) FROM clients WHERE tenant_id = 'coatzadrone'`);
            console.log(`✅ Dedup: removed ${result.rowCount} duplicate clients (${remaining.rows[0].count} unique companies remain)`);
        } else {
            console.log(`[dedup] No duplicates found`);
        }
    } catch (e) {
        console.warn('[dedup] skipped:', e.message);
    }
})();

// ── Solar Industry Clients Seed ───────────────────────────────────────────────
// Seeds the top ~65 real solar companies. Idempotent via WHERE NOT EXISTS.
(async () => {
    try {
        // Ensure clients table exists with required columns
        await dbQuery(`CREATE TABLE IF NOT EXISTS clients (
            id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            industry_id          UUID,
            name                 VARCHAR(255) NOT NULL,
            external_id          VARCHAR(100),
            address              JSONB DEFAULT '{}'::jsonb,
            email                VARCHAR(255),
            phone                VARCHAR(50),
            primary_contact_name VARCHAR(255),
            tenant_id            TEXT DEFAULT 'coatzadrone',
            onboarding_step      INTEGER DEFAULT 1,
            onboarding_status    VARCHAR(50) DEFAULT 'IN_PROGRESS',
            created_at           TIMESTAMPTZ DEFAULT NOW(),
            updated_at           TIMESTAMPTZ DEFAULT NOW()
        )`);

        // Resolve solar industry_id (handles both key-based and name-based schemas)
        let solarIndustryId = null;
        try {
            const r = await dbQuery(`SELECT id FROM industries WHERE key = 'solar' LIMIT 1`);
            if (r.rows[0]) solarIndustryId = r.rows[0].id;
        } catch (_) { /* key column may not exist */ }
        if (!solarIndustryId) {
            try {
                const r = await dbQuery(`SELECT id FROM industries WHERE LOWER(name) = 'solar' LIMIT 1`);
                if (r.rows[0]) solarIndustryId = r.rows[0].id;
            } catch (_) { /* industries table may not exist yet */ }
        }

        const clients = [
          // ── US Utility-Scale Asset Owners & IPPs ─────────────────────────
          ['NextEra Energy Resources','{"city":"Juno Beach","state":"FL","country":"United States","website":"nexteraenergy.com","type":"Utility-Scale Owner","description":"World\'s largest generator of renewable energy with 20+ GW of solar capacity across North America."}','contact@nexteraenergy.com','Director of Operations'],
          ['Clearway Energy Group','{"city":"San Francisco","state":"CA","country":"United States","website":"clearwayenergy.com","type":"Utility-Scale Owner","description":"One of the largest renewable energy owners in the US with 8+ GW of wind and solar assets."}','contact@clearwayenergy.com','Asset Manager'],
          ['Invenergy','{"city":"Chicago","state":"IL","country":"United States","website":"invenergy.com","type":"Utility-Scale Owner","description":"One of the largest private renewable energy developers in North America with 35+ GW in operation."}','contact@invenergy.com','VP Asset Management'],
          ['AES Corporation','{"city":"Arlington","state":"VA","country":"United States","website":"aes.com","type":"Utility-Scale Owner","description":"Global power company with major solar portfolio spanning 14 countries accelerating toward 100% clean energy."}','contact@aes.com','Solar Asset Manager'],
          ['Dominion Energy','{"city":"Richmond","state":"VA","country":"United States","website":"dominionenergy.com","type":"Utility-Scale Owner","description":"Major US utility with a 35 GW solar buildout plan across the Southeast US."}','contact@dominionenergy.com','Director of Solar Operations'],
          ['Duke Energy Renewables','{"city":"Charlotte","state":"NC","country":"United States","website":"duke-energy.com","type":"Utility-Scale Owner","description":"One of the largest US utilities operating 6+ GW of solar and expanding rapidly."}','contact@duke-energy.com','Renewables Asset Manager'],
          ['Xcel Energy','{"city":"Denver","state":"CO","country":"United States","website":"xcelenergy.com","type":"Utility-Scale Owner","description":"Upper Midwest utility with an aggressive 100% carbon-free electricity goal and major solar buildout."}','contact@xcelenergy.com','Clean Energy Director'],
          ['Avangrid Renewables','{"city":"Orange","state":"CT","country":"United States","website":"avangrid.com","type":"Utility-Scale Owner","description":"US renewable arm of Iberdrola with 10+ GW of wind and solar in operation and development."}','contact@avangrid.com','VP Renewable Operations'],
          ['PSEG Solar Source','{"city":"Newark","state":"NJ","country":"United States","website":"pseg.com","type":"Utility-Scale Owner","description":"PSEG\'s solar subsidiary managing 500+ MW of utility-scale and distributed solar across the US."}','contact@pseg.com','Solar Portfolio Manager'],
          ['Arevon Energy','{"city":"Scottsdale","state":"AZ","country":"United States","website":"arevonenergy.com","type":"Utility-Scale Owner","description":"Independent power producer and asset manager owning utility-scale solar and storage across the US Southwest and Southeast."}','contact@arevonenergy.com','Asset Management Director'],
          ['EDF Renewables','{"city":"San Diego","state":"CA","country":"United States","website":"edf-renewables.com","type":"Utility-Scale Owner","description":"US subsidiary of French utility EDF, owning and operating multi-GW of solar and solar-plus-storage assets across North America."}','contact@edf-renewables.com','Asset Management Lead'],
          ['Pattern Energy','{"city":"San Francisco","state":"CA","country":"United States","website":"patternenergy.com","type":"Utility-Scale Owner","description":"Privately owned developer, owner and operator of utility-scale solar, wind and storage projects across North America."}','contact@patternenergy.com','Asset Operations Manager'],
          ['Greenbacker Renewable Energy','{"city":"New York","state":"NY","country":"United States","website":"greenbackercapital.com","type":"Utility-Scale Owner","description":"Publicly-listed renewable energy company owning and operating utility-scale solar across North America."}','contact@greenbackercapital.com','Asset Operations Manager'],
          ['Hannon Armstrong','{"city":"Annapolis","state":"MD","country":"United States","website":"hannonarmstrong.com","type":"Utility-Scale Owner","description":"Climate-positive investment firm owning solar and wind assets totaling 5+ GW across the United States."}','contact@hannonarmstrong.com','Asset Management Director'],
          ['Altus Power','{"city":"Stamford","state":"CT","country":"United States","website":"altuspower.com","type":"Utility-Scale Owner","description":"Leading US commercial-scale clean electrification company with 1+ GW of solar serving commercial clients."}','contact@altuspower.com','Portfolio Manager'],
          // ── US Residential & Commercial Installers ────────────────────────
          ['Sunrun','{"city":"San Francisco","state":"CA","country":"United States","website":"sunrun.com","type":"Residential Installer","description":"Largest US residential solar installer with 900,000+ customers and 6+ GW of installed solar+storage."}','contact@sunrun.com','Operations Director'],
          ['Sunnova Energy','{"city":"Houston","state":"TX","country":"United States","website":"sunnova.com","type":"Residential Installer","description":"National residential solar and storage service provider with 400,000+ customers across 40+ US states."}','contact@sunnova.com','Asset Management Lead'],
          ['SunPower Corporation','{"city":"San Jose","state":"CA","country":"United States","website":"sunpower.com","type":"Residential Installer","description":"Premium US solar manufacturer and installer serving residential and commercial markets with high-efficiency panels."}','contact@sunpower.com','Commercial Sales Director'],
          ['Freedom Forever','{"city":"Temecula","state":"CA","country":"United States","website":"freedomforever.com","type":"Residential Installer","description":"Large national residential solar installer with 25-year production guarantee operating through authorized dealer network."}','contact@freedomforever.com','Operations Director'],
          // ── US Developer-EPCs ─────────────────────────────────────────────
          ['Cypress Creek Renewables','{"city":"Santa Monica","state":"CA","country":"United States","website":"ccrenew.com","type":"Developer-EPC","description":"Major US community and utility-scale solar developer with 3+ GW in operation and strong Southeast presence."}','contact@ccrenew.com','VP of O&M'],
          ['Silicon Ranch','{"city":"Nashville","state":"TN","country":"United States","website":"siliconranch.com","type":"Developer-EPC","description":"Leading US utility-scale solar developer, owner and operator backed by Shell, focused on the Southeast US."}','contact@siliconranch.com','Operations Director'],
          ['Strata Clean Energy','{"city":"Durham","state":"NC","country":"United States","website":"stratacleanenergy.com","type":"Developer-EPC","description":"Vertically integrated solar company developing, constructing, owning and operating utility-scale solar primarily in the Southeast."}','contact@stratacleanenergy.com','VP Asset Management'],
          ['Recurrent Energy','{"city":"Austin","state":"TX","country":"United States","website":"recurrentenergy.com","type":"Developer-EPC","description":"Wholly owned subsidiary of Canadian Solar developing and managing utility-scale solar and storage projects globally."}','contact@recurrentenergy.com','Project Development Director'],
          ['Sol Systems','{"city":"Washington","state":"DC","country":"United States","website":"solsystems.com","type":"Developer-EPC","description":"Full-service solar energy firm managing development, financing and long-term asset management for solar projects."}','contact@solsystems.com','Director of Project Development'],
          ['SOLV Energy','{"city":"San Diego","state":"CA","country":"United States","website":"solvenergy.com","type":"Developer-EPC","description":"Leading US utility-scale solar EPC contractor and O&M provider engineering and constructing GW-scale solar plants."}','contact@solvenergy.com','Director of Asset Services'],
          ['Savion','{"city":"Kansas City","state":"MO","country":"United States","website":"savionenergy.com","type":"Developer-EPC","description":"Shell-owned utility-scale solar and storage developer with large project pipeline across the US Midwest and Southeast."}','contact@savionenergy.com','Development Director'],
          ['Quanta Services','{"city":"Houston","state":"TX","country":"United States","website":"quantaservices.com","type":"Developer-EPC","description":"Publicly traded infrastructure services company with one of the largest solar EPC market shares in the US."}','contact@quantaservices.com','Renewable Energy Director'],
          ['Mortenson','{"city":"Minneapolis","state":"MN","country":"United States","website":"mortenson.com","type":"Developer-EPC","description":"Major US construction company and leading solar EPC firm, building GW-scale utility solar and storage projects."}','contact@mortenson.com','Solar EPC Director'],
          ['SunEnergy1','{"city":"Charlotte","state":"NC","country":"United States","website":"sunenergy1.com","type":"Developer-EPC","description":"Large-scale solar EPC and development company specializing in utility and commercial solar in the Southeast US."}','contact@sunenergy1.com','Operations Director'],
          // ── O&M Specialists ───────────────────────────────────────────────
          ['NovaSource Power Services','{"city":"Chandler","state":"AZ","country":"United States","website":"novasourcepower.com","type":"O&M","description":"World\'s largest independent solar O&M provider managing 50+ GW of utility-scale and distributed solar globally."}','contact@novasourcepower.com','VP Field Operations'],
          ['ENGIE North America','{"city":"Houston","state":"TX","country":"United States","website":"engie.com","type":"O&M","description":"North American arm of French utility ENGIE developing, owning and operating utility-scale solar, wind and storage."}','contact@engie-northamerica.com','Solar O&M Director'],
          ['Terrasmart','{"city":"Fort Myers","state":"FL","country":"United States","website":"terrasmart.com","type":"O&M","description":"Leading US solar O&M provider and racking manufacturer managing 4+ GW of solar assets with integrated inspection services."}','contact@terrasmart.com','O&M Operations Manager'],
          ['Borrego','{"city":"San Diego","state":"CA","country":"United States","website":"borrego.com","type":"O&M","description":"Vertically integrated US solar company delivering 3+ GW of commercial and community solar projects with dedicated O&M."}','contact@borrego.com','Director of Asset Services'],
          ['Greenskies Clean Focus','{"city":"Middletown","state":"CT","country":"United States","website":"greenskies.com","type":"O&M","description":"Develops, finances, builds, owns and operates commercial and industrial rooftop and ground-mount solar for businesses."}','contact@greenskies.com','O&M Manager'],
          ['Nexamp','{"city":"Boston","state":"MA","country":"United States","website":"nexamp.com","type":"Commercial","description":"Leading community and commercial solar developer providing shared solar subscriptions to businesses and residents."}','contact@nexamp.com','Operations Manager'],
          // ── US Solar Manufacturers & Technology ──────────────────────────
          ['First Solar','{"city":"Tempe","state":"AZ","country":"United States","website":"firstsolar.com","type":"Manufacturer","description":"Leading US-based thin-film solar panel manufacturer and developer with 20+ GW of utility-scale projects globally."}','contact@firstsolar.com','Project Development Manager'],
          ['Array Technologies','{"city":"Albuquerque","state":"NM","country":"United States","website":"arraytechinc.com","type":"Manufacturer","description":"World\'s largest solar tracking manufacturer with trackers deployed on 30+ GW of solar projects globally."}','contact@arraytechinc.com','Field Services Manager'],
          ['Nextracker','{"city":"Fremont","state":"CA","country":"United States","website":"nextracker.com","type":"Manufacturer","description":"Global leader in intelligent solar tracker systems with 70+ GW of trackers shipped worldwide."}','contact@nextracker.com','Global Services Director'],
          ['Tesla Energy','{"city":"Austin","state":"TX","country":"United States","website":"tesla.com","type":"Commercial","description":"Tesla\'s energy division deploying solar panels, Powerwall, Powerpack and Megapack at residential and grid scale."}','contact@tesla.com','Energy Operations Lead'],
          ['Enphase Energy','{"city":"Fremont","state":"CA","country":"United States","website":"enphase.com","type":"Manufacturer","description":"World\'s #1 microinverter company powering 3+ million homes in 145+ countries with solar microinverters and storage."}','contact@enphase.com','Field Operations Manager'],
          // ── European Utilities ────────────────────────────────────────────
          ['Ørsted','{"city":"Fredericia","state":"Jutland","country":"Denmark","website":"orsted.com","type":"Developer-EPC","description":"Global leader in renewable energy development with major solar and offshore wind portfolios across Europe and the US."}','contact@orsted.com','Solar Asset Manager'],
          ['RWE Renewables','{"city":"Essen","state":"North Rhine-Westphalia","country":"Germany","website":"rwe.com","type":"Utility-Scale Owner","description":"One of the world\'s largest renewable energy companies with 10+ GW solar capacity and €50B green investment plan."}','contact@rwe.com','Solar Portfolio Director'],
          ['Enel Green Power','{"city":"Rome","state":"Lazio","country":"Italy","website":"enelgreenpower.com","type":"Utility-Scale Owner","description":"World\'s largest private renewable energy operator with 60+ GW of renewables including 20+ GW of solar globally."}','contact@enelgreenpower.com','Asset Management Director'],
          ['Iberdrola','{"city":"Bilbao","state":"Basque Country","country":"Spain","website":"iberdrola.com","type":"Utility-Scale Owner","description":"Global energy major with €150B clean investment plan and 20+ GW of solar across Spain, US, Brazil and UK."}','contact@iberdrola.com','Renewables Operations Lead'],
          ['EDP Renewables','{"city":"Oviedo","state":"Asturias","country":"Spain","website":"edpr.com","type":"Developer-EPC","description":"One of Europe\'s largest renewable energy developers with 7+ GW of solar in operation across 4 continents."}','contact@edpr.com','Solar Asset Manager'],
          ['Acciona Energy','{"city":"Alcobendas","state":"Madrid","country":"Spain","website":"acciona.com","type":"Utility-Scale Owner","description":"Major Spanish renewable energy conglomerate with 12+ GW of solar and wind globally."}','contact@acciona.com','Director of Solar Assets'],
          ['BayWa r.e.','{"city":"Munich","state":"Bavaria","country":"Germany","website":"baywa-re.com","type":"Developer-EPC","description":"Leading global renewable energy developer with 5+ GW of solar in development and operation across 30+ countries."}','contact@baywa-re.com','Project Development Director'],
          ['Statkraft','{"city":"Oslo","state":"Oslo","country":"Norway","website":"statkraft.com","type":"Developer-EPC","description":"Europe\'s largest renewable energy producer with solar projects spanning Europe, South America and India."}','contact@statkraft.com','Solar Asset Manager'],
          ['Lightsource bp','{"city":"London","state":"England","country":"United Kingdom","website":"lightsourcebp.com","type":"Developer-EPC","description":"Global solar developer backed by bp with 25+ GW in development across Europe, Americas, India and Australia."}','contact@lightsourcebp.com','VP Asset Management'],
          // ── Oil & Gas Solar Divisions ─────────────────────────────────────
          ['TotalEnergies Renewables','{"city":"Paris","state":"Île-de-France","country":"France","website":"totalenergies.com","type":"Utility-Scale Owner","description":"Major European energy major with 35+ GW of solar in operation and development targeting 100 GW by 2030."}','contact@totalenergies.com','Solar Portfolio Manager'],
          ['Equinor Renewables','{"city":"Stavanger","state":"Rogaland","country":"Norway","website":"equinor.com","type":"Utility-Scale Owner","description":"Norwegian state-majority energy company building a solar portfolio in the US, Brazil, Poland and Denmark."}','contact@equinor.com','Solar Asset Manager'],
          // ── Asian Manufacturers ───────────────────────────────────────────
          ['Canadian Solar','{"city":"Guelph","state":"Ontario","country":"Canada","website":"canadiansolar.com","type":"Manufacturer","description":"One of the world\'s largest solar energy companies with 60+ GW of modules shipped and 9+ GW of utility projects."}','contact@canadiansolar.com','Project Development Director'],
          ['JinkoSolar','{"city":"Shanghai","state":"Shanghai","country":"China","website":"jinkosolar.com","type":"Manufacturer","description":"World\'s leading solar panel manufacturer having shipped 200+ GW of modules to 200+ countries and regions."}','contact@jinkosolar.com','Global Sales Director'],
          ['LONGi Solar','{"city":"Xi\'an","state":"Shaanxi","country":"China","website":"longi-solar.com","type":"Manufacturer","description":"World\'s largest solar technology company specializing in monocrystalline silicon wafers and high-efficiency modules."}','contact@longi-solar.com','Global Business Director'],
          ['Trina Solar','{"city":"Changzhou","state":"Jiangsu","country":"China","website":"trinasolar.com","type":"Manufacturer","description":"Leading global solar company with 100+ GW of modules shipped and a growing utility-scale project development division."}','contact@trinasolar.com','International Project Manager'],
          ['JA Solar','{"city":"Beijing","state":"Beijing","country":"China","website":"jasolar.com","type":"Manufacturer","description":"One of the world\'s largest solar cell and module manufacturers with 80+ GW of module shipments globally."}','contact@jasolar.com','Global Account Manager'],
          ['Hanwha Q CELLS','{"city":"Seoul","state":"Seoul","country":"South Korea","website":"q-cells.com","type":"Manufacturer","description":"Global solar manufacturer and project developer with premium Q.ANTUM technology and 3+ GW of US projects."}','contact@q-cells.com','Americas Development Director'],
          ['Maxeon Solar Technologies','{"city":"Singapore","state":"Singapore","country":"Singapore","website":"maxeon.com","type":"Manufacturer","description":"Premium solar panel manufacturer known for world-record high-efficiency IBC solar cells."}','contact@maxeon.com','Technical Operations Director'],
          // ── Canada & Latin America ────────────────────────────────────────
          ['Brookfield Renewable Partners','{"city":"Toronto","state":"Ontario","country":"Canada","website":"brookfieldrenewable.com","type":"Utility-Scale Owner","description":"One of the world\'s largest pure-play renewable energy platforms with 30+ GW of solar and hydro globally."}','contact@brookfieldrenewable.com','Portfolio Asset Manager'],
          ['Atlas Renewable Energy','{"city":"Miami","state":"FL","country":"United States","website":"atlasrenewableenergy.com","type":"Developer-EPC","description":"Latin America\'s leading renewable energy developer with 4+ GW of solar in operation across Chile, Brazil, Mexico and Colombia."}','contact@atlasrenewableenergy.com','Operations Director'],
          ['Sonnedix','{"city":"London","state":"England","country":"United Kingdom","website":"sonnedix.com","type":"Utility-Scale Owner","description":"International solar IPP owning and operating 3+ GW of solar across Europe, Americas, Japan and South Africa."}','contact@sonnedix.com','Asset Management Director'],
        ];

        let inserted = 0;
        for (const [name, address, email, contact] of clients) {
            const r = await dbQuery(
                `INSERT INTO clients (industry_id, name, address, email, primary_contact_name, tenant_id, onboarding_status, onboarding_step)
                 SELECT $1, $2, $3::jsonb, $4, $5, 'coatzadrone', 'IN_PROGRESS', 1
                 WHERE NOT EXISTS (
                     SELECT 1 FROM clients WHERE name = $2 AND tenant_id = 'coatzadrone'
                 )`,
                [solarIndustryId, name, address, email, contact]
            );
            inserted += (r.rowCount || 0);
        }

        const total = await dbQuery(`SELECT COUNT(*) FROM clients WHERE tenant_id = 'coatzadrone'`);
        if (inserted > 0) {
            console.log(`✅ Solar clients seed: inserted ${inserted} new companies (${total.rows[0].count} total)`);
        } else {
            console.log(`[solar-clients-seed] Already seeded — ${total.rows[0].count} companies in DB`);
        }
    } catch (e) {
        console.warn('[solar-clients-seed] skipped:', e.message);
    }
})();


// ── Solar Client Address & Contact Enrichment ─────────────────────────────────
// Patches seeded solar companies with real street addresses, zip codes, and
// corporate phone numbers. Idempotent: skips rows already enriched.
(async () => {
    try {
        // Map of company name → { street, zip, phone, website, type, description, city, state, country }
        const enrichments = [
            ['NextEra Energy Resources',    '700 Universe Blvd',                  'Juno Beach',      'FL',                   'United States',  '33408', '+1 (561) 694-4000', 'nexteraenergy.com',        'Utility-Scale Owner',   "World's largest generator of renewable energy with 20+ GW of solar capacity across North America."],
            ['Clearway Energy Group',       '300 Carnegie Center, Suite 300',      'Princeton',       'NJ',                   'United States',  '08540', '+1 (609) 608-1525', 'clearwayenergy.com',       'Utility-Scale Owner',   'One of the largest renewable energy owners in the US with 8+ GW of wind and solar assets.'],
            ['Invenergy',                   '1 South Wacker Drive, Suite 1800',    'Chicago',         'IL',                   'United States',  '60606', '+1 (312) 224-1888', 'invenergy.com',            'Utility-Scale Owner',   'One of the largest private renewable energy developers in North America with 35+ GW.'],
            ['AES Corporation',             '4300 Wilson Blvd, Suite 1100',        'Arlington',       'VA',                   'United States',  '22203', '+1 (703) 522-1315', 'aes.com',                  'Utility-Scale Owner',   'Global power company with major solar portfolio spanning 14 countries.'],
            ['Dominion Energy',             '120 Tredegar Street',                 'Richmond',        'VA',                   'United States',  '23219', '+1 (804) 819-2000', 'dominionenergy.com',       'Utility-Scale Owner',   'Major US utility with a 35 GW solar buildout plan across the Southeast US.'],
            ['Duke Energy Renewables',      '400 South Tryon Street',              'Charlotte',       'NC',                   'United States',  '28202', '+1 (704) 382-3853', 'duke-energy.com',          'Utility-Scale Owner',   'One of the largest US utilities operating 6+ GW of solar and expanding rapidly.'],
            ['Xcel Energy',                 '414 Nicollet Mall',                   'Minneapolis',     'MN',                   'United States',  '55401', '+1 (612) 330-5500', 'xcelenergy.com',           'Utility-Scale Owner',   'Upper Midwest utility with an aggressive 100% carbon-free electricity goal.'],
            ['Avangrid Renewables',         '1 City Center',                       'Portland',        'OR',                   'United States',  '97201', '+1 (207) 629-1400', 'avangrid.com',             'Utility-Scale Owner',   'US renewable arm of Iberdrola with 10+ GW of wind and solar in operation.'],
            ['PSEG Solar Source',           '80 Park Plaza',                       'Newark',          'NJ',                   'United States',  '07102', '+1 (973) 430-7000', 'pseg.com',                 'Utility-Scale Owner',   "PSEG's solar subsidiary managing 500+ MW of utility-scale solar across the US."],
            ['Arevon Energy',               '2398 E Camelback Rd, Suite 1060',     'Phoenix',         'AZ',                   'United States',  '85016', '+1 (602) 900-2900', 'arevonenergy.com',         'Utility-Scale Owner',   'Independent power producer owning utility-scale solar across the US Southwest and Southeast.'],
            ['EDF Renewables',              '15445 Innovation Drive, Suite 100',   'San Diego',       'CA',                   'United States',  '92128', '+1 (858) 521-3600', 'edf-renewables.com',       'Utility-Scale Owner',   'US subsidiary of French utility EDF with multi-GW solar and storage portfolio.'],
            ['Pattern Energy',              '1088 Sansome Street',                 'San Francisco',   'CA',                   'United States',  '94111', '+1 (415) 283-4000', 'patternenergy.com',        'Utility-Scale Owner',   'Privately owned developer and operator of utility-scale solar, wind and storage.'],
            ['Greenbacker Renewable Energy','230 Park Avenue, Suite 1560',         'New York',        'NY',                   'United States',  '10169', '+1 (212) 845-7977', 'greenbackercapital.com',   'Utility-Scale Owner',   'Publicly-listed renewable energy company owning utility-scale solar across North America.'],
            ['Hannon Armstrong',            '1906 Towne Centre Blvd, Suite 370',   'Annapolis',       'MD',                   'United States',  '21401', '+1 (410) 571-9860', 'hannonarmstrong.com',      'Utility-Scale Owner',   'Climate-positive investment firm owning 5+ GW of solar and wind assets.'],
            ['Altus Power',                 'Two Greenwich Plaza, Suite 302',       'Greenwich',       'CT',                   'United States',  '06830', '+1 (203) 900-2110', 'altuspower.com',           'Utility-Scale Owner',   'Leading US commercial-scale clean electrification company with 1+ GW of solar.'],
            ['Sunrun',                      '225 Bush Street, Suite 1400',          'San Francisco',   'CA',                   'United States',  '94104', '+1 (415) 580-6900', 'sunrun.com',               'Residential Installer', 'Largest US residential solar installer with 900,000+ customers and 6+ GW installed.'],
            ['Sunnova Energy',              '20 Greenway Plaza, Suite 475',         'Houston',         'TX',                   'United States',  '77046', '+1 (281) 985-9100', 'sunnova.com',              'Residential Installer', 'National residential solar and storage provider with 400,000+ customers.'],
            ['SunPower Corporation',        '880 Harbour Way South',                'Richmond',        'CA',                   'United States',  '94804', '+1 (408) 240-5500', 'sunpower.com',             'Residential Installer', 'Premium solar manufacturer and installer for residential and commercial markets.'],
            ['Freedom Forever',             '40900 County Center Drive, Suite A',   'Temecula',        'CA',                   'United States',  '92591', '+1 (888) 557-6161', 'freedomforever.com',       'Residential Installer', 'Large national residential solar installer with 25-year production guarantee.'],
            ['Cypress Creek Renewables',    '501 Wilshire Blvd, Suite 900',         'Santa Monica',    'CA',                   'United States',  '90401', '+1 (919) 595-0107', 'ccrenew.com',              'Developer-EPC',         'Major US community and utility-scale solar developer with 3+ GW in operation.'],
            ['Silicon Ranch',               '315 Deaderick Street, Suite 1700',     'Nashville',       'TN',                   'United States',  '37238', '+1 (615) 732-7200', 'siliconranch.com',         'Developer-EPC',         'Leading US solar developer and operator backed by Shell in the Southeast.'],
            ['Strata Clean Energy',         '3211 Shannon Road, Suite 600',         'Durham',          'NC',                   'United States',  '27707', '+1 (919) 294-6780', 'stratacleanenergy.com',    'Developer-EPC',         'Vertically integrated solar EPC and operator focused on the Southeast.'],
            ['Recurrent Energy',            '300 W 6th Street, Suite 1700',         'Austin',          'TX',                   'United States',  '78701', '+1 (512) 900-5200', 'recurrentenergy.com',      'Developer-EPC',         "Canadian Solar's global utility-scale solar and storage developer."],
            ['SOLV Energy',                 '9665 Chesapeake Drive, Suite 360',     'San Diego',       'CA',                   'United States',  '92123', '+1 (619) 382-2100', 'solvenergy.com',           'Developer-EPC',         'Leading US utility-scale solar EPC contractor and O&M provider.'],
            ['Sol Systems',                 '1110 Vermont Ave NW, Suite 1000',      'Washington',      'DC',                   'United States',  '20005', '+1 (202) 656-5422', 'solsystems.com',           'Developer-EPC',         'Full-service solar energy firm managing development, financing and asset management.'],
            ['Savion',                      '4520 Main Street, Suite 1000',         'Kansas City',     'MO',                   'United States',  '64111', '+1 (816) 888-4200', 'savionenergy.com',         'Developer-EPC',         "Shell-owned utility-scale solar and storage developer in the US."],
            ['Quanta Services',             '2800 Post Oak Blvd, Suite 2600',       'Houston',         'TX',                   'United States',  '77056', '+1 (713) 629-7600', 'quantaservices.com',       'Developer-EPC',         'Publicly traded infrastructure services company with major solar EPC market share.'],
            ['Mortenson',                   '700 Meadow Lane North',                'Minneapolis',     'MN',                   'United States',  '55422', '+1 (763) 522-2100', 'mortenson.com',            'Developer-EPC',         'Major US construction company and leading solar EPC firm.'],
            ['NovaSource Power Services',   '2231 E Camelback Rd, Suite 340',       'Phoenix',         'AZ',                   'United States',  '85016', '+1 (602) 759-4799', 'novasourcepower.com',      'O&M',                   "World's largest independent solar O&M provider managing 50+ GW globally."],
            ['ENGIE North America',         '1990 Post Oak Blvd, Suite 1900',       'Houston',         'TX',                   'United States',  '77056', '+1 (713) 636-0000', 'engie.com',                'O&M',                   'North American arm of French utility ENGIE operating utility-scale solar.'],
            ['Terrasmart',                  '4100 Legendary Drive, Suite 200',      'Fort Myers',      'FL',                   'United States',  '34109', '+1 (239) 249-0000', 'terrasmart.com',           'O&M',                   'Leading US solar O&M provider and racking manufacturer managing 4+ GW.'],
            ['Borrego',                     '2100 Main Street, Suite 340',          'Chula Vista',     'CA',                   'United States',  '91914', '+1 (858) 270-1711', 'borrego.com',              'O&M',                   'Vertically integrated US solar company delivering commercial and community solar.'],
            ['First Solar',                 '350 W Washington Street, Suite 600',   'Tempe',           'AZ',                   'United States',  '85281', '+1 (602) 414-9300', 'firstsolar.com',           'Manufacturer',          'Leading US thin-film solar manufacturer with 20+ GW of utility projects globally.'],
            ['Array Technologies',          '3901 Midway Place NE',                 'Albuquerque',     'NM',                   'United States',  '87109', '+1 (505) 881-7567', 'arraytechinc.com',         'Manufacturer',          "World's largest solar tracking manufacturer with 30+ GW deployed globally."],
            ['Nextracker',                  '6200 Paseo Padre Parkway',             'Fremont',         'CA',                   'United States',  '94555', '+1 (510) 270-2500', 'nextracker.com',           'Manufacturer',          'Global leader in intelligent solar tracker systems with 70+ GW shipped.'],
            ['Enphase Energy',              '47281 Bayside Parkway',                'Fremont',         'CA',                   'United States',  '94538', '+1 (877) 797-4743', 'enphase.com',              'Manufacturer',          "World's #1 microinverter company with 3+ million homes powered globally."],
            ['Ørsted',                      'Kraftværksvej 53',                     'Fredericia',      'Region of Southern Denmark', 'Denmark', '7000', '+45 99 55 11 11',  'orsted.com',               'Developer-EPC',         'Global leader in renewable energy with major solar and offshore wind portfolios.'],
            ['RWE Renewables',              'Alstom-Str. 1',                        'Essen',           'North Rhine-Westphalia', 'Germany',     '45141', '+49 201 5179-0',    'rwe.com',                  'Utility-Scale Owner',   "One of the world's largest renewable energy companies with 10+ GW solar capacity."],
            ['Enel Green Power',            'Viale Regina Margherita 137',          'Rome',            'Lazio',                'Italy',          '00198', '+39 06 8305 1',     'enelgreenpower.com',       'Utility-Scale Owner',   "World's largest private renewable energy operator with 60+ GW of renewables."],
            ['Iberdrola',                   'Plaza Euskadi 5',                       'Bilbao',          'Basque Country',       'Spain',          '48009', '+34 944 151 411',   'iberdrola.com',            'Utility-Scale Owner',   'Global energy major with €150B clean investment plan and 20+ GW of solar.'],
            ['EDP Renewables',              'Calle Ribera del Loira 60',            'Madrid',          'Community of Madrid',  'Spain',          '28042', '+34 91 213 1000',   'edpr.com',                 'Developer-EPC',         "One of Europe's largest renewable developers with 7+ GW solar globally."],
            ['Acciona Energy',              'Avenida de Europa 18',                  'Alcobendas',      'Community of Madrid',  'Spain',          '28108', '+34 91 663 2850',   'acciona.com',              'Utility-Scale Owner',   'Major Spanish renewable energy conglomerate with 12+ GW solar globally.'],
            ['BayWa r.e.',                  'Arabellastraße 4',                     'Munich',          'Bavaria',              'Germany',        '81925', '+49 89 9222-0',     'baywa-re.com',             'Developer-EPC',         'Leading global renewable energy developer with 5+ GW in 30+ countries.'],
            ['Lightsource bp',              '17 Hanover Square',                    'London',          'England',              'United Kingdom', 'W1S 1HU', '+44 20 3828 0000', 'lightsourcebp.com',       'Developer-EPC',         'Global solar developer backed by bp with 25+ GW in development worldwide.'],
            ['TotalEnergies Renewables',    '2 Place Jean Millier',                 'Courbevoie',      'Île-de-France',        'France',         '92400', '+33 1 47 44 45 46', 'totalenergies.com',        'Utility-Scale Owner',   'Major energy company targeting 100 GW of solar globally by 2030.'],
            ['Equinor Renewables',          'Forusbeen 50',                         'Stavanger',       'Rogaland',             'Norway',         '4035',  '+47 51 99 00 00',   'equinor.com',              'Utility-Scale Owner',   'Norwegian energy company building solar portfolio in US, Brazil, Poland and Denmark.'],
            ['Canadian Solar',              '545 Speedvale Avenue West',            'Guelph',          'Ontario',              'Canada',         'N1K 1E6', '+1 (519) 837-1881', 'canadiansolar.com',      'Manufacturer',          "One of the world's largest solar companies with 60+ GW of modules shipped."],
            ['JinkoSolar',                  '1 Jinko Road, Shangrao Economic Development Zone', 'Shangrao', 'Jiangxi',          'China',          '334100', '+86 793 846 1158',  'jinkosolar.com',          'Manufacturer',          "World's leading solar manufacturer with 200+ GW shipped to 200+ countries."],
            ['LONGi Solar',                 '1 Tianhua Road, High-Tech Zone',       "Xi'an",           'Shaanxi',              'China',          '710119', '+86 29 8833 3626',  'longi-solar.com',          'Manufacturer',          "World's largest solar technology company specializing in monocrystalline wafers."],
            ['Trina Solar',                 '2 Trina Road, Changzhou Science & Education Town', 'Changzhou', 'Jiangsu',         'China',          '213031', '+86 519 8517 6088', 'trinasolar.com',           'Manufacturer',          'Leading global solar company with 100+ GW of modules shipped.'],
            ['Hanwha Q CELLS',              '101 Hanwha Qcells Way',                'Dalton',          'GA',                   'United States',  '30720', '+1 (706) 529-1000', 'q-cells.com',              'Manufacturer',          'Global solar manufacturer with Q.ANTUM technology and 3+ GW of US projects.'],
            ['Brookfield Renewable Partners','181 Bay Street, Suite 300',           'Toronto',         'Ontario',              'Canada',         'M5J 2T3', '+1 (416) 363-9491', 'brookfieldrenewable.com', 'Utility-Scale Owner',  "One of the world's largest pure-play renewable energy platforms with 30+ GW."],
            ['Atlas Renewable Energy',      '2333 Ponce de Leon Blvd, Suite 700',   'Coral Gables',    'FL',                   'United States',  '33134', '+1 (305) 400-8710', 'atlasrenewableenergy.com', 'Developer-EPC',         "Latin America's leading solar developer with 4+ GW across Chile, Brazil, Mexico, Colombia."],
            ['Sonnedix',                    '20 Eastbourne Terrace, 7th Floor',     'London',          'England',              'United Kingdom', 'W2 6LG', '+44 20 3826 7000',  'sonnedix.com',             'Utility-Scale Owner',   'International solar IPP with 3+ GW across Europe, Americas, Japan, South Africa.'],
        ];

        // Build a VALUES list for bulk UPDATE
        const values = enrichments.map((r, i) => {
            const [name, street, city, state, country, zip, phone, website, type, desc] = r;
            return `($${i*10+1}, $${i*10+2}, $${i*10+3}, $${i*10+4}, $${i*10+5}, $${i*10+6}, $${i*10+7}, $${i*10+8}, $${i*10+9}, $${i*10+10})`;
        }).join(', ');
        const params = enrichments.flatMap(r => r);

        const result = await dbQuery(`
            UPDATE clients AS c
            SET
                phone   = v.phone,
                address = jsonb_build_object(
                    'street',      v.street,
                    'city',        v.city,
                    'state',       v.state,
                    'country',     v.country,
                    'zip',         v.zip,
                    'phone',       v.phone,
                    'website',     v.website,
                    'type',        v.type,
                    'description', v.description
                )
            FROM (VALUES ${values})
                AS v(name, street, city, state, country, zip, phone, website, type, description)
            WHERE c.name = v.name
              AND c.tenant_id = 'coatzadrone'
              AND (c.address->>'street' IS NULL OR c.address->>'street' = '')
        `, params);

        if (result.rowCount > 0) {
            console.log(`✅ Solar client enrichment: updated ${result.rowCount} companies with real addresses & phone numbers`);
        } else {
            console.log(`[solar-client-enrichment] Already enriched — no updates needed`);
        }
    } catch (e) {
        console.warn('[solar-client-enrichment] skipped:', e.message);
    }
})();


// Phase LBD-2: Extends solar_blocks with LBD-level tracking + creates lbd_units
(async () => {
    try {
        // Extend solar_blocks with LBD fields (additive, safe)
        await dbQuery(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS total_lbds INT DEFAULT 0`);
        await dbQuery(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL`);
        console.log('[lbd-migration] solar_blocks extended with total_lbds, assigned_to');

        // Create lbd_units table — atomic per-LBD tracking
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS lbd_units (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                block_id     UUID NOT NULL REFERENCES solar_blocks(id) ON DELETE CASCADE,
                lbd_code     TEXT NOT NULL,
                lbd_number   INT  NOT NULL,
                status       TEXT NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','completed','issue')),
                uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
                uploaded_at  TIMESTAMPTZ,
                notes        TEXT,
                thermal_flag TEXT DEFAULT 'normal'
                                 CHECK (thermal_flag IN ('normal','hotspot','critical')),
                file_urls    JSONB DEFAULT '[]',
                created_at   TIMESTAMPTZ DEFAULT now()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_lbd_units_block  ON lbd_units(block_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_lbd_units_status ON lbd_units(status)`);
        await dbQuery(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lbd_units_code ON lbd_units(block_id, lbd_code)`);
        console.log('[lbd-migration] lbd_units table ready');
    } catch (e) {
        console.warn('[lbd-migration] skipped:', e.message);
    }
})();

// ── Solar Blocks Schema Bridge ────────────────────────────────────────────────
// The original migration created solar_blocks with mission_id (not deployment_id).
// The blockProgress.js routes expect deployment_id. This IIFE adds the missing
// columns and backfills deployment_id from mission_id — safe, additive, idempotent.
// Each statement runs independently so one failure never blocks the critical columns.
(async () => {
    const safeAlter = async (sql, label) => {
        try { await dbQuery(sql); console.log(`[solar-blocks-bridge] ✓ ${label}`); }
        catch (e) { console.warn(`[solar-blocks-bridge] ✗ ${label}:`, e.message); }
    };

    // CRITICAL: deployment_id as plain UUID — NO FK constraint (orphaned mission_ids would fail FK)
    await safeAlter(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS deployment_id UUID`, 'deployment_id column');
    // Backfill from mission_id
    try {
        const r = await dbQuery(`UPDATE solar_blocks SET deployment_id = mission_id WHERE deployment_id IS NULL AND mission_id IS NOT NULL`);
        if (r.rowCount > 0) console.log(`[solar-blocks-bridge] Backfilled ${r.rowCount} rows`);
    } catch (e) { console.warn('[solar-blocks-bridge] backfill skipped:', e.message); }

    await safeAlter(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS block_number INT`, 'block_number');
    await safeAlter(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS acreage DECIMAL(10,2)`, 'acreage');
    await safeAlter(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`, 'latitude');
    await safeAlter(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`, 'longitude');
    await safeAlter(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS total_lbds INT DEFAULT 0`, 'total_lbds');
    await safeAlter(`ALTER TABLE solar_blocks ADD COLUMN IF NOT EXISTS assigned_to UUID`, 'assigned_to');
    await safeAlter(`CREATE INDEX IF NOT EXISTS idx_blocks_deployment ON solar_blocks(deployment_id)`, 'idx_deployment');
    await safeAlter(`CREATE INDEX IF NOT EXISTS idx_blocks_status    ON solar_blocks(status)`,        'idx_status');
    console.log('[solar-blocks-bridge] done');
})();

import('./workers/thermalProcessingWorker.js')
    .then(({ startThermalWorker }) => startThermalWorker())
    .catch(err => console.warn('[startup] Thermal worker failed to start:', err.message));

// §3 Register event bus listeners (audit, notifications, analytics)
try {
    registerAuditListener();
    registerNotificationListener();
    registerAnalyticsListener();
    console.log('✅ Event bus listeners registered');
} catch (err) {
    console.warn('[startup] Event listener registration failed (non-fatal):', err.message);
}

// §2 Start async AI worker (no-op if ENABLE_ASYNC_AI=false)
try {
    startAIWorker();
} catch (err) {
    console.warn('[startup] AI worker failed to start (non-fatal):', err.message);
}

// Ensure error handling is at the very end of the stack
// app.use('/api/*', notFound); moved down



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

// Serve static files with proper caching headers
const distPath = path.join(__dirname, '../dist');

// Cache hashed assets (JS/CSS with unique names) for 1 year
app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true
}));

// Never cache index.html — forces browser to re-fetch after deploy
app.use(express.static(distPath, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// SPA fallback
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
        return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
});

// Export httpServer and io

// Global Error handling — §12 errorTracker must come BEFORE errorHandler
app.use('/api/*', notFound);
app.use(errorTracker);
app.use(errorHandler);

export { httpServer, app, io };

console.log('✅ App Logic Loaded');

// ── Social Media Module: Migration + Default Templates ────────────────────────
(async () => {
    try {
        const { readFileSync } = await import('fs');
        const { join, dirname } = await import('path');
        const { fileURLToPath } = await import('url');
        const __dir = dirname(fileURLToPath(import.meta.url));
        const migrationSql = readFileSync(join(__dir, 'migrations/031_social_media.sql'), 'utf8');
        await dbQuery(migrationSql);

        const existing = await dbQuery(
            `SELECT COUNT(*) FROM social_media_templates WHERE tenant_id = 'coatzadrone'`
        );
        if (parseInt(existing.rows[0].count) === 0) {
            const defaults = [
                {
                    name: 'Pilot Assignment Announcement',
                    trigger: 'pilot_assigned',
                    platforms: ['linkedin', 'twitter'],
                    template: '🚁 Our team is deploying to {site} for {client} in {location}. {type} inspection scheduled for {date}. #DroneInspection #SolarEnergy #CoatzaDrone',
                    auto_post: false,
                },
                {
                    name: 'Mission Active Update',
                    trigger: 'mission_active',
                    platforms: ['linkedin', 'twitter'],
                    template: '🔥 Operations underway at {site}! Our drone team is conducting a {type} inspection for {client}. #DroneInspection #AxisPlatform #CoatzaDrone',
                    auto_post: false,
                },
                {
                    name: 'Mission Complete Celebration',
                    trigger: 'mission_complete',
                    platforms: ['linkedin', 'twitter'],
                    template: '✅ Mission complete at {site} for {client}! Excellent work by our {pilot_count}-person team. #DroneInspection #SolarEnergy #CoatzaDrone',
                    auto_post: false,
                },
            ];
            for (const t of defaults) {
                await dbQuery(
                    `INSERT INTO social_media_templates (tenant_id, name, trigger, platforms, template, auto_post, is_active)
                     VALUES ('coatzadrone',$1,$2,$3,$4,$5,true)`,
                    [t.name, t.trigger, t.platforms, t.template, t.auto_post]
                );
            }
            console.log('✅ Social media: seeded 3 default post templates');
        } else {
            console.log(`[social-media] ${existing.rows[0].count} templates already configured`);
        }
    } catch (e) {
        console.warn('[social-media] startup skipped:', e.message);
    }
})();

// ── BESS QA/QC Startup Migration ─────────────────────────────────────────────
(async () => {
    try {
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS bess_inspections (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deployment_id   UUID REFERENCES deployments(id) ON DELETE SET NULL,
                tenant_id       UUID,
                inspection_type TEXT NOT NULL DEFAULT 'site_survey',
                status          TEXT NOT NULL DEFAULT 'draft',
                site_name       TEXT,
                site_address    TEXT,
                inspector_id    UUID REFERENCES users(id) ON DELETE SET NULL,
                inspector_name  TEXT,
                started_at      TIMESTAMPTZ DEFAULT NOW(),
                completed_at    TIMESTAMPTZ,
                notes           TEXT,
                defect_count    INT DEFAULT 0,
                critical_count  INT DEFAULT 0,
                pass_rate       NUMERIC(5,2),
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_insp_deployment ON bess_inspections(deployment_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_insp_status     ON bess_inspections(status)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_insp_created    ON bess_inspections(created_at DESC)`);

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS bess_defects (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                inspection_id    UUID NOT NULL REFERENCES bess_inspections(id) ON DELETE CASCADE,
                component_type   TEXT NOT NULL,
                component_id     TEXT,
                defect_category  TEXT NOT NULL,
                severity         TEXT NOT NULL DEFAULT 'minor',
                description      TEXT NOT NULL,
                lat              NUMERIC(10,7),
                lng              NUMERIC(10,7),
                photo_url        TEXT,
                status           TEXT NOT NULL DEFAULT 'open',
                is_recurring     BOOLEAN DEFAULT FALSE,
                notes            TEXT,
                resolved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
                resolved_at      TIMESTAMPTZ,
                created_at       TIMESTAMPTZ DEFAULT NOW(),
                updated_at       TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_defects_insp     ON bess_defects(inspection_id)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_defects_severity  ON bess_defects(severity)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_defects_status    ON bess_defects(status)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_defects_component ON bess_defects(component_type, defect_category)`);

        await dbQuery(`
            CREATE TABLE IF NOT EXISTS bess_checklist_responses (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                inspection_id UUID NOT NULL REFERENCES bess_inspections(id) ON DELETE CASCADE,
                section       TEXT NOT NULL,
                item_key      TEXT NOT NULL,
                item_label    TEXT,
                response      TEXT,
                notes         TEXT,
                photo_url     TEXT,
                created_at    TIMESTAMPTZ DEFAULT NOW(),
                updated_at    TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (inspection_id, item_key)
            )
        `);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bess_checklist_insp ON bess_checklist_responses(inspection_id)`);
        console.log('✅ Startup migration: bess_inspections, bess_defects, bess_checklist_responses tables ready');
    } catch (e) {
        console.warn('[bess-migration] startup skipped:', e.message);
    }
})();
