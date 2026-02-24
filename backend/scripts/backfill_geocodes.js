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

    // Helper to request from Nominatim
    const fetchFromApi = async (query) => {
        try {
            console.log(`Searching: ${query}`);
            const response = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { format: 'json', q: query, limit: 1 },
                headers: { 'User-Agent': 'Skylens-Enterprise-Platform/1.0 (backfill-script)' }
            });
            if (response.data && response.data.length > 0) {
                return {
                    lat: parseFloat(response.data[0].lat),
                    lng: parseFloat(response.data[0].lon)
                };
            }
        } catch (error) {
            console.error(`Error requesting ${query}:`, error.message);
        }
        return null;
    };

    // 1. Try exact address
    let result = await fetchFromApi(address);
    if (result) return result;

    // 2. Try removing unit/apartment numbers (e.g., "#102", "Apt 5", "Unit B")
    const cleanAddress = address.replace(/(?:#|Unit|Apt|Suite)\s*\w+\d*\b,?/gi, '').replace(/\s+,/g, ',');

    if (cleanAddress !== address) {
        console.log(`Retrying with cleaned address: ${cleanAddress}`);
        result = await fetchFromApi(cleanAddress);
        if (result) return result;
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
