
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
        const { httpServer } = await import('./app.js');

        const PORT = process.env.PORT || 8080;

        // Start Listening
        httpServer.listen(PORT, '0.0.0.0', () => {
            console.log('----------------------------------------');
            console.log(`✅ SERVER STARTED SUCCESSFULLY`);
            console.log(`📡 Listening on PORT: ${PORT}`);
            console.log('----------------------------------------');
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
