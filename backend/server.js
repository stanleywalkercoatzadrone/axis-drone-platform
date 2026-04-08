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
    try {
        console.log('📦 Loading Application Logic...');

        // DYNAMIC IMPORT - This catches hanging dependencies!
        // The server.js body runs immediately, while this import 
        // will resolve only when all dependencies (db, redis, etc) are loaded.

        // Run Migrations (if in production or requested)
        if (process.env.NODE_ENV === 'production') {
            try {
                console.log('🔄 Running Database Migrations...');
                // We use a separate process or just import the runner
                // NOTE: 'run.js' is designed to be a script, so we might need to exec it or slightly modify it to be callable.
                // For safety in this container, we'll try to exec it as a child process to avoid scope pollution,
                // OR if it exports a function, call it. 
                // Let's assume for now we can import it if it has an export, but it likely doesn't.
                // Safest bet: use child_process
                const { execSync } = await import('child_process');
                execSync('node backend/migrations/run.js', { stdio: 'inherit' });
                console.log('✅ Migrations Completed.');
            } catch (migErr) {
                console.error('⚠️ Migration Error (non-fatal, proceeding):', migErr.message);
            }
        }

        const { httpServer } = await import('./app.js');

        const PORT = process.env.PORT || 8080;

        // Start Listening
        httpServer.listen(PORT, '0.0.0.0', async () => {
            console.log('----------------------------------------');
            console.log(`✅ SERVER STARTED SUCCESSFULLY`);
            console.log(`📡 Listening on PORT: ${PORT}`);
            console.log('----------------------------------------');

            // Phase 7: Start nightly forecast scheduler (fully async, never blocks API)
            try {
                const { startForecastScheduler } = await import('./services/forecastScheduler.js');
                startForecastScheduler();
            } catch (schedErr) {
                console.warn('[forecastScheduler] Failed to start (non-fatal):', schedErr.message);
            }
        });

        // Setup graceful shutdown here as well since we own the server instance
        process.on('SIGTERM', () => {
            console.log('📥 SIGTERM received. Shutting down...');
            httpServer.close(() => {
                console.log('✅ Server closed.');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ FATAL ERROR DURING STARTUP ❌');
        console.error('This error occurred while importing the application modules.');
        console.error(error);
        process.exit(1);
    }
})();
