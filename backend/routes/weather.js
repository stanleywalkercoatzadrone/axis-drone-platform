import express from 'express';
import { protect } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch'; // if necessary, though global fetch is available in modern node

const router = express.Router();

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

    const privateKey = APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');

    try {
        return jwt.sign(payload, privateKey, { header });
    } catch (err) {
        console.error('[WeatherProxy] Failed to sign Apple Weather JWT:', err.message);
        return null;
    }
}

/**
 * Map Apple WeatherKit conditionCode to WMO weather code (used by our system)
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
 * Map Apple WeatherKit data to the Open-Meteo schema expected by WeatherDashboard.tsx
 */
function formatAppleToOpenMeteo(appleData) {
    const { currentWeather: c, forecastHourly, forecastDaily } = appleData;
    
    const toF = (celsius) => (celsius * 9/5) + 32;

    // Map hourly data
    const hourlyLength = forecastHourly?.hours?.length || 0;
    const hourly = {
        time: [],
        temperature_2m: [],
        precipitation: [],
        wind_speed_10m: [],
        cloud_cover: [],
        uv_index: [],
        precipitation_probability: [],
        shortwave_radiation: []
    };
    
    if (forecastHourly?.hours) {
        for (const h of forecastHourly.hours) {
            hourly.time.push(h.forecastStart.slice(0, 16)); // "2024-05-12T03:00"
            hourly.temperature_2m.push(toF(h.temperature));
            hourly.precipitation.push(h.precipitationAmount);
            hourly.wind_speed_10m.push(h.windSpeed * 3.6); // kmh
            hourly.cloud_cover.push(h.cloudCover * 100);
            hourly.uv_index.push(h.uvIndex);
            hourly.precipitation_probability.push(h.precipitationChance * 100);
            // approximate solar radiation if not provided
            hourly.shortwave_radiation.push(h.solarClearSky ?? (h.isDaylight ? 500 : 0));
        }
    }
    
    // Map daily data
    const daily = {
        time: [],
        temperature_2m_max: [],
        temperature_2m_min: [],
        precipitation_sum: [],
        wind_speed_10m_max: [],
        uv_index_max: [],
        sunrise: [],
        sunset: [],
        weather_code: [],
        precipitation_probability_max: []
    };

    if (forecastDaily?.days) {
        for (const d of forecastDaily.days) {
            daily.time.push(d.forecastStart.slice(0, 10)); // "2024-05-12"
            daily.temperature_2m_max.push(toF(d.temperatureMax));
            daily.temperature_2m_min.push(toF(d.temperatureMin));
            daily.precipitation_sum.push(d.precipitationAmount);
            daily.wind_speed_10m_max.push(d.windSpeedMax * 3.6);
            daily.uv_index_max.push(d.maxUvIndex);
            daily.sunrise.push(d.sunrise);
            daily.sunset.push(d.sunset);
            daily.weather_code.push(mapAppleConditionToWmo(d.conditionCode));
            daily.precipitation_probability_max.push(d.precipitationChance * 100);
        }
    }

    return {
        current: {
            temperature_2m: toF(c.temperature),
            apparent_temperature: toF(c.temperatureApparent),
            relative_humidity_2m: c.humidity * 100,
            wind_speed_10m: c.windSpeed * 3.6,
            wind_direction_10m: c.windDirection,
            wind_gusts_10m: (c.windGust || c.windSpeed) * 3.6,
            precipitation: c.precipitationAmount,
            cloud_cover: c.cloudCover * 100,
            visibility: c.visibility,
            surface_pressure: c.pressure,
            uv_index: c.uvIndex,
            weather_code: mapAppleConditionToWmo(c.conditionCode),
            is_day: c.isDaylight ? 1 : 0,
            dew_point_2m: toF(c.temperature - ((100 - (c.humidity * 100)) / 5)) // approx dew point
        },
        hourly,
        daily,
        _provider: 'apple' // metadata tag for frontend
    };
}

router.use(protect);

router.get('/forecast', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

        // Try Apple WeatherKit
        const token = generateAppleWeatherToken();
        if (token) {
            const appleUrl = `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?dataSets=currentWeather,forecastHourly,forecastDaily`;
            const response = await globalThis.fetch(appleUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const appleData = await response.json();
                const openMeteoFormat = formatAppleToOpenMeteo(appleData);
                return res.json(openMeteoFormat);
            } else {
                console.warn('[WeatherProxy] Apple Weather failed, falling back to Open-Meteo', response.status, await response.text());
            }
        }

        // Fallback to Open-Meteo
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', lat.toString());
        url.searchParams.set('longitude', lon.toString());
        url.searchParams.set('current', [
            'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
            'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
            'precipitation', 'cloud_cover', 'visibility', 'surface_pressure',
            'uv_index', 'weather_code', 'is_day', 'dew_point_2m',
        ].join(','));
        url.searchParams.set('hourly', [
            'temperature_2m', 'precipitation', 'wind_speed_10m',
            'cloud_cover', 'uv_index', 'precipitation_probability',
            'shortwave_radiation',
        ].join(','));
        url.searchParams.set('daily', [
            'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
            'wind_speed_10m_max', 'uv_index_max', 'sunrise', 'sunset',
            'weather_code', 'precipitation_probability_max',
        ].join(','));
        url.searchParams.set('temperature_unit', 'fahrenheit');
        url.searchParams.set('wind_speed_unit', 'kmh');
        url.searchParams.set('forecast_days', req.query.forecast_days || '7');
        url.searchParams.set('timezone', 'auto');

        const openMeteoRes = await globalThis.fetch(url.toString());
        if (!openMeteoRes.ok) {
            return res.status(openMeteoRes.status).json({ error: 'Open-Meteo fetch failed' });
        }

        const data = await openMeteoRes.json();
        data._provider = 'open-meteo'; // Metadata tag
        res.json(data);
    } catch (err) {
        console.error('[WeatherProxy] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
