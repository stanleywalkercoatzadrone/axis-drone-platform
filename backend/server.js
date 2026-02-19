import './config/env.js';
import { createServer } from 'http';

// IMMEDIATE Logging
console.log('🚀 INITIALIZING CONTAINER...');
console.log(`ℹ️  Time: ${new Date().toISOString()}`);
console.log(`ℹ️  NODE_ENV: ${process.env.NODE_ENV}`);

// Global Crash Handlers (Set these up BEFORE importing anything else)
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL: UNCAUGHT EXCEPTION 🔥');
    console.error(err);
    // On Cloud Run, it is better to exit so a new container is started
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 CRITICAL: UNHANDLED REJECTION 🔥');
    console.error(reason);
    process.exit(1);
});

// STARTUP WRAPPER
(async () => {
    const PORT = process.env.PORT || 8080;

    // 1. Start PROBE Server immediately to satisfy Cloud Run
    // This ensures logs are flushed and container doesn't "timeout" silently
    const probeServer = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Server is starting up... Please wait.');
    });

    probeServer.listen(PORT, '0.0.0.0', () => {
        console.log('----------------------------------------');
        console.log(`🔍 PROBE SERVER LISTENING ON PORT ${PORT}`);
        console.log('   Waiting for application to load...');
        console.log('----------------------------------------');
    });

    try {
        console.log('step_1_loading_app: Importing app.js...');
        const { httpServer } = await import('./app.js');
        console.log('step_1_success: app.js loaded');

        console.log('step_2_loading_db: Importing database config...');
        const { default: pool } = await import('./config/database.js');
        console.log('step_2_success: Database config loaded');

        // Check DB in background (don't block)
        (async () => {
            try {
                console.log('step_3_db_check: Testing connection...');
                const res = await pool.query('SELECT NOW() as now');
                console.log('step_3_success: DB Connected', res.rows[0].now);
            } catch (dbErr) {
                console.error('step_3_fail: DB Connection Error', dbErr.message);
            }
        })();

        // 3. Switch to Real Server
        // CRITICAL FIX: probeServer.close() only stops NEW connections — its callback
        // never fires if there's an active keep-alive connection (e.g. Cloud Run health probe).
        // This means httpServer.listen() is never called and the server hangs forever.
        // Fix: force-close all connections first, then start the real server.
        console.log('step_4_switching: Closing probe and starting real server...');

        let realServerStarted = false;
        const startRealServer = () => {
            if (realServerStarted) return; // Guard against double-call
            realServerStarted = true;
            httpServer.listen(PORT, '0.0.0.0', () => {
                console.log('----------------------------------------');
                console.log(`✅ REAL SERVER STARTED SUCCESSFULLY`);
                console.log(`📡 Listening on PORT: ${PORT}`);
                console.log('----------------------------------------');
            });
        };

        // Force-drop all existing probe connections (Node 18.2+), then close
        if (typeof probeServer.closeAllConnections === 'function') {
            probeServer.closeAllConnections();
        }
        probeServer.close(() => {
            console.log('   Probe closed.');
            startRealServer();
        });

        // Safety fallback: if probe.close() callback doesn't fire within 2s
        // (happens when an active connection is held open), start real server anyway
        setTimeout(() => {
            if (!realServerStarted) {
                console.warn('⚠️  Probe close timed out — force-starting real server');
                startRealServer();
            }
        }, 2000);

        // Setup graceful shutdown
        process.on('SIGTERM', () => {
            console.log('📥 SIGTERM received. Shutting down...');
            httpServer.close(() => {
                console.log('✅ Server closed.');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ FATAL ERROR DURING STARTUP ❌');
        console.error(error);
        // Keep probe running so we can see logs? 
        // No, better to exit so Cloud Run restarts or we see crash
        process.exit(1);
    }
})();
