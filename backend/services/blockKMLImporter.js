/**
 * blockKMLImporter.js
 * Phase 6 – KML Block Importer Service
 *
 * Parses KML files and creates solar_blocks records.
 * Calculates acreage from polygon coordinates automatically.
 * Does NOT use any external geo library — pure JS polygon area computation.
 */
import { query } from '../config/database.js';

/**
 * Shoelace formula for polygon area in square degrees.
 * @param {Array<[number,number]>} coords - [longitude, latitude] pairs
 * @returns {number} area in square degrees
 */
function polygonAreaSqDegrees(coords) {
    let area = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[(i + 1) % n];
        area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
}

/**
 * Convert square degrees to acres.
 * 1 degree latitude ≈ 111.32 km. 1 degree longitude varies by lat.
 * At centre lat: 1 sq degree ≈ 111.32 * 111.32 km² adjusted by cos(lat).
 * 1 km² = 247.105 acres.
 */
function sqDegreesToAcres(sqDegrees, centroidLat) {
    const latKm = 111.32;
    const lonKm = 111.32 * Math.cos((centroidLat * Math.PI) / 180);
    const sqKm = sqDegrees * latKm * lonKm;
    return sqKm * 247.105;
}

/**
 * Parse KML string and extract placemark polygons.
 * Basic regex-based extraction (no xml2js dependency needed).
 * @param {string} kmlContent
 * @returns {Array<{name: string, coordinates: string}>}
 */
function parseKMLPlacemarks(kmlContent) {
    const placemarks = [];
    const pmRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
    let pmMatch;

    while ((pmMatch = pmRegex.exec(kmlContent)) !== null) {
        const pmBody = pmMatch[1];

        // Extract name
        const nameMatch = pmBody.match(/<name[^>]*>([\s\S]*?)<\/name>/i);
        const name = nameMatch ? nameMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1').trim() : 'Unnamed';

        // Extract polygon coordinates
        const coordMatch = pmBody.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
        if (!coordMatch) continue;

        const coordStr = coordMatch[1].trim();
        placemarks.push({ name, coordinatesString: coordStr });
    }

    return placemarks;
}

/**
 * Parse coordinate string "lon,lat,alt lon,lat,alt ..." into pairs.
 */
function parseCoordinates(coordStr) {
    return coordStr
        .trim()
        .split(/\s+/)
        .map(c => c.split(',').map(parseFloat))
        .filter(c => c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]))
        .map(([lon, lat]) => [lon, lat]);
}

/**
 * Import blocks from KML content into the database.
 * @param {string} deploymentId
 * @param {string} kmlContent - raw KML string
 * @returns {{ created: number, blocks: Array }}
 */
export async function importBlocksFromKML(deploymentId, kmlContent) {
    const placemarks = parseKMLPlacemarks(kmlContent);
    if (placemarks.length === 0) throw new Error('No polygon placemarks found in KML file');

    const created = [];
    let blockNumber = 1;

    // Get highest existing block_number for this deployment
    const existingRes = await query(
        `SELECT MAX(block_number) as max_num FROM solar_blocks WHERE deployment_id = $1`,
        [deploymentId]
    );
    blockNumber = (parseInt(existingRes.rows[0]?.max_num) || 0) + 1;

    for (const pm of placemarks) {
        const coords = parseCoordinates(pm.coordinatesString);
        if (coords.length < 3) continue; // Not a valid polygon

        // Centroid
        const centroidLon = coords.reduce((s, [lon]) => s + lon, 0) / coords.length;
        const centroidLat = coords.reduce((s, [, lat]) => s + lat, 0) / coords.length;

        // Acreage
        const sqDeg = polygonAreaSqDegrees(coords);
        const acreage = Math.round(sqDegreesToAcres(sqDeg, centroidLat) * 100) / 100;

        // Insert block
        const insertRes = await query(
            `INSERT INTO solar_blocks
                (deployment_id, block_name, block_number, acreage, latitude, longitude, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             ON CONFLICT DO NOTHING
             RETURNING *`,
            [deploymentId, pm.name, blockNumber, acreage, centroidLat, centroidLon]
        );

        if (insertRes.rows.length > 0) {
            created.push(insertRes.rows[0]);
            blockNumber++;
        }
    }

    return { created: created.length, blocks: created };
}
