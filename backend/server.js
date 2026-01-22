
import express from 'express';

const app = express();

// Cloud Run supplies the PORT environment variable.
// We default to 8080 if not set (standard practice).
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.status(200).send('Hello from Cloud Run! The container is healthy.');
});

// STARTUP LOGGING is crucial for troubleshooting
console.log(`Starting server...`);

// Bind to 0.0.0.0 to listen on all interfaces (Required for Docker/Cloud Run)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`Press Ctrl+C to quit.`);
});
