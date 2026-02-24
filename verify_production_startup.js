
process.env.NODE_ENV = 'production';
process.env.PORT = 8081; // Use different port to avoid conflict
process.env.STORAGE_PROVIDER = 'local';
process.env.GCP_PROJECT_ID = 'axis-platform-484701'; // Mock ID

console.log('🔍 Verifying Production Startup...');

import('./backend/server.js').then(() => {
    console.log('✅ Import resolved.');
    // Keep alive for a few seconds to see if it stays up
    setTimeout(() => {
        console.log('✅ App stayed alive for 5s. Exiting.');
        process.exit(0);
    }, 5000);
}).catch(err => {
    console.error('❌ Import failed:', err);
    process.exit(1);
});
