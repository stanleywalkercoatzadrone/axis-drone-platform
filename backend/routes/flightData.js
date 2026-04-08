/**
 * Flight Data Ingest Routes
 * Parses KML + flight parameter files (JSON/CSV/TXT) and stores structured data
 * linked to a deployment.
 */
import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
import { query } from '../config/database.js';
import { protect } from '../middleware/auth.js';

// CJS packages — use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── KML Parser ─────────────────────────────────────────────────────────────
function parseKML(kmlText) {
    const result = {
        altitude: null,
        waypoints: [],
        polygons: [],
        area_acres: null,
        waypoint_count: 0,
        site_name: null,
        raw: kmlText,
    };

    try {
        // Extract altitude from <altitude> tags
        const altMatch = kmlText.match(/<altitude>([\d.]+)<\/altitude>/);
        if (altMatch) result.altitude = parseFloat(altMatch[1]);

        // Also check AltitudeMode and stats in ExtendedData
        const extAltMatch = kmlText.match(/<SimpleData name="[Aa]ltitude[^"]*">([\d.]+)<\/SimpleData>/);
        if (extAltMatch && !result.altitude) result.altitude = parseFloat(extAltMatch[1]);

        // Extract name
        const nameMatch = kmlText.match(/<name>([^<]+)<\/name>/);
        if (nameMatch) result.site_name = nameMatch[1].trim();

        // Extract Placemark coordinates (waypoints from LineString or Point)
        const coordBlocks = [...kmlText.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)];
        for (const block of coordBlocks) {
            const raw = block[1].trim();
            const points = raw.split(/\s+/).filter(Boolean).map(p => {
                const [lng, lat, alt] = p.split(',').map(Number);
                // Capture altitude from coordinate if not yet found
                if (alt && !result.altitude) result.altitude = alt;
                return { lat, lng, alt: alt || null };
            });
            if (points.length === 1) {
                result.waypoints.push(points[0]);
            } else if (points.length > 1) {
                // Check if it's a closed polygon (first == last)
                const first = points[0], last = points[points.length - 1];
                if (Math.abs(first.lat - last.lat) < 0.0001 && Math.abs(first.lng - last.lng) < 0.0001) {
                    result.polygons.push(points);
                    // Estimate area using Shoelace formula
                    result.area_acres = estimatePolygonAcres(points);
                } else {
                    result.waypoints.push(...points);
                }
            }
        }

        result.waypoint_count = result.waypoints.length;

        // Also search ExtendedData for common DJI/Litchi fields
        const extFields = {
            altitude: /SimpleData name="(?:Flight_)?[Aa]ltitude[^"]*">([\d.]+)/,
            speed: /SimpleData name="(?:Flight_)?[Ss]peed[^"]*">([\d.]+)/,
            overlap: /SimpleData name="(?:Overlap|[Ff]rontal)[^"]*">([\d.]+)/,
        };

        for (const [key, re] of Object.entries(extFields)) {
            const m = kmlText.match(re);
            if (m) result[key] = parseFloat(m[1]);
        }

    } catch (e) {
        console.warn('[flightData] KML parse warning:', e.message);
    }

    return result;
}

// Area in acres from lat/lng polygon via Shoelace + spherical approx
function estimatePolygonAcres(points) {
    if (points.length < 3) return null;
    let area = 0;
    const n = points.length;
    const R = 6378137; // Earth radius in meters
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const xi = (points[i].lng * Math.PI) / 180 * R * Math.cos((points[i].lat * Math.PI) / 180);
        const yi = (points[i].lat * Math.PI) / 180 * R;
        const xj = (points[j].lng * Math.PI) / 180 * R * Math.cos((points[j].lat * Math.PI) / 180);
        const yj = (points[j].lat * Math.PI) / 180 * R;
        area += xi * yj - xj * yi;
    }
    const sqMeters = Math.abs(area / 2);
    return Math.round((sqMeters / 4047) * 100) / 100; // m² → acres
}

// ─── Flight Params Parser ────────────────────────────────────────────────────
function parseFlightParams(text, mimeType) {
    const params = {};

    try {
        // Try JSON first
        if (mimeType?.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
            const parsed = JSON.parse(text);
            const flat = Array.isArray(parsed) ? parsed[0] : parsed;
            return normalizeParams(flat);
        }

        // Try CSV
        if (text.includes(',') && text.split('\n').length > 1) {
            const lines = text.trim().split('\n');
            if (lines.length === 2) {
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const values = lines[1].split(',').map(v => v.trim());
                const obj = {};
                headers.forEach((h, i) => { obj[h] = values[i]; });
                return normalizeParams(obj);
            }
            // Key,Value format
            for (const line of lines) {
                const [k, v] = line.split(',').map(s => s.trim());
                if (k && v) params[k.toLowerCase().replace(/\s+/g, '_')] = v;
            }
            return normalizeParams(params);
        }

        // Key=Value or Key: Value text format (common in DJI / Litchi exports)
        for (const line of text.split('\n')) {
            const match = line.match(/^([^:=]+)[:=]\s*(.+)$/);
            if (match) {
                const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
                const val = match[2].trim();
                params[key] = val;
            }
        }
        return normalizeParams(params);

    } catch (e) {
        console.warn('[flightData] params parse warning:', e.message);
        return {};
    }
}

