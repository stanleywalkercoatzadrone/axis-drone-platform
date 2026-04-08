/**
 * missionForecaster.js
 * Mission Forecasting & Performance Intelligence Engine — Phase 3
 * Refactored Phase 4+8: weatherService extracted, coordinates enforced from DB.
 */
import { query } from '../config/database.js';
import { analyzeMissionPerformance } from './performanceAnalyzer.js';
import { getForecast, scoreWeatherConditions } from './weatherService.js';
import { AppError } from '../middleware/errorHandler.js';
import { GoogleGenAI } from '@google/genai';

// Lazy-initialized — only constructed when API key is available (prevents startup crash)
let _ai = null;
function getAI() {
    if (_ai) return _ai;
    const apiKey = process.env.GOOGLE_API_KEY || process.env.API_KEY || '';
    if (!apiKey) return null;
    _ai = new GoogleGenAI({ apiKey });
    return _ai;
}

/**
 * Find best consecutive windows in scored days.
 */
function findConsecutiveWindows(scoredDays, minLen = 2, maxLen = 7) {
    const windows = [];
    const n = scoredDays.length;

    for (let start = 0; start < n; start++) {
        if (!scoredDays[start].flyable) continue;

        let end = start;
        while (end < n - 1 && scoredDays[end + 1].flyable && (end - start + 1) < maxLen) {
            end++;
        }

        const len = end - start + 1;
        if (len < minLen) { start = end; continue; }

        const window = scoredDays.slice(start, end + 1);
        const avgWeather = Math.round(window.reduce((s, d) => s + d.weatherScore, 0) / window.length);
        const avgIrradiance = Math.round(window.reduce((s, d) => s + d.irradianceScore, 0) / window.length);

        windows.push({
            startDate: scoredDays[start].date,
            endDate: scoredDays[end].date,
            consecutiveDays: len,
            weatherScore: avgWeather,
            irradianceScore: avgIrradiance,
            days: window,
        });

        start = end;
    }

    return windows;
}

/**
 * AI recommendation generation.
 */
async function generateAIRecommendation(missionPerf, windows, scoredDays) {
    const ai = getAI();
    if (!ai) {
        return {
            riskWarnings: missionPerf.riskTrend === 'declining'
                ? ['Declining productivity trend detected — review crew and equipment status'] : [],
            recommendedAction: windows.length > 0
                ? `Schedule operations starting ${windows[0].startDate} for optimal conditions`
                : 'Monitor weather conditions — no strong windows found in next 14 days',
            forecastSummary: `Forecast generated for ${missionPerf.missionTitle || 'this mission'} based on ${missionPerf.activeDays} historical work days.`
        };
    }
    try {
        const prompt = `You are a mission operations forecasting AI. Given the following drone mission performance data and 14-day weather forecast windows, produce a brief advisory.

Mission Performance Summary:
- Average daily velocity: ${missionPerf.avgVelocity} units/day
- Risk trend: ${missionPerf.riskTrend}
- Top delay factors: ${JSON.stringify(missionPerf.delayPatterns?.slice(0, 3))}
- Weather impact factor: ${Math.round(missionPerf.weatherImpactFactor * 100)}%
- Data quality: ${missionPerf.dataQuality}

Best Forecast Windows (top 3):
${windows.slice(0, 3).map((w, i) => `${i + 1}. ${w.startDate} – ${w.endDate} (${w.consecutiveDays} days, weather score: ${w.weatherScore}/100, confidence: ${w.confidenceScore}%)`).join('\n')}

Return ONLY valid JSON:
{
  "riskWarnings": ["warning 1", "warning 2"],
  "recommendedAction": "one clear recommended action sentence",
  "forecastSummary": "2-3 sentence executive summary"
}`;

        const result = await getAI()?.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        let text = (result.text || '{}').trim()
            .replace(/^```json\n?/i, '').replace(/```$/m, '').trim();
        return JSON.parse(text);
    } catch {
        return {
            riskWarnings: missionPerf.riskTrend === 'declining'
                ? ['Declining productivity trend detected — review crew and equipment status']
                : [],
            recommendedAction: windows.length > 0
                ? `Schedule operations starting ${windows[0].startDate} for optimal conditions`
                : 'Monitor weather conditions — no strong windows found in next 14 days',
            forecastSummary: `Forecast generated for ${missionPerf.missionTitle || 'this mission'} based on ${missionPerf.activeDays} historical work days.`
        };
    }
}

