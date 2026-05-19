/**
 * dailyReportAI.js
 * Generates an AI-written operational field report when a pilot submits their daily report.
 *
 * Uses Gemini 1.5 Pro (inline prompt — no DB template required).
 * Fetches live weather + solar irradiance from Open-Meteo before generating.
 * Falls back to geocoding from location string if lat/lon are missing.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let genAI;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// WMO weather code → human label (complete WMO 4677 table)
function weatherLabel(code) {
    if (code === undefined || code === null) return 'Unknown';
    if (code === 0)  return 'Clear Sky';
    if (code === 1)  return 'Mainly Clear';
    if (code === 2)  return 'Partly Cloudy';
    if (code === 3)  return 'Overcast';
    if (code === 45 || code === 48) return 'Fog';
    if (code === 51) return 'Light Drizzle';
    if (code === 53) return 'Moderate Drizzle';
    if (code === 55) return 'Dense Drizzle';
    if (code === 61) return 'Light Rain';
    if (code === 63) return 'Moderate Rain';
    if (code === 65) return 'Heavy Rain';
    if (code === 71) return 'Light Snow';
    if (code === 73) return 'Moderate Snow';
    if (code === 75) return 'Heavy Snow';
    if (code === 77) return 'Snow Grains';
    if (code === 80) return 'Light Rain Showers';
    if (code === 81) return 'Moderate Rain Showers';
    if (code === 82) return 'Violent Rain Showers';
    if (code === 85) return 'Light Snow Showers';
    if (code === 86) return 'Heavy Snow Showers';
    if (code === 95) return 'Thunderstorm';
    if (code === 96 || code === 99) return 'Thunderstorm with Hail';
    // Legacy range fallbacks
    if (code <= 9)  return 'Fog / Mist';
    if (code <= 29) return 'Drizzle / Light Rain';
    if (code <= 39) return 'Snow / Sleet';
    if (code <= 69) return 'Rain';
    if (code <= 79) return 'Snow Showers';
    if (code <= 84) return 'Rain Showers';
    if (code <= 94) return 'Thunderstorm';
    return 'Severe Storm';
}

/**
 * Geocode a location name string → { latitude, longitude } using Open-Meteo geocoding.
 * Returns null if geocoding fails or returns no results.
 */
