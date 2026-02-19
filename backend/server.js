import './config/env.js';
import { createServer } from 'http';

// IMMEDIATE Logging
console.log('🚀 INITIALIZING CONTAINER...');
console.log(`ℹ️  Time: ${new Date().toISOString()}`);
console.log(`ℹ️  NODE_ENV: ${process.env.NODE_ENV}`);

// Global Crash Handlers
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL: UNCAUGHT EXCEPTION 🔥');
    console.error(err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('🔥 CRITICAL: UNHANDLED REJECTION 🔥');
    console.error(reason);
    process.exit(1);
});

// STARTUP WRAPPER
(async () => {
    const PORT = process.env.PORT || 8080;
    let appReady = false;
    let expressApp = null;

    // 1. Create ONE persistent HTTP server that stays on port 8080 the entire time.
    //    - During startup: returns a minimal 200 OK for /health (passes Cloud Run TCP probe)
    //    - After app loads: delegates ALL requests to the Express app
    //    This eliminates the port-gap that caused Cloud Run to mark: instances as unhealthy.
    const server = createServer((req, res) => {
        if (appReady && expressApp) {
            // Delegate to Express once loaded
            expressApp(req, res);
        } else {
            // Simple probe response while loading
            if (req.url === '/health' || req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'starting', service: 'Axis Backend' }));
            } else {
                // Return 503 for non-health routes during startup so callers retry
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'starting', error: 'Server is initializing, please retry shortly.' }));
            }
        }
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log('----------------------------------------');
        console.log(`🔍 SERVER LISTENING ON PORT ${PORT}`);
        console.log('   Initializing app logic...');
        console.log('----------------------------------------');
    });

    try {
        console.log('step_1_loading_app: Importing app.js...');
        // Load the full Express app. This replaces the probe response on same server.
        const { default: app } = await import('./app.js');
        console.log('step_1_success: app.js loaded');

        // Check DB in background (don't block)
        (async () => {
            try {
                console.log('step_2_db_check: Testing connection...');
                const { default: pool } = await import('./config/database.js');
                const res = await pool.query('SELECT NOW() as now');
                console.log('step_2_success: DB Connected', res.rows[0].now);
            } catch (dbErr) {
                console.error('step_2_fail: DB Connection Error', dbErr.message);
            }
        })();

        // Hand off: future requests go to Express
        expressApp = app;
        appReady = true;

        console.log('----------------------------------------');
        console.log(`✅ REAL SERVER STARTED SUCCESSFULLY`);
        console.log(`📡 Listening on PORT: ${PORT}`);
        console.log('   (Using persistent single-server handoff — no port gap)');
        console.log('----------------------------------------');

        // Setup graceful shutdown
        process.on('SIGTERM', () => {
            console.log('📥 SIGTERM received. Shutting down...');
            server.close(() => {
                console.log('✅ Server closed.');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ FATAL ERROR DURING STARTUP ❌');
        console.error(error);
        process.exit(1);
    }
})();
