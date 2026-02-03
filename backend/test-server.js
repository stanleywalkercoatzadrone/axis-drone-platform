// Minimal test server to verify Cloud Run container can start
import { createServer } from 'http';

console.log('🚀 MINIMAL TEST SERVER STARTING...');
console.log(`ℹ️  Time: ${new Date().toISOString()}`);
console.log(`ℹ️  NODE_ENV: ${process.env.NODE_ENV}`);

const PORT = process.env.PORT || 8080;

const server = createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            message: 'Minimal test server running'
        }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Minimal test server is running!');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('----------------------------------------');
    console.log(`✅ MINIMAL SERVER STARTED SUCCESSFULLY`);
    console.log(`📡 Listening on PORT: ${PORT}`);
    console.log('----------------------------------------');
});

process.on('SIGTERM', () => {
    console.log('📥 SIGTERM received. Shutting down...');
    server.close(() => {
        console.log('✅ Server closed.');
        process.exit(0);
    });
});
