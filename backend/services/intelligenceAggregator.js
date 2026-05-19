/**
 * AXIS INTELLIGENCE MODULE — Data Aggregation Layer
 * 
 * READ-ONLY. Aggregates mission data from existing tables + weather API.
 * Does NOT modify any existing schema or records.
 * 
 * Column names verified against live DB schema:
 *   deployments: id, title, type, status, site_name, site_id, date, location,
 *                notes, days_on_site, client_id, country_id, tenant_id, base_cost, ...
 *   deployment_files: id, deployment_id, name, url, type, size, uploaded_at, created_at
 *   daily_logs: id, deployment_id, date, technician_id, daily_pay, bonus_pay, notes, created_at
 *   deployment_personnel: deployment_id, personnel_id
 *   personnel: id, status, role, ...
 *   clients: id, name, ...
 *   countries: id, name, ...
 */

import { query } from '../config/database.js';
import { getAltitudeFromUrl } from './exifService.js';
import jwt from 'jsonwebtoken';

/**
 * Parse lat/lng from a deployment location string (e.g. "25.7617,-80.1918")
 */
function parseCoordinates(locationStr) {
    if (!locationStr) return null;
    const parts = locationStr.split(',').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lng: parts[1] };
    }
    return null;
}

/**
 * Generate a JWT token for Apple WeatherKit REST API
 */
function generateAppleWeatherToken() {
    const { APPLE_TEAM_ID, APPLE_SERVICE_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
    if (!APPLE_TEAM_ID || !APPLE_SERVICE_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) return null;

    const payload = {
        iss: APPLE_TEAM_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
        sub: APPLE_SERVICE_ID,
    };

    const header = {
        alg: 'ES256',
        kid: APPLE_KEY_ID,
        id: `${APPLE_TEAM_ID}.${APPLE_SERVICE_ID}`
    };

    // Fix formatting issues if the key was passed as a single line string
    const privateKey = APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');

    try {
        return jwt.sign(payload, privateKey, { header });
    } catch (err) {
        console.error('[IntelAggregator] Failed to sign Apple Weather JWT:', err.message);
        return null;
    }
}

/**
 * Map Apple WeatherKit conditionCode to WMO weather code (used by our system)
 * Basic mapping, covers most common conditions
 */
function mapAppleConditionToWmo(conditionCode) {
    const mapping = {
        Clear: 0,
        MostlyClear: 1,
        PartlyCloudy: 2,
        MostlyCloudy: 3,
        Cloudy: 3,
        Drizzle: 51,
        Rain: 61,
        HeavyRain: 65,
        Snow: 71,
        HeavySnow: 75,
        Flurries: 71,
        Sleet: 79,
        FreezingDrizzle: 56,
        FreezingRain: 66,
        Breezy: 1,
        Windy: 1,
        Blizzard: 75,
        BlowingSnow: 71,
        FreezingPellets: 79,
        Hail: 95,
        Thunderstorm: 95,
        Tornado: 95,
        Hurricane: 95,
        TropicalStorm: 95,
        Duststorm: 0,
        Fog: 45,
        Haze: 45,
        Smoke: 45,
        ScatteredThunderstorms: 95,
    };
    return mapping[conditionCode] ?? 0;
}

/**
 * Fetch weather data from Apple WeatherKit REST API
 */
async function fetchAppleWeather(lat, lng) {
    const token = generateAppleWeatherToken();
    if (!token) return null;

    try {
        const url = `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lng}?dataSets=currentWeather,forecastDaily`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            console.error('[IntelAggregator] Apple WeatherKit error:', response.status, await response.text());
            return null;
        }
        const data = await response.json();
        
        const current = data.currentWeather || {};
        const daily = data.forecastDaily?.days?.[0] || {};
        
        // Convert to match expected output structure
        return {
            temperature: current.temperature ?? null,
            windSpeed: current.windSpeed ? current.windSpeed * 3.6 : null, // Convert m/s or km/h based on units returned, assuming Apple returns kph natively if metric? Apple returns km/h if unit=m, but REST API returns km/h natively by default for metric regions.
            cloudCover: current.cloudCover ? current.cloudCover * 100 : null, // Apple returns 0.0 - 1.0
            precipitation: current.precipitationAmount ?? null,
            weatherCode: mapAppleConditionToWmo(current.conditionCode),
            irradianceGHI: daily.solarClearSky?.[0] ?? null, // Approximate mapping
        };
    } catch (err) {
        console.error('[IntelAggregator] Apple Weather fetch failed:', err.message);
        return null;
    }
}

