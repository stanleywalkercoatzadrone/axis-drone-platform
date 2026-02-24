import pool from '../backend/config/database.js';

async function verify() {
    try {
        console.log('Verifying Americas Expansion setup...');

        // Check Regions
        const regions = await pool.query('SELECT * FROM regions ORDER BY name');
        console.log('Regions found:', regions.rows.map(r => r.name));
        const requiredRegions = ['Central America', 'North America', 'South America'];
        const missing = requiredRegions.filter(r => !regions.rows.some(row => row.name === r));

        if (missing.length > 0) {
            console.error('❌ Missing Regions:', missing);
            process.exit(1);
        } else {
            console.log('✅ All Americas regions present.');
        }

        // Check Countries
        const countries = await pool.query('SELECT * FROM countries WHERE status=\'ENABLED\'');
        console.log('Enabled Countries:', countries.rows.map(c => c.name));
        if (!countries.rows.some(c => c.name === 'Mexico')) {
            console.warn('⚠️ Mexico is not enabled! Checking database state...');
            const mx = await pool.query('SELECT * FROM countries WHERE name=\'Mexico\'');
            if (mx.rows.length === 0) console.error('❌ Mexico not found in DB at all!');
            else console.log('Mexico status is:', mx.rows[0].status);
        } else {
            console.log('✅ Mexico is properly enabled.');
        }

        console.log('Verification Complete.');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

verify();
