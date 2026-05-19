import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import fs from 'fs';

// Look for .env.local (dev) OR .env (prod fallback due to Cloud Run issues)
const localEnvPath = path.resolve(__dirname, '../../.env.local');
const prodEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
    console.log('✅ Loaded env from .env.local');
} else if (fs.existsSync(prodEnvPath)) {
    dotenv.config({ path: prodEnvPath });
    console.log('✅ Loaded env from .env (Production Injection)');
} else {
    dotenv.config(); // Fallback to system env
    console.log('ℹ️  Using system environment variables');
}

// ── Production Fail-Fast — missing secrets → hard exit ──────────────────────
if (process.env.NODE_ENV === 'production') {
    const REQUIRED = ['JWT_SECRET', 'DATABASE_URL', 'FRONTEND_URL'];
    const missing = REQUIRED.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`❌ FATAL: Missing required environment variables in production: ${missing.join(', ')}`);
        console.error('❌ Set these via Cloud Run secrets or environment configuration.');
        process.exit(1);
    }
    console.log('✅ Required environment variables present.');
}

// Log DB Connection Info (Masked — never logs credentials)
if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        console.log(`📦 DB Config: ${url.protocol}//${url.username}:****@${url.hostname}:${url.port}${url.pathname}`);
    } catch {
        console.log('📦 DB Config: [invalid URL — check DATABASE_URL format]');
    }
} else {
    console.log('⚠️  DATABASE_URL is not set');
}
