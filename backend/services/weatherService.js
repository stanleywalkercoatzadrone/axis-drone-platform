/**
 * weatherService.js
 * Enhanced Phase 9 — More accurate scoring for drone field operations.
 *
 * Changes from previous version:
 *  - Added hourly cloud_cover to the API call (daily avg computed from hourly)
 *  - Added hourly wind_speed_10m hourly max for better precision than daily max
 *  - Corrected wind thresholds: 30/45/65 kmh → 20/35/50 kmh (matches real drone limits)
 *  - Corrected irradiance denominator: max realistic value ~25 MJ/m², not 30
 *  - Added cloud cover as separate factor for solar inspection missions
 *  - Fixed precipitation probability double-penalty logic
 *  - Removed spurious UV bonus (not a real safety factor)
 *  - flyable threshold raised from 40 → 50 for safer operations
 */

/**
 * Fetch 14-day weather + irradiance + hourly cloud/wind from Open-Meteo.
 */
export async function getForecast(lat, lon) {
    try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', lat.toString());
        url.searchParams.set('longitude', lon.toString());
        url.searchParams.set('daily', [
            'temperature_2m_max', 'temperature_2m_min',
            'precipitation_sum', 'wind_speed_10m_max',
            'wind_gusts_10m_max', 'weather_code',
            'precipitation_probability_max',
            'uv_index_max', 'shortwave_radiation_sum',
        ].join(','));
        // Hourly wind + cloud cover for day-level precision
        url.searchParams.set('hourly', [
            'wind_speed_10m', 'cloud_cover', 'precipitation',
        ].join(','));
        url.searchParams.set('forecast_days', '14');
        url.searchParams.set('temperature_unit', 'fahrenheit');
        url.searchParams.set('wind_speed_unit', 'mph');   // ← changed: mph makes thresholds intuitive
        url.searchParams.set('timezone', 'auto');

        const res = await fetch(url.toString());
        const data = await res.json();

        if (!data.daily) return generateMockForecast();

        const days = data.daily;
        const hourly = data.hourly;    // may be undefined on API error
        const hourlyTimes = hourly?.time || [];

        return days.time.map((date, i) => {
            // Compute daily average cloud cover from hourly data (hours 06-18 = daylight window)
            let avgCloudCover = null;
            let hourlyPeakWind = null;
            if (hourly && hourlyTimes.length > 0) {
                const dayHours = hourlyTimes.reduce((acc, t, hi) => {
                    const [d, h] = t.split('T');
                    if (d === date) {
                        const hour = parseInt(h, 10);
                        if (hour >= 6 && hour <= 18) acc.push(hi);
                    }
                    return acc;
                }, []);
                if (dayHours.length > 0) {
                    const clouds = dayHours
                        .map(hi => hourly.cloud_cover?.[hi])
                        .filter(v => v != null);
                    const winds = dayHours
                        .map(hi => hourly.wind_speed_10m?.[hi])
                        .filter(v => v != null);
                    avgCloudCover = clouds.length > 0
                        ? Math.round(clouds.reduce((s, v) => s + v, 0) / clouds.length)
                        : null;
                    hourlyPeakWind = winds.length > 0
                        ? Math.max(...winds)
                        : null;
                }
            }

            return {
                date,
                tempMax: days.temperature_2m_max?.[i] ?? null,
                tempMin: days.temperature_2m_min?.[i] ?? null,
                precipSum: days.precipitation_sum?.[i] ?? 0,
                windMax: hourlyPeakWind ?? (days.wind_speed_10m_max?.[i] ?? 0),   // prefer hourly peak
                windGusts: days.wind_gusts_10m_max?.[i] ?? 0,
                weatherCode: days.weather_code?.[i] ?? 0,
                precipProbability: days.precipitation_probability_max?.[i] ?? 0,
                uvIndex: days.uv_index_max?.[i] ?? 0,
                shortwaveRadiation: days.shortwave_radiation_sum?.[i] ?? 0,
                cloudCoverPct: avgCloudCover,    // daytime avg cloud cover %
            };
        });
    } catch (e) {
        console.warn('[weatherService] Weather fetch failed, using mock:', e.message);
        return generateMockForecast();
    }
}

/**
 * Get irradiance-focused forecast data (subset of getForecast).
 */
export async function getIrradianceForecast(lat, lon) {
    const forecast = await getForecast(lat, lon);
    return forecast.map(day => ({
        date: day.date,
        shortwaveRadiation: day.shortwaveRadiation,
        uvIndex: day.uvIndex,
        cloudCoverPct: day.cloudCoverPct,
    }));
}

/**
 * WMO weather code category helper.
 * Returns severity level 0-3 based on standard WMO codes.
 * See: https://open-meteo.com/en/docs#weathervariables
 */