async function geocodeLocation(locationStr) {
    if (!locationStr) return null;
    // Use the full location string for better small-town accuracy,
    // but cap at 100 chars to avoid API issues
    const searchTerm = locationStr.trim().slice(0, 100);
    if (!searchTerm || searchTerm.length < 2) return null;
    try {
        // Try full string first (e.g. "Walker Springs, Alabama")
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return null;
        const data = await resp.json();
        let result = data.results?.[0];

        // If no result with full string, fall back to city name only
        if (!result) {
            const cityOnly = locationStr.split(',')[0].trim();
            if (cityOnly !== searchTerm && cityOnly.length >= 2) {
                const url2 = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityOnly)}&count=1&language=en&format=json`;
                const resp2 = await fetch(url2, { signal: AbortSignal.timeout(5000) });
                if (resp2.ok) {
                    const data2 = await resp2.json();
                    result = data2.results?.[0];
                }
            }
        }

        if (!result?.latitude || !result?.longitude) return null;
        console.log(`[dailyReportAI] Geocoded "${locationStr}" → ${result.latitude}, ${result.longitude} (${result.name}, ${result.admin1 || ''}, ${result.country_code})`);
        return { latitude: result.latitude, longitude: result.longitude };
    } catch (e) {
        console.warn('[dailyReportAI] geocoding failed:', e.message);
        return null;
    }
}

/**
 * Fetch and summarize the full working day's weather + solar irradiance for a lat/lon.
 * Falls back to geocoding from locationStr if lat/lon are null.
 * Returns { weather: DayWeatherSummary, irradiance: DayIrradianceSummary } — null-safe.
 *
 * DayWeatherSummary: { tempMin, tempMax, avgWindSpeed, totalPrecipitation, conditions,
 *                      dominantCode, hourlyConditions, site_timezone, date }
 * DayIrradianceSummary: { peakGhi, avgGhi, totalWh, description, hourlyGhi }
 */
export async function fetchWeatherAndIrradiance(latitude, longitude, locationStr = null) {
    // Resolve coordinates — prefer explicit lat/lon, fall back to geocoding
    let lat = latitude ? parseFloat(latitude) : null;
    let lon = longitude ? parseFloat(longitude) : null;

    if ((!lat || !lon) && locationStr) {
        const geocoded = await geocodeLocation(locationStr);
        if (geocoded) { lat = geocoded.latitude; lon = geocoded.longitude; }
    }

    if (!lat || !lon) {
        console.warn('[dailyReportAI] No coordinates available for weather fetch');
        return { weather: null, irradiance: null };
    }

    try {
        // Fetch full hourly data for today — includes temperature, wind, precipitation,
        // weather code, and solar irradiance. timezone=auto ensures hours are in site local time.
        const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${lat}&longitude=${lon}` +
            `&hourly=temperature_2m,wind_speed_10m,precipitation,weather_code,` +
            `shortwave_radiation,direct_radiation,diffuse_radiation` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto` +
            `&forecast_days=1`;

        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}`);
        const data = await resp.json();

        const siteTimezone = data.timezone || 'UTC';
        const todayDate   = data.daily?.time?.[0] || new Date().toISOString().split('T')[0];

        // ── Daily summary (from Open-Meteo daily aggregates) ──────────────────
        const daily = data.daily || {};
        const tempMin  = daily.temperature_2m_min?.[0] !== undefined ? Math.round(daily.temperature_2m_min[0]) : null;
        const tempMax  = daily.temperature_2m_max?.[0] !== undefined ? Math.round(daily.temperature_2m_max[0]) : null;
        const totalPrecip = daily.precipitation_sum?.[0] !== undefined ? +(daily.precipitation_sum[0].toFixed(2)) : 0;
        const maxWind  = daily.wind_speed_10m_max?.[0] !== undefined ? Math.round(daily.wind_speed_10m_max[0]) : null;
        const dailyCode = daily.weather_code?.[0] ?? null;

        // ── Hourly data — filter to working hours (6am–7pm site local time) ──
        const hours    = data.hourly?.time || [];
        const workStart = 6, workEnd = 19; // 6am–7pm
        const workIndices = hours.reduce((acc, t, i) => {
            const h = new Date(t).getHours();
            if (h >= workStart && h <= workEnd) acc.push(i);
            return acc;
        }, []);

        const tempHourly   = data.hourly?.temperature_2m || [];
        const windHourly   = data.hourly?.wind_speed_10m || [];
        const codeHourly   = data.hourly?.weather_code || [];
        const ghiHourly    = data.hourly?.shortwave_radiation || [];
        const dniHourly    = data.hourly?.direct_radiation || [];
        const dhiHourly    = data.hourly?.diffuse_radiation || [];

        // Compute working-hour averages for wind
        const workWindValues = workIndices.map(i => windHourly[i]).filter(v => v !== undefined && v !== null);
        const avgWind = workWindValues.length > 0
            ? Math.round(workWindValues.reduce((a, b) => a + b, 0) / workWindValues.length)
            : maxWind;

        // Determine dominant weather condition during working hours
        const condCounts = {};
        workIndices.forEach(i => {
            const code = codeHourly[i];
            if (code !== undefined && code !== null) condCounts[code] = (condCounts[code] || 0) + 1;
        });
        const dominantCode = Object.entries(condCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? dailyCode;

        // Build a concise hourly conditions string (every 3 hours)
        const keyHours = workIndices.filter((_, idx) => idx % 3 === 0);
        const hourlyConditions = keyHours.map(i => {
            const t = hours[i] ? new Date(hours[i]).getHours() : null;
            const label = codeHourly[i] !== undefined ? weatherLabel(codeHourly[i]) : 'Unknown';
            const temp  = tempHourly[i] !== undefined ? Math.round(tempHourly[i]) : null;
            return t !== null ? `${t}:00 — ${label}${temp !== null ? ` (${temp}°F)` : ''}` : null;
        }).filter(Boolean).join(', ');

        // ── Irradiance summary ────────────────────────────────────────────────
        const workGhi = workIndices.map(i => ghiHourly[i]).filter(v => v !== undefined && v !== null);
        const peakGhi = workGhi.length > 0 ? Math.round(Math.max(...workGhi)) : null;
        const avgGhi  = workGhi.length > 0 ? Math.round(workGhi.reduce((a, b) => a + b, 0) / workGhi.length) : null;
        // Approximate total solar energy in Wh/m² (hourly samples ≈ 1h each)
        const totalWh = workGhi.length > 0 ? Math.round(workGhi.reduce((a, b) => a + b, 0)) : null;

        const dniPeak = workIndices.length > 0
            ? Math.round(Math.max(...workIndices.map(i => dniHourly[i] ?? 0)))
            : null;
        const dhiAvg  = workIndices.length > 0
            ? Math.round(workIndices.map(i => dhiHourly[i] ?? 0).reduce((a, b) => a + b, 0) / workIndices.length)
            : null;

        const irradianceDesc = peakGhi !== null
            ? peakGhi > 700 ? 'Excellent solar resource'
                : peakGhi > 400 ? 'Good solar resource'
                : peakGhi > 150 ? 'Moderate solar resource'
                : 'Low solar resource'
            : 'Irradiance data unavailable';

        return {
            weather: {
                tempMin,
                tempMax,
                avgWindSpeed: avgWind,
                maxWindSpeed: maxWind,
                totalPrecipitation: totalPrecip,
                dominantCode: Number(dominantCode),
                conditions: weatherLabel(Number(dominantCode)),
                hourlyConditions,
                site_timezone: siteTimezone,
                date: todayDate,
            },
            irradiance: {
                peakGhi_wm2: peakGhi,
                avgGhi_wm2: avgGhi,
                totalEnergy_wh: totalWh,
                peakDni_wm2: dniPeak,
                avgDhi_wm2: dhiAvg,
                description: irradianceDesc,
            },
        };
    } catch (e) {
        console.warn('[dailyReportAI] weather/irradiance fetch failed:', e.message);
        return { weather: null, irradiance: null };
    }
}