/**
 * Geocode a city/location string to lat/lon via Open-Meteo Geocoding API.
 * Uses fetch — same as weatherService which is confirmed working in Cloud Run.
 */
async function geocodeCity(cityStr) {
    if (!cityStr) return null;
    // Extract the first word/token that looks like a city (before any comma)
    const searchTerm = cityStr.split(',')[0].trim();
    if (!searchTerm || searchTerm.length < 2) return null;
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`;
        console.log(`[missionForecaster] Geocoding: "${searchTerm}" from "${cityStr}"`);
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const r = data.results[0];
            const label = `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country_code ? ', ' + r.country_code : ''}`;
            console.log(`[missionForecaster] Geocoded "${searchTerm}" → ${label} (${r.latitude}, ${r.longitude})`);
            return { lat: r.latitude, lon: r.longitude, label };
        } else {
            console.warn(`[missionForecaster] No results for "${searchTerm}"`);
        }
    } catch (e) {
        console.warn(`[missionForecaster] Geocoding error for "${searchTerm}":`, e.message);
    }
    return null;
}

// Last-resort fallback coordinates (Dallas, TX)
const DEFAULT_LAT = 32.7767;
const DEFAULT_LON = -96.7970;
const DEFAULT_LABEL = 'Dallas, TX (default)';

export async function generateForecast(missionId, overrideCoords = null) {
    const missionRow = await query(
        `SELECT id, title, latitude, longitude, location, site_name, city, state FROM deployments WHERE id = $1`,
        [missionId]
    );
    if (missionRow.rows.length === 0) {
        throw new AppError('Mission not found', 404);
    }
    const { latitude, longitude, title, location, site_name, city, state } = missionRow.rows[0];

    // Priority: override from browser → stored in DB → geocoded → Dallas fallback
    let lat, lon, locationUsed, usingDefaultCoords = false;

    if (overrideCoords) {
        // Browser geocoded and passed directly — most reliable
        lat = overrideCoords.lat;
        lon = overrideCoords.lon;
        locationUsed = `${lat.toFixed(4)}, ${lon.toFixed(4)} (browser-resolved)`;
        console.log(`[missionForecaster] Using browser-provided coordinates: ${locationUsed}`);
        // Persist to DB for future forecasts
        try {
            await query(`UPDATE deployments SET latitude=$1, longitude=$2 WHERE id=$3`, [lat, lon, missionId]);
        } catch(e) { /* non-fatal */ }
    } else if (latitude && longitude) {
        lat = parseFloat(latitude);
        lon = parseFloat(longitude);
        locationUsed = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        console.log(`[missionForecaster] Using stored DB coordinates: ${locationUsed}`);
    } else {
        // Server-side geocoding as last resort
        const cityState = [city, state].filter(Boolean).join(', ');
        const toTry = [cityState, location, site_name, title].filter(Boolean);
        console.log(`[missionForecaster] No coords anywhere. Attempting server geocoding for:`, toTry);
        let geocoded = null;
        for (const candidate of toTry) {
            geocoded = await geocodeCity(candidate);
            if (geocoded) break;
        }
        if (geocoded) {
            lat = geocoded.lat;
            lon = geocoded.lon;
            locationUsed = geocoded.label + ' (server-geocoded)';
        } else {
            lat = DEFAULT_LAT;
            lon = DEFAULT_LON;
            locationUsed = DEFAULT_LABEL;
            usingDefaultCoords = true;
        }
    }

    // Step 1: Analyze historical performance
    const missionPerf = await analyzeMissionPerformance(missionId);

    // Step 2: Fetch weather via weatherService
    const weatherDays = await getForecast(lat, lon);

    // Step 3: Score each day via weatherService
    const scoredDays = weatherDays.map(day => {
        const scores = scoreWeatherConditions(day);
        return { ...day, ...scores };
    });

    // Step 4: Find consecutive windows
    const rawWindows = findConsecutiveWindows(scoredDays, 2, 6);

    // Step 5: Calculate predicted completion rate and confidence for each window
    const baseCompletionRate = missionPerf.avgCompletionRate > 0
        ? missionPerf.avgCompletionRate
        : 70;
    const weatherImpact = missionPerf.weatherImpactFactor;

    const scoredWindows = rawWindows.map(w => {
        const weatherBonus = (w.weatherScore - 70) / 100; // +/- from baseline
        const predictedRate = Math.min(100, Math.max(0, Math.round(
            baseCompletionRate + (weatherBonus * 20)
        )));

        // Confidence: higher for more data quality, longer consecutive runs, better weather
        const dataConfidence = missionPerf.dataQuality === 'high' ? 20
            : missionPerf.dataQuality === 'medium' ? 10 : 0;
        const lengthBonus = Math.min(15, w.consecutiveDays * 3);
        const weatherConfidence = Math.round(w.weatherScore / 5);
        const confidenceScore = Math.min(95, 40 + dataConfidence + lengthBonus + weatherConfidence);

        return {
            ...w,
            predictedCompletionRate: predictedRate,
            confidenceScore,
            recommended: w.consecutiveDays >= 3 && w.weatherScore >= 70,
        };
    });

    // Sort by confidence descending
    scoredWindows.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Step 6: AI-generated recommendations
    const aiRec = await generateAIRecommendation(missionPerf, scoredWindows, scoredDays);

    // Step 7: Store windows in mission_forecast_windows (new table only)
    try {
        // Delete old forecast for this mission first
        await query(`DELETE FROM mission_forecast_windows WHERE mission_id = $1`, [missionId]);

        for (const w of scoredWindows.slice(0, 10)) {
            await query(`
                INSERT INTO mission_forecast_windows (
                    mission_id, forecast_start_date, forecast_end_date,
                    consecutive_days, weather_score, irradiance_score,
                    predicted_completion_rate, confidence_score, recommended
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                missionId, w.startDate, w.endDate,
                w.consecutiveDays, w.weatherScore, w.irradianceScore,
                w.predictedCompletionRate, w.confidenceScore, w.recommended
            ]);
        }
    } catch (e) {
        console.warn('[missionForecaster] Storage error (non-fatal):', e.message);
    }

    return {
        missionId,
        generatedAt: new Date().toISOString(),
        usingDefaultCoords,
        locationUsed: usingDefaultCoords ? 'Dallas, TX (default)' : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        performance: missionPerf,
        scoredDays: scoredDays.map(d => ({
            date: d.date,
            weatherScore: d.weatherScore,
            irradianceScore: d.irradianceScore,
            flyable: d.flyable,
            windMax: d.windMax,
            precipSum: d.precipSum,
            tempMax: d.tempMax,
            reasons: d.reasons,
        })),
        recommendedWindows: scoredWindows.slice(0, 5).map(w => ({
            startDate: w.startDate,
            endDate: w.endDate,
            consecutiveDays: w.consecutiveDays,
            weatherScore: w.weatherScore,
            irradianceScore: w.irradianceScore,
            predictedCompletionRate: w.predictedCompletionRate,
            confidenceScore: w.confidenceScore,
            recommended: w.recommended,
        })),
        riskWarnings: aiRec.riskWarnings || [],
        recommendedAction: aiRec.recommendedAction || '',
        forecastSummary: aiRec.forecastSummary || '',
    };
}