// Maps various field name formats to canonical names
function normalizeParams(raw) {
    const aliases = {
        flight_altitude_m: ['altitude', 'flight_altitude', 'flight_height', 'alt', 'height', 'altitude_m', 'flight_altitude_m', 'takeoff_altitude'],
        flight_speed_ms: ['speed', 'flight_speed', 'cruise_speed', 'speed_ms', 'flight_speed_ms', 'velocity'],
        overlap_percent: ['overlap', 'frontal_overlap', 'side_overlap', 'front_overlap', 'overlap_percent', 'ovlp'],
        gsd_cm: ['gsd', 'ground_sample_distance', 'gsd_cm', 'resolution_cm'],
        camera_model: ['camera', 'camera_model', 'sensor', 'payload', 'drone_camera'],
        drone_model: ['drone', 'drone_model', 'aircraft', 'uav', 'vehicle'],
        mission_area_acres: ['area', 'area_acres', 'coverage_area', 'mission_area', 'area_ha'],
    };

    const result = {};

    for (const [canonical, aliasList] of Object.entries(aliases)) {
        for (const alias of aliasList) {
            const val = raw[alias] ?? raw[alias.replace(/_/g, ' ')] ?? raw[alias.replace(/_/g, '')];
            if (val !== undefined && val !== null && val !== '') {
                let num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
                if (canonical === 'camera_model' || canonical === 'drone_model') {
                    result[canonical] = String(val);
                } else if (!isNaN(num)) {
                    // Convert feet to meters for altitude
                    if ((alias.includes('ft') || String(val).toLowerCase().includes('ft') || String(val).toLowerCase().endsWith('feet')) && canonical === 'flight_altitude_m') {
                        num = Math.round(num * 0.3048 * 10) / 10;
                    }
                    // Convert ha to acres
                    if ((alias.endsWith('_ha') || String(val).toLowerCase().includes('ha')) && canonical === 'mission_area_acres') {
                        num = Math.round(num * 2.471 * 100) / 100;
                    }
                    result[canonical] = num;
                }
                break;
            }
        }
    }

    return result;
}

