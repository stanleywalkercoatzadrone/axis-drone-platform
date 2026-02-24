
import db from './backend/config/database.js';

async function enableExtension() {
    try {
        await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('✅ uuid-ossp extension enabled (if it was missing)');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to enable extension:', err);
        process.exit(1);
    }
}

enableExtension();