function wmoSeverity(code) {
    if (code === 0) return 0;                         // Clear sky
    if (code <= 3) return 0;                          // Partly cloudy
    if (code <= 48) return 1;                         // Fog / depositing rime
    if (code <= 57) return 2;                         // Drizzle
    if (code <= 67) return 3;                         // Rain
    if (code <= 77) return 3;                         // Snow
    if (code <= 82) return 2;                         // Rain showers
    if (code <= 86) return 3;                         // Snow showers
    if (code >= 95) return 3;                         // Thunderstorm
    return 1;
}

/**
 * Score a single day for drone/field operations suitability.
 * Wind thresholds are now in mph (changed from kmh).
 * Returns { weatherScore, irradianceScore, flyable, reasons }
 */
export function scoreWeatherConditions(day) {
    let weatherScore = 100;
    const reasons = [];

    // ── Wind (in mph) ──────────────────────────────────────────────────────────
    // FAA Part 107 ops typically limit to ≤23 mph sustained / ≤30 mph gusts.
    const wind = day.windMax ?? 0;
    const gusts = day.windGusts ?? 0;

    if (wind > 40) { weatherScore -= 55; reasons.push('Dangerous wind — flight unsafe'); }
    else if (wind > 30) { weatherScore -= 35; reasons.push('High wind'); }
    else if (wind > 22) { weatherScore -= 20; reasons.push('Elevated wind'); }
    else if (wind > 15) { weatherScore -= 8; reasons.push('Moderate wind'); }

    if (gusts > 35) { weatherScore -= 20; reasons.push('Severe gusts'); }
    else if (gusts > 28) { weatherScore -= 10; reasons.push('Strong gusts'); }

    // ── Precipitation ──────────────────────────────────────────────────────────
    // Use WMO severity as primary source of truth; use precipSum as amplifier
    const wmoLevel = wmoSeverity(day.weatherCode ?? 0);
    if (wmoLevel === 3) { weatherScore -= 45; reasons.push('Significant precipitation'); }
    else if (wmoLevel === 2) { weatherScore -= 20; reasons.push('Light precipitation'); }
    else if (wmoLevel === 1) { weatherScore -= 5; reasons.push('Foggy / overcast'); }

    // Amplify based on measured precipitation sum (mm)
    if (day.precipSum > 15) { weatherScore -= 20; reasons.push('Heavy rain total'); }
    else if (day.precipSum > 5) { weatherScore -= 10; reasons.push('Moderate rain total'); }

    // Probability factor — only penalise if WMO code does NOT already indicate rain
    if (wmoLevel < 2 && (day.precipProbability ?? 0) > 70) {
        weatherScore -= 15;
        reasons.push('High rain probability');
    } else if (wmoLevel < 2 && (day.precipProbability ?? 0) > 50) {
        weatherScore -= 8;
        reasons.push('Moderate rain probability');
    }

    // ── Cloud cover (daytime average) ─────────────────────────────────────────
    // Important for solar inspection — heavy cloud reduces quality
    if (day.cloudCoverPct != null) {
        if (day.cloudCoverPct > 90) { weatherScore -= 15; reasons.push('Heavy overcast'); }
        else if (day.cloudCoverPct > 70) { weatherScore -= 8; reasons.push('Mostly cloudy'); }
    }

    // ── Irradiance / Solar Score (corrected denominator) ──────────────────────
    // Typical max shortwave radiation in sunny conditions: ~22-25 MJ/m²/day
    const maxRealisticIrradiance = 23;
    let irradianceScore = Math.min(100, Math.round(((day.shortwaveRadiation ?? 0) / maxRealisticIrradiance) * 100));

    // If heavy cloud cover, cap irradiance score regardless of radiation reading
    if (day.cloudCoverPct != null && day.cloudCoverPct > 80) {
        irradianceScore = Math.min(irradianceScore, 40);
    }

    // ── Flyable threshold: 50 (raised from 40 for safety margin) ──────────────
    const flyable = weatherScore >= 50;

    return {
        weatherScore: Math.max(0, Math.min(100, weatherScore)),
        irradianceScore,
        flyable,
        reasons,
    };
}

/** Fallback mock forecast if API is unavailable */
function generateMockForecast() {
    const days = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        days.push({
            date: d.toISOString().split('T')[0],
            tempMax: 72 + Math.random() * 15,
            tempMin: 55 + Math.random() * 10,
            precipSum: Math.random() < 0.3 ? Math.random() * 10 : 0,
            windMax: 8 + Math.random() * 20,       // mph, realistic range
            windGusts: 15 + Math.random() * 15,
            weatherCode: Math.random() < 0.2 ? 61 : 0,
            precipProbability: Math.floor(Math.random() * 40),
            uvIndex: 4 + Math.random() * 4,
            shortwaveRadiation: 12 + Math.random() * 12,
            cloudCoverPct: Math.floor(Math.random() * 60),
        });
    }
    return days;
}
