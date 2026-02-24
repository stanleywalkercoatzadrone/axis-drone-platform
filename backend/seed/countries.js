import db from '../config/database.js';
import crypto from 'crypto';

const regions = {
    'NA': 'dad5cb88-479f-4845-800e-582cec0022fd', // North America
    'SA': 'c8bc2e3b-ec56-4922-80d4-09261cae1976', // South America
    'CA': 'bf0683de-718b-4fa4-8567-6404e0759296'  // Central America
};

const countries = [
    { iso_code: 'US', name: 'United States', region_code: 'NA', status: 'ENABLED' },
    { iso_code: 'MX', name: 'Mexico', region_code: 'NA', status: 'ENABLED' },
    { iso_code: 'CL', name: 'Chile', region_code: 'SA', status: 'ENABLED' },
    { iso_code: 'CO', name: 'Colombia', region_code: 'SA', status: 'ENABLED' },
    { iso_code: 'BR', name: 'Brazil', region_code: 'SA', status: 'ENABLED' },
    { iso_code: 'PA', name: 'Panama', region_code: 'CA', status: 'ENABLED' },
    { iso_code: 'CR', name: 'Costa Rica', region_code: 'CA', status: 'ENABLED' },
];

async function seedCountries() {
    console.log('Seeding countries...');
    try {
        for (const c of countries) {
            const regionId = regions[c.region_code];
            if (!regionId) {
                console.warn(`Region not found for ${c.region_code}, skipping ${c.name}`);
                continue;
            }

            // Check availability
            const existing = await db.query('SELECT id FROM countries WHERE iso_code = $1', [c.iso_code]);

            if (existing.rows.length > 0) {
                // Update
                await db.query(`
                UPDATE countries 
                SET name = $1, region_id = $2, status = $3, updated_at = NOW()
                WHERE iso_code = $4
            `, [c.name, regionId, c.status, c.iso_code]);
                console.log(`Updated ${c.name}`);
            } else {
                // Insert
                const newId = crypto.randomUUID();
                await db.query(`
                INSERT INTO countries (id, name, iso_code, region_id, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            `, [newId, c.name, c.iso_code, regionId, c.status]);
                console.log(`Inserted ${c.name}`);
            }
        }
        console.log('All countries processed');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding countries:', err);
        process.exit(1);
    }
}

seedCountries();