/**
 * Generate the AI operational field report using Gemini.
 */
export async function generateDailyReportText(opts) {
    if (!genAI) {
        return buildFallbackReport(opts);
    }

    const {
        missionTitle, siteName, location, reportDate, pilotName,
        missionsFlownCount, blocksCompleted, hoursWorked,
        weatherConditions, issuesEncountered, notes,
        weather, irradiance,
    } = opts;

    const weatherSection = weather
        ? `Full-day weather at site (${weather.date}, ${weather.site_timezone}): ` +
          `Temperature range ${weather.tempMin ?? 'N/A'}°F–${weather.tempMax ?? 'N/A'}°F, ` +
          `average wind ${weather.avgWindSpeed ?? 'N/A'} mph (peak ${weather.maxWindSpeed ?? 'N/A'} mph), ` +
          `total precipitation ${weather.totalPrecipitation ?? 0} mm, ` +
          `dominant conditions: ${weather.conditions}.` +
          (weather.hourlyConditions ? ` Hourly progression: ${weather.hourlyConditions}.` : '')
        : weatherConditions
        ? `Pilot-reported weather conditions: ${weatherConditions}.`
        : 'Weather data unavailable.';

    const irradianceSection = irradiance?.peakGhi_wm2 !== null && irradiance?.peakGhi_wm2 !== undefined
        ? `Solar irradiance for the working day — Peak GHI: ${irradiance.peakGhi_wm2} W/m², ` +
          `Average GHI: ${irradiance.avgGhi_wm2 ?? 'N/A'} W/m², ` +
          `Peak DNI: ${irradiance.peakDni_wm2 ?? 'N/A'} W/m², ` +
          `Estimated total solar energy: ${irradiance.totalEnergy_wh ?? 'N/A'} Wh/m². ` +
          `Assessment: ${irradiance.description}.`
        : 'Solar irradiance data unavailable for this location.';

    const prompt = `You are an operational field reporter for Axis Drone Inspection Services. 
Write a professional 3-paragraph operational field report for the following pilot end-of-day submission. 
Be factual, concise, and professional. Do NOT invent data. Reference the exact numbers provided.
Use plain text (no markdown, no bullet points, no headers). Write in third person.

MISSION: ${missionTitle || siteName || 'Unnamed Mission'}
SITE: ${siteName || location || 'Unknown Site'}
DATE: ${reportDate}
PILOT: ${pilotName || 'Field Technician'}

PILOT REPORT:
- Missions/flights flown today: ${missionsFlownCount ?? 0}
- Blocks completed: ${blocksCompleted ?? 0}
- Hours worked: ${hoursWorked ?? 0}
- Issues encountered: ${issuesEncountered || 'None reported'}
- Field notes: ${notes || 'No additional notes'}

ENVIRONMENTAL CONDITIONS:
${weatherSection}
${irradianceSection}

Write exactly 3 paragraphs:
Paragraph 1: Operational summary — what was accomplished today, referencing flights flown, blocks completed, and hours worked.
Paragraph 2: Environmental conditions — summarize how weather evolved throughout the working day, including the temperature range, wind, precipitation, and solar conditions and their impact on operations.
Paragraph 3: Issues, outlook, and recommendations for the next operational day.`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) {
        console.warn('[dailyReportAI] Gemini generation failed:', e.message);
        return buildFallbackReport(opts);
    }
}

/**
 * Fallback report when Gemini is unavailable — structured template.
 */
