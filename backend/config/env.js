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