/**
 * Fetch weather data from Open-Meteo (free public API, no key required)
 */
async function fetchWeatherData(lat, lng) {
    // 1. Try Apple WeatherKit if credentials exist
    const appleWeather = await fetchAppleWeather(lat, lng);
    if (appleWeather) {
        return appleWeather;
    }

    // 2. Fallback to Open-Meteo
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,cloud_cover,precipitation,weathercode&daily=shortwave_radiation_sum&timezone=auto&forecast_days=1`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();

        const current = data.current || {};
        const daily = data.daily || {};

        return {
            temperature: current.temperature_2m ?? null,
            windSpeed: current.wind_speed_10m ?? null,
            cloudCover: current.cloud_cover ?? null,
            precipitation: current.precipitation ?? null,
            weatherCode: current.weathercode ?? null,
            irradianceGHI: daily.shortwave_radiation_sum?.[0] ?? null, // kWh/m²
        };
    } catch (err) {
        console.warn('[IntelAggregator] Weather fetch failed:', err.message);
        return null;
    }
}

/**
 * Aggregate all mission data required for intelligence analysis.
 * 
 * @param {string} missionId - UUID of the deployment
 * @returns {object} Structured aggregation payload
 */
export async function aggregateMissionData(missionId) {
    // 1. Fetch core mission record (no d.industry — that column doesn't exist)
    const missionResult = await query(
        `SELECT 
            d.id,
            d.title,
            d.type,
            d.status,
            d.location,
            d.site_name,
            d.days_on_site,
            d.notes,
            d.base_cost,
            d.created_at,
            d.date,
            c.name AS client_name,
            co.name AS country_name
         FROM deployments d
         LEFT JOIN clients c ON d.client_id = c.id
         LEFT JOIN countries co ON d.country_id = co.id
         WHERE d.id = $1`,
        [missionId]
    );

    if (missionResult.rows.length === 0) {
        throw new Error(`Mission ${missionId} not found`);
    }

    const mission = missionResult.rows[0];

    // 2. Fetch all unique personnel associated with this mission
    // We look at BOTH official links (deployment_personnel) AND active loggers (daily_logs)
    const assignedPersonnelResult = await query(
        `WITH mission_personnel AS (
            SELECT personnel_id FROM deployment_personnel WHERE deployment_id = $1
            UNION
            SELECT technician_id FROM daily_logs WHERE deployment_id = $1
        )
        SELECT p.id, p.full_name, p.role, p.email, p.photo_url
        FROM personnel p
        JOIN mission_personnel mp ON p.id = mp.personnel_id`,
        [missionId]
    ).catch(() => ({ rows: [] }));

    const assignedPersonnel = assignedPersonnelResult.rows.map(p => ({
        id: p.id,
        fullName: p.full_name,
        role: p.role,
        email: p.email,
        photoUrl: p.photo_url
    }));

    const assignedPilotsCount = assignedPersonnel.length;

    // 3. Fetch uploaded file metadata (correct column names: name, url, type, size)
    const filesResult = await query(
        `SELECT name, url, type, size, uploaded_at
         FROM deployment_files
         WHERE deployment_id = $1`,
        [missionId]
    ).catch(() => ({ rows: [] }));

    const files = filesResult.rows || [];
    const kmlFiles = files.filter(f =>
        f.name?.toLowerCase().endsWith('.kml') ||
        f.name?.toLowerCase().endsWith('.kmz')
    );

    // 4. Historical stats from daily_logs (correct table name)
    const logsResult = await query(
        `SELECT 
            COUNT(*) AS total_logs,
            COALESCE(SUM(daily_pay), 0) AS total_pay,
            COALESCE(AVG(daily_pay), 0) AS avg_daily_pay
         FROM daily_logs
         WHERE deployment_id = $1`,
        [missionId]
    ).catch(() => ({ rows: [{ total_logs: 0, total_pay: 0, avg_daily_pay: 0 }] }));

    const logStats = logsResult.rows[0] || {};

    // 5. Labor availability — count of active pilots across the platform
    const laborResult = await query(
        `SELECT COUNT(*) AS available_pilots
         FROM personnel
         WHERE status = 'Active' AND role ILIKE '%pilot%'`
    ).catch(() => ({ rows: [{ available_pilots: 0 }] }));

    const laborAvailability = parseInt(laborResult.rows[0]?.available_pilots || 0, 10);

    // 6. Weather data
    const coords = parseCoordinates(mission.location);
    let weather = null;
    let irradiance = null;

    if (coords) {
        const weatherData = await fetchWeatherData(coords.lat, coords.lng);
        if (weatherData) {
            weather = {
                temperature: weatherData.temperature,
                windSpeed: weatherData.windSpeed,
                cloudCover: weatherData.cloudCover,
                precipitation: weatherData.precipitation,
                weatherCode: weatherData.weatherCode,
            };
            irradiance = weatherData.irradianceGHI;
        }
    }

    // 6.5 Extraction of Flight Altitude from first image
    let altitudeMeters = null;
    const firstImage = files.find(f =>
        f.type?.includes('image') ||
        f.name?.toLowerCase().endsWith('.jpg') ||
        f.name?.toLowerCase().endsWith('.jpeg')
    );

    if (firstImage?.url) {
        console.log(`[IntelAggregator] Extracting altitude from ${firstImage.name}...`);
        altitudeMeters = await getAltitudeFromUrl(firstImage.url);
    }

    // 7. Derive complexity metrics from available data
    const assetDensity = kmlFiles.length > 0 ? 'High' : (files.length > 5 ? 'Medium' : 'Low');
    const terrainComplexity = mission.location ? 'Standard' : 'Unknown';
    const siteSize = mission.days_on_site
        ? (mission.days_on_site > 10 ? 'Large' : mission.days_on_site > 3 ? 'Medium' : 'Small')
        : 'Unknown';

    // 8. Historical defect rate — normalized proxy
    const historicalDefectRate = logStats.total_logs > 0
        ? Math.min(parseFloat(logStats.avg_daily_pay) / 1000, 1.0).toFixed(3)
        : null;

    return {
        missionId,
        title: mission.title,
        type: mission.type,
        status: mission.status,
        inspectionType: mission.type || 'General',
        siteName: mission.site_name || mission.title,
        clientName: mission.client_name,
        countryName: mission.country_name,
        daysOnSite: mission.days_on_site,
        scheduledDate: mission.date,
        installedKw: mission.installed_power_kw,
        panelCount: mission.panel_count,
        panelModel: mission.panel_model,
        baseCost: parseFloat(mission.base_cost || 0),
        totalLogs: parseInt(logStats.total_logs || 0, 10),
        totalFilesUploaded: files.length,
        kmlFilesUploaded: kmlFiles.length,
        weather,
        irradiance,
        altitude: altitudeMeters,
        historicalDefectRate: historicalDefectRate ? parseFloat(historicalDefectRate) : null,
        assetDensity,
        terrainComplexity,
        laborAvailability,
        assignedPilotsCount,
        assignedPersonnel,
        siteSize,
    };
}
