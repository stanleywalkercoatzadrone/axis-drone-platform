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
import clientPortalRoutes from './routes/clientPortal.js';           // Client Portal Scoped Views
import vendorExpensesRoutes from './routes/vendorExpenses.js';        // Vendor & Expenses Ledger
import migrationsRoutes from './routes/migrations.js';                // Emergency DB Migrations
import aiRoutes from './routes/ai.js';                                // AI Bridge Routes
import protocolRoutes from './routes/protocols.js';                   // Operational Protocols SOP library
import tenantRoutes from './routes/tenants.js';                       // SaaS Tenant Registration & Management
import subscriptionInvoiceRoutes from './routes/subscriptionInvoices.js'; // SaaS Client Billing
import chunkedUploadRoutes from './routes/chunkedUploads.js';              // §6 Resumable Upload Routes

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
            scriptSrc: isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'",
                "https://api.openai.com",
                "https://generativelanguage.googleapis.com",
                "https://api.open-meteo.com",               // Weather widget
                "https://geocoding-api.open-meteo.com",     // City autocomplete geocoding
                "https://tile.openweathermap.org",          // Weather tiles
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
app.use('/api/client', clientPortalRoutes);             // Client Portal Scoped Views
app.use('/api/vendor-expenses', vendorExpensesRoutes);  // Vendor & Expenses Ledger
app.use('/api/migrations', migrationsRoutes);           // Emergency DB Migrations
app.use('/api/ai', aiRoutes);                           // AI Bridge Routes (generate-text, report-generate, solar-analyze)
app.use('/api/protocols', protocolRoutes);              // Operational Protocols (SOP library)
app.use('/api/pilot', pilotSecureRoutes);               // Pilot routes alias (frontend calls /pilot/missions etc.)
app.use('/api/uploads', pilotUploadRoutes);             // Upload jobs alias
app.use('/api/uploads', chunkedUploadRoutes);           // §6 Chunked upload endpoints (flag-gated)
app.use('/api/client', clientReportsRoutes);             // Client AI reports

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

// ── LBD Units Migration ───────────────────────────────────────────────────────
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

// Error handling for API routes — §12 errorTracker must come BEFORE errorHandler
app.use('/api/*', notFound);
app.use(errorTracker);
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
app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
});

// Export httpServer and io
export { httpServer, app, io };

console.log('✅ App Logic Loaded');