// ─── POST /api/flight-data/ingest ────────────────────────────────────────────
router.post('/ingest', protect, upload.fields([
    { name: 'kml', maxCount: 20 },   // support multiple KML files
    { name: 'params', maxCount: 5 }, // JSON/CSV/TXT/PDF/DOCX
]), async (req, res) => {
    try {
        const { deploymentId } = req.body;
        if (!deploymentId) {
            return res.status(400).json({ success: false, message: 'deploymentId is required' });
        }

        // ── Parse ALL KML files and merge results ──
        let kmlData = { altitude: null, waypoints: [], polygons: [], area_acres: null, waypoint_count: 0, site_name: null, raw: '' };
        const kmlFiles = req.files?.kml ?? [];
        for (const file of kmlFiles) {
            const kmlText = file.buffer.toString('utf-8');
            const parsed = parseKML(kmlText);
            // Merge: prefer first non-null altitude; sum waypoints; sum area
            if (parsed.altitude && !kmlData.altitude) kmlData.altitude = parsed.altitude;
            kmlData.waypoints.push(...parsed.waypoints);
            kmlData.polygons.push(...parsed.polygons);
            if (parsed.area_acres) kmlData.area_acres = (kmlData.area_acres || 0) + parsed.area_acres;
            if (!kmlData.site_name && parsed.site_name) kmlData.site_name = parsed.site_name;
            kmlData.raw += (kmlData.raw ? '\n---\n' : '') + (parsed.raw || '');
        }
        kmlData.waypoint_count = kmlData.waypoints.length;
        if (kmlData.area_acres) kmlData.area_acres = Math.round(kmlData.area_acres * 100) / 100;

        // ── Parse ALL params files (merge results) ──
        let paramsData = {};
        const paramFiles = req.files?.params ?? [];
        for (const file of paramFiles) {
            let text = '';
            const mtype = file.mimetype || '';
            const fname = file.originalname?.toLowerCase() || '';

            try {
                if (mtype.includes('pdf') || fname.endsWith('.pdf')) {
                    // PDF → extract text
                    const pdfResult = await pdfParse(file.buffer);
                    text = pdfResult.text;
                } else if (mtype.includes('wordprocessing') || fname.endsWith('.docx')) {
                    // DOCX → extract text via mammoth
                    const docResult = await mammoth.extractRawText({ buffer: file.buffer });
                    text = docResult.value;
                } else if (fname.endsWith('.doc')) {
                    // Legacy .doc — try reading as text (may get garbage, but often works for simple tables)
                    text = file.buffer.toString('latin1').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, ' ');
                } else {
                    // JSON/CSV/TXT — read as UTF-8
                    text = file.buffer.toString('utf-8');
                }
            } catch (e) {
                console.warn('[flightData] file text extraction warning:', file.originalname, e.message);
                text = file.buffer.toString('utf-8');
            }

            const parsed = parseFlightParams(text, mtype);
            // Merge params — later files overwrite earlier ones for the same field
            Object.assign(paramsData, parsed);
        }

        // Merge: KML data first, then params (params take precedence for altitude etc.)
        const merged = {
            flight_altitude_m: paramsData.flight_altitude_m ?? kmlData.altitude ?? null,
            flight_speed_ms: paramsData.flight_speed_ms ?? null,
            overlap_percent: paramsData.overlap_percent ?? null,
            gsd_cm: paramsData.gsd_cm ?? null,
            camera_model: paramsData.camera_model ?? null,
            drone_model: paramsData.drone_model ?? null,
            mission_area_acres: paramsData.mission_area_acres ?? kmlData.area_acres ?? null,
            waypoint_count: kmlData.waypoint_count ?? null,
            kml_raw: kmlData.raw ?? null,
            params_raw: Object.keys(paramsData).length > 0 ? paramsData : null,
        };

        // Upsert to flight_parameters (one record per deployment, replace on re-upload)
        await query(`
            INSERT INTO flight_parameters
                (deployment_id, flight_altitude_m, flight_speed_ms, overlap_percent, gsd_cm,
                 camera_model, drone_model, mission_area_acres, waypoint_count, kml_raw, params_raw)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (deployment_id) DO UPDATE SET
                flight_altitude_m  = EXCLUDED.flight_altitude_m,
                flight_speed_ms    = EXCLUDED.flight_speed_ms,
                overlap_percent    = EXCLUDED.overlap_percent,
                gsd_cm             = EXCLUDED.gsd_cm,
                camera_model       = EXCLUDED.camera_model,
                drone_model        = EXCLUDED.drone_model,
                mission_area_acres = EXCLUDED.mission_area_acres,
                waypoint_count     = EXCLUDED.waypoint_count,
                kml_raw            = EXCLUDED.kml_raw,
                params_raw         = EXCLUDED.params_raw,
                updated_at         = NOW()
        `, [
            deploymentId,
            merged.flight_altitude_m,
            merged.flight_speed_ms,
            merged.overlap_percent,
            merged.gsd_cm,
            merged.camera_model,
            merged.drone_model,
            merged.mission_area_acres,
            merged.waypoint_count,
            merged.kml_raw,
            merged.params_raw ? JSON.stringify(merged.params_raw) : null,
        ]);

        res.json({
            success: true,
            message: 'Flight data ingested successfully',
            data: merged,
            kmlSummary: {
                waypointCount: kmlData.waypoint_count,
                polygonCount: kmlData.polygons?.length ?? 0,
                siteName: kmlData.site_name,
                altitudeFromKml: kmlData.altitude,
                areaAcres: kmlData.area_acres,
            }
        });

    } catch (err) {
        console.error('[flightData] ingest error:', err);
        res.status(500).json({ success: false, message: 'Failed to ingest flight data', error: err.message });
    }
});

// ─── GET /api/flight-data/:deploymentId ──────────────────────────────────────
router.get('/:deploymentId', protect, async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const result = await query(
            `SELECT * FROM flight_parameters WHERE deployment_id = $1`,
            [deploymentId]
        );
        if (result.rows.length === 0) {
            return res.json({ success: true, data: null });
        }
        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                id: row.id,
                deploymentId: row.deployment_id,
                flightAltitudeM: row.flight_altitude_m ? parseFloat(row.flight_altitude_m) : null,
                flightAltitudeFt: row.flight_altitude_m ? Math.round(parseFloat(row.flight_altitude_m) * 3.28084) : null,
                flightSpeedMs: row.flight_speed_ms ? parseFloat(row.flight_speed_ms) : null,
                overlapPercent: row.overlap_percent ? parseFloat(row.overlap_percent) : null,
                gsdCm: row.gsd_cm ? parseFloat(row.gsd_cm) : null,
                cameraModel: row.camera_model,
                droneModel: row.drone_model,
                missionAreaAcres: row.mission_area_acres ? parseFloat(row.mission_area_acres) : null,
                waypointCount: row.waypoint_count,
                paramsRaw: row.params_raw,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            }
        });
    } catch (err) {
        console.error('[flightData] fetch error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch flight data', error: err.message });
    }
});

export default router;
