import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import fs from 'fs';
const envPath = path.resolve(__dirname, '../../.env.local');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('✅ Environment variables loaded from .env.local');
} else {
    dotenv.config(); // Load default .env if exists
    console.log('ℹ️  Using system environment variables');
}