function buildFallbackReport(opts) {
    const {
        missionTitle, siteName, reportDate, pilotName,
        missionsFlownCount, blocksCompleted, hoursWorked,
        weatherConditions, issuesEncountered, notes,
        weather, irradiance,
    } = opts;

    const weatherStr = weather
        ? `Temperatures ${weather.tempMin ?? 'N/A'}°F–${weather.tempMax ?? 'N/A'}°F, avg wind ${weather.avgWindSpeed ?? 'N/A'} mph, ` +
          `${weather.totalPrecipitation ?? 0}mm precipitation, ${weather.conditions}` +
          (weather.hourlyConditions ? ` (${weather.hourlyConditions})` : '')
        : weatherConditions || 'Not recorded';

    const irradianceStr = irradiance?.peakGhi_wm2 != null
        ? `Peak GHI ${irradiance.peakGhi_wm2} W/m², Avg GHI ${irradiance.avgGhi_wm2 ?? 'N/A'} W/m², ~${irradiance.totalEnergy_wh ?? 'N/A'} Wh/m² total — ${irradiance.description}`
        : 'Irradiance data unavailable';

    return [
        `Field operations for ${missionTitle || siteName || 'this mission'} on ${reportDate} were conducted by ${pilotName || 'the assigned technician'}. ` +
        `A total of ${missionsFlownCount ?? 0} flight(s) were executed, completing ${blocksCompleted ?? 0} block(s) over ${hoursWorked ?? 0} hours of active field work.`,

        `Environmental conditions at the site recorded: ${weatherStr}. ` +
        `Solar irradiance readings: ${irradianceStr}.`,

        `Issues encountered: ${issuesEncountered || 'None'}. ` +
        `Additional field notes: ${notes || 'None'}. ` +
        `Operations are on schedule and the site is prepared for the next operational day.`,
    ].join('\n\n');
}

/**
 * Classify whether the report constitutes an incident.
 * Returns { is_incident: boolean, severity: 'none'|'low'|'medium'|'high'|'critical', summary: string }
 */
export async function classifyIncident({ issuesEncountered, notes, pilotName, missionTitle, reportDate }) {
    const issueText = `${issuesEncountered || ''} ${notes || ''}`.trim();

    // Quick pass: nothing to classify
    const noneKeywords = ['none', 'n/a', 'no issues', 'nothing', 'all good', 'no problems', 'no incident'];
    if (!issueText || noneKeywords.some(k => issueText.toLowerCase().includes(k))) {
        return { is_incident: false, severity: 'none', summary: null };
    }

    // Try Gemini classification
    if (genAI) {
        try {
            const prompt = `You are a drone operations safety officer. Classify whether the following pilot field report contains an incident.
Return ONLY valid JSON with these fields:
{
  "is_incident": boolean,
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "summary": "One-sentence summary of the incident or null if none"
}

Severity guide:
- none: no real issue, routine notes
- low: minor inconvenience, no safety risk, resolved on-site
- medium: equipment issue, access problem, weather delay, or minor injury
- high: drone crash, regulatory issue, significant injury, data loss, property damage
- critical: serious injury, emergency evacuation, structural damage, or multiple combined failures

PILOT: ${pilotName || 'Unknown'}
MISSION: ${missionTitle || 'Unknown'}
DATE: ${reportDate || 'Unknown'}
ISSUES ENCOUNTERED: ${issuesEncountered || 'Not reported'}
FIELD NOTES: ${notes || 'None'}`;

            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // fast model for classification
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    is_incident: Boolean(parsed.is_incident),
                    severity: parsed.severity || 'none',
                    summary: parsed.summary || null,
                };
            }
        } catch (e) {
            console.warn('[dailyReportAI] incident classification failed:', e.message);
        }
    }

    // Keyword heuristic fallback
    const highKeywords = ['crash', 'injury', 'injured', 'emergency', 'lost drone', 'damage', 'regulatory', 'police', 'hospital', 'fire'];
    const medKeywords = ['equipment failure', 'malfunction', 'lost signal', 'flyaway', 'access denied', 'delay', 'collision', 'data loss'];
    if (highKeywords.some(k => issueText.toLowerCase().includes(k))) {
        return { is_incident: true, severity: 'high', summary: `Potential high-severity incident: ${issueText.slice(0, 80)}` };
    }
    if (medKeywords.some(k => issueText.toLowerCase().includes(k))) {
        return { is_incident: true, severity: 'medium', summary: `Reported issue: ${issueText.slice(0, 80)}` };
    }
    return { is_incident: true, severity: 'low', summary: `Minor issue reported: ${issueText.slice(0, 80)}` };
}