/**
 * Background: re-analyze and store mission daily performance record from a daily log.
 * Called non-blocking after log upload. Never throws.
 */
export async function updateMissionPerformanceRecord(missionId, logData) {
    try {
        const { logDate, panelsCompleted, notes, weatherCode, irradianceLevel } = logData;

        // Extract factors from notes using AI (background, non-blocking)
        let notesFactors = {};
        if (notes && notes.trim().length > 5) {
            const { extractNoteFactors } = await import('./performanceAnalyzer.js');
            notesFactors = await extractNoteFactors(notes).catch(() => ({}));
        }

        const completionRate = panelsCompleted && panelsCompleted > 0
            ? Math.min(100, Math.round((panelsCompleted / 50) * 100)) // baseline of 50/day
            : 0;

        await query(`
            INSERT INTO mission_daily_performance (
                mission_id, date, actual_output, completion_rate,
                weather_conditions, irradiance_level, notes_extracted_factors
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (mission_id, date) DO UPDATE SET
                actual_output = EXCLUDED.actual_output,
                completion_rate = EXCLUDED.completion_rate,
                weather_conditions = EXCLUDED.weather_conditions,
                irradiance_level = EXCLUDED.irradiance_level,
                notes_extracted_factors = EXCLUDED.notes_extracted_factors
        `, [
            missionId,
            logDate || new Date().toISOString().split('T')[0],
            panelsCompleted || 0,
            completionRate,
            JSON.stringify({ code: weatherCode }),
            irradianceLevel || null,
            JSON.stringify(notesFactors),
        ]);
    } catch (e) {
        console.warn('[missionForecaster] Background perf update failed (non-fatal):', e.message);
    }
}
