import db from '../config/database.js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env.local') });

const geocodeAddress = async (address) => {
    if (!address || address.trim().length < 5) return null;
    try {
        console.log(`Searching: ${address}`);
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { format: 'json', q: address, limit: 1 },
            headers: { 'User-Agent': 'Skylens-Enterprise-Platform/1.0 (backfill-script)' }
        });
        if (response.data && response.data.length > 0) {
            return {
                lat: parseFloat(response.data[0].lat),
                lng: parseFloat(response.data[0].lon)
            };
        }
    } catch (error) {
        console.error(`Error geocoding ${address}:`, error.message);
    }
    return null;
};

const runBackfill = async () => {
    try {
        console.log('🔄 Starting geocode backfill...');
        console.log('DB Host:', process.env.DB_HOST || 'via URL');

        const { rows } = await db.query(
            "SELECT id, full_name, home_address FROM personnel WHERE home_address IS NOT NULL AND latitude IS NULL"
        );

        console.log(`Found ${rows.length} personnel needing geocoding.`);

        for (const person of rows) {
            const coords = await geocodeAddress(person.home_address);
            if (coords) {
                await db.query(
                    "UPDATE personnel SET latitude = $1, longitude = $2 WHERE id = $3",
                    [coords.lat, coords.lng, person.id]
                );
                console.log(`✅ Updated ${person.full_name}: ${coords.lat}, ${coords.lng}`);
            } else {
                console.log(`⚠️  Could not locate: ${person.full_name} (${person.home_address})`);
            }
            // Rate limit
            await new Promise(r => setTimeout(r, 1100));
        }

        console.log('✨ Backfill complete.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
};

runBackfill();
