/**
 * WeatherDashboard — Industry-contextual weather intelligence
 * Uses Open-Meteo (free, no API key) + browser geolocation
 * Shows location-specific weather with industry-relevant metrics
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    MapPin, Wind, Droplets, Thermometer, Eye, Sun,
    CloudRain, CloudSnow, CloudLightning, Cloud, Zap,
    Shield, HardHat, Radio, AlertTriangle, RefreshCw,
    Navigation, Gauge, ArrowUp, ArrowDown, Sunrise, Sunset,
    BarChart3, Activity, TrendingUp, TrendingDown, Info
} from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface GeoLocation {
    lat: number;
    lon: number;
    city: string;
    region: string;
    country: string;
}

interface WeatherCurrent {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    windGusts: number;
    precipitation: number;
    cloudCover: number;
    visibility: number; // km
    pressure: number;   // hPa
    uvIndex: number;
    weatherCode: number;
    isDay: boolean;
    dewPoint: number;
}

interface WeatherHourly {
    time: string[];
    temperature: number[];
    precipitation: number[];
    windSpeed: number[];
    cloudCover: number[];
    uvIndex: number[];
    precipitationProbability: number[];
    lightningPotential: number[];
    irradiance: number[]; // W/m² shortwave radiation
}

interface WeatherDaily {
    time: string[];
    tempMax: number[];
    tempMin: number[];
    precipitationSum: number[];
    windSpeedMax: number[];
    uvIndexMax: number[];
    sunrise: string[];
    sunset: string[];
    weatherCode: number[];
    precipitationProbability: number[];
}

interface WeatherData {
    current: WeatherCurrent;
    hourly: WeatherHourly;
    daily: WeatherDaily;
    fetchedAt: Date;
}

// ── WMO Weather Code to description ─────────────────────────────────────────

const WMO_CODES: Record<number, { label: string; icon: string; severe: boolean }> = {
    0: { label: 'Clear Sky', icon: '☀️', severe: false },
    1: { label: 'Mainly Clear', icon: '🌤️', severe: false },
    2: { label: 'Partly Cloudy', icon: '⛅', severe: false },
    3: { label: 'Overcast', icon: '☁️', severe: false },
    45: { label: 'Foggy', icon: '🌫️', severe: false },
    48: { label: 'Icing Fog', icon: '🌫️', severe: true },
    51: { label: 'Light Drizzle', icon: '🌦️', severe: false },
    53: { label: 'Moderate Drizzle', icon: '🌧️', severe: false },
    55: { label: 'Heavy Drizzle', icon: '🌧️', severe: false },
    61: { label: 'Light Rain', icon: '🌧️', severe: false },
    63: { label: 'Moderate Rain', icon: '🌧️', severe: true },
    65: { label: 'Heavy Rain', icon: '🌧️', severe: true },
    71: { label: 'Light Snow', icon: '🌨️', severe: false },
    73: { label: 'Moderate Snow', icon: '❄️', severe: true },
    75: { label: 'Heavy Snow', icon: '❄️', severe: true },
    77: { label: 'Snow Grains', icon: '🌨️', severe: false },
    80: { label: 'Light Showers', icon: '🌦️', severe: false },
    81: { label: 'Moderate Showers', icon: '🌧️', severe: false },
    82: { label: 'Violent Showers', icon: '⛈️', severe: true },
    85: { label: 'Snow Showers', icon: '🌨️', severe: false },
    86: { label: 'Heavy Snow Showers', icon: '❄️', severe: true },
    95: { label: 'Thunderstorm', icon: '⛈️', severe: true },
    96: { label: 'Thunderstorm + Hail', icon: '⛈️', severe: true },
    99: { label: 'Severe Thunderstorm', icon: '⛈️', severe: true },
};

const getWeatherInfo = (code: number) =>
    WMO_CODES[code] ?? { label: 'Unknown', icon: '🌡️', severe: false };

// ── Wind direction helper ─────────────────────────────────────────────────

const degToCompass = (deg: number) => {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
};

// ── Industry-specific metric panels ──────────────────────────────────────────

type IndustryId = 'solar' | 'insurance' | 'construction' | 'utilities' | 'telecom';

interface IndustryMetric {
    label: string;
    value: string;
    sub?: string;
    status: 'good' | 'caution' | 'danger';
    icon: React.ReactNode;
}

function getIndustryMetrics(industry: IndustryId, w: WeatherData): IndustryMetric[] {
    const { current, daily } = w;
    const todayUV = daily.uvIndexMax[0] ?? current.uvIndex;
    const todayPrecip = daily.precipitationSum[0] ?? 0;
    const maxWind = daily.windSpeedMax[0] ?? current.windSpeed;

    switch (industry) {
        case 'solar':
            return [
                {
                    label: 'UV Index',
                    value: todayUV.toFixed(1),
                    sub: todayUV >= 6 ? 'High irradiance — optimal' : todayUV >= 3 ? 'Moderate' : 'Low — reduced yield',
                    status: todayUV >= 6 ? 'good' : todayUV >= 3 ? 'caution' : 'danger',
                    icon: <Sun size={18} />,
                },
                {
                    label: 'Cloud Cover',
                    value: `${current.cloudCover}%`,
                    sub: current.cloudCover < 25 ? 'Minimal shading' : current.cloudCover < 60 ? 'Partial shading' : 'Heavy shading — degraded output',
                    status: current.cloudCover < 25 ? 'good' : current.cloudCover < 60 ? 'caution' : 'danger',
                    icon: <Cloud size={18} />,
                },
                {
                    label: 'Solar Window',
                    value: (() => {
                        const rise = new Date(daily.sunrise[0]);
                        const set = new Date(daily.sunset[0]);
                        const hrs = ((set.getTime() - rise.getTime()) / 3600000).toFixed(1);
                        return `${hrs}h`;
                    })(),
                    sub: `${new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    status: 'good',
                    icon: <Sunrise size={18} />,
                },
                {
                    label: 'Panel Soiling Risk',
                    value: current.windSpeed < 10 && todayPrecip < 1 ? 'LOW' : current.windSpeed > 25 ? 'HIGH (dust)' : 'MODERATE',
                    sub: 'Dust/debris accumulation estimate',
                    status: current.windSpeed < 10 && todayPrecip < 1 ? 'caution' : current.windSpeed > 25 ? 'danger' : 'good',
                    icon: <Activity size={18} />,
                },
                {
                    label: 'Estimated Output',
                    value: current.cloudCover < 20 && todayUV >= 5 ? '≈95–100%' : current.cloudCover < 50 ? '≈60–80%' : '≈20–50%',
                    sub: 'vs. peak rated capacity',
                    status: current.cloudCover < 20 && todayUV >= 5 ? 'good' : current.cloudCover < 50 ? 'caution' : 'danger',
                    icon: <TrendingUp size={18} />,
                },
                {
                    label: 'Panel Temp Risk',
                    value: current.temperature > 95 ? 'HIGH' : current.temperature > 77 ? 'MODERATE' : 'LOW',
                    sub: current.temperature > 95 ? 'Efficiency loss >0.5%/°F' : 'Nominal operating range',
                    status: current.temperature > 95 ? 'danger' : current.temperature > 77 ? 'caution' : 'good',
                    icon: <Thermometer size={18} />,
                },
            ];

        case 'insurance':
            return [
                {
                    label: 'Hail Risk',
                    value: current.temperature > 5 && (w.current.weatherCode === 96 || w.current.weatherCode === 99) ? 'ACTIVE' : 'LOW',
                    sub: w.current.weatherCode === 96 || w.current.weatherCode === 99 ? 'Thunderstorm with hail detected' : 'No hail activity',
                    status: w.current.weatherCode === 96 || w.current.weatherCode === 99 ? 'danger' : 'good',
                    icon: <CloudRain size={18} />,
                },
                {
                    label: 'Wind Damage Risk',
                    value: maxWind < 40 ? 'LOW' : maxWind < 65 ? 'MODERATE' : 'SEVERE',
                    sub: `Max gusts: ${current.windGusts.toFixed(0)} km/h`,
                    status: maxWind < 40 ? 'good' : maxWind < 65 ? 'caution' : 'danger',
                    icon: <Wind size={18} />,
                },
                {
                    label: 'Precipitation',
                    value: `${todayPrecip.toFixed(1)} mm`,
                    sub: todayPrecip > 25 ? 'Heavy rain — flood watch' : todayPrecip > 10 ? 'Moderate event' : 'Minimal',
                    status: todayPrecip > 25 ? 'danger' : todayPrecip > 10 ? 'caution' : 'good',
                    icon: <Droplets size={18} />,
                },
                {
                    label: 'Lightning Risk',
                    value: current.weatherCode >= 95 ? 'ACTIVE' : current.weatherCode >= 80 ? 'ELEVATED' : 'LOW',
                    sub: current.weatherCode >= 95 ? 'Active storm — avoid field inspections' : 'Monitor conditions',
                    status: current.weatherCode >= 95 ? 'danger' : current.weatherCode >= 80 ? 'caution' : 'good',
                    icon: <Zap size={18} />,
                },
                {
                    label: 'Roof Access Safety',
                    value: current.windSpeed < 25 && todayPrecip < 5 ? 'SAFE' : current.windSpeed < 40 ? 'CAUTION' : 'UNSAFE',
                    sub: 'Adjuster site safety assessment',
                    status: current.windSpeed < 25 && todayPrecip < 5 ? 'good' : current.windSpeed < 40 ? 'caution' : 'danger',
                    icon: <Shield size={18} />,
                },
                {
                    label: 'Date of Loss Match',
                    value: getWeatherInfo(current.weatherCode).severe ? 'SEVERE EVENT' : 'NORMAL',
                    sub: `${getWeatherInfo(current.weatherCode).label} — code ${current.weatherCode}`,
                    status: getWeatherInfo(current.weatherCode).severe ? 'danger' : 'good',
                    icon: <Info size={18} />,
                },
            ];

        case 'construction':
            return [
                {
                    label: 'Work Stoppage Risk',
                    value: current.windSpeed > 50 || todayPrecip > 15 ? 'HIGH' : current.windSpeed > 30 || todayPrecip > 5 ? 'MODERATE' : 'LOW',
                    sub: current.windSpeed > 50 ? 'Crane operations suspended' : 'Conditions allow work',
                    status: current.windSpeed > 50 || todayPrecip > 15 ? 'danger' : current.windSpeed > 30 || todayPrecip > 5 ? 'caution' : 'good',
                    icon: <AlertTriangle size={18} />,
                },
                {
                    label: 'Concrete Pour',
                    value: current.temperature >= 41 && current.temperature <= 90 && todayPrecip < 5 ? 'GO' : 'NO-GO',
                    sub: current.temperature < 41 ? 'Too cold — freeze risk' : current.temperature > 90 ? 'Too hot — rapid cure' : 'Optimal pour conditions',
                    status: current.temperature >= 41 && current.temperature <= 90 && todayPrecip < 5 ? 'good' : 'danger',
                    icon: <Gauge size={18} />,
                },
                {
                    label: 'Wind at Height',
                    value: `${current.windSpeed.toFixed(0)} km/h`,
                    sub: current.windSpeed > 65 ? 'Suspend elevated work' : current.windSpeed > 45 ? 'Restrict crane use' : 'Normal operations',
                    status: current.windSpeed > 65 ? 'danger' : current.windSpeed > 45 ? 'caution' : 'good',
                    icon: <Wind size={18} />,
                },
                {
                    label: 'Ground Conditions',
                    value: todayPrecip > 20 ? 'SATURATED' : todayPrecip > 8 ? 'WET' : 'DRY',
                    sub: todayPrecip > 20 ? 'Heavy equipment — mudslide risk' : 'Monitor site drainage',
                    status: todayPrecip > 20 ? 'danger' : todayPrecip > 8 ? 'caution' : 'good',
                    icon: <Droplets size={18} />,
                },
                {
                    label: 'Productivity Index',
                    value: (() => {
                        let score = 100;
                        if (current.temperature < 41 || current.temperature > 100) score -= 35;
                        else if (current.temperature < 50 || current.temperature > 90) score -= 15;
                        if (current.windSpeed > 50) score -= 40;
                        else if (current.windSpeed > 30) score -= 15;
                        if (todayPrecip > 10) score -= 30;
                        else if (todayPrecip > 3) score -= 10;
                        return `${Math.max(0, score)}%`;
                    })(),
                    sub: 'Estimated outdoor work efficiency',
                    status: (() => {
                        let s = 100;
                        if (current.temperature < 41 || current.temperature > 100) s -= 35;
                        if (current.windSpeed > 50) s -= 40;
                        if (todayPrecip > 10) s -= 30;
                        return s > 75 ? 'good' : s > 50 ? 'caution' : 'danger';
                    })(),
                    icon: <BarChart3 size={18} />,
                },
                {
                    label: 'PPE Recommendation',
                    value: current.temperature < 41 ? 'COLD GEAR' : current.temperature > 90 ? 'HEAT GEAR' : current.windSpeed > 40 || todayPrecip > 5 ? 'RAIN + WIND' : 'STANDARD',
                    sub: 'Site safety equipment advisory',
                    status: current.temperature < 41 || current.temperature > 95 || current.windSpeed > 40 ? 'caution' : 'good',
                    icon: <HardHat size={18} />,
                },
            ];

        case 'utilities':
            return [
                {
                    label: 'Line Sag Risk',
                    value: current.temperature > 95 ? 'HIGH' : current.temperature > 82 ? 'MODERATE' : 'LOW',
                    sub: current.temperature > 95 ? 'Thermal expansion — critical clearances' : 'Normal conductor geometry',
                    status: current.temperature > 95 ? 'danger' : current.temperature > 82 ? 'caution' : 'good',
                    icon: <Activity size={18} />,
                },
                {
                    label: 'Vegetation Risk',
                    value: current.windSpeed > 50 ? 'SEVERE' : current.windSpeed > 30 ? 'ELEVATED' : 'LOW',
                    sub: current.windSpeed > 50 ? 'Tree contact likely' : 'Routine monitoring',
                    status: current.windSpeed > 50 ? 'danger' : current.windSpeed > 30 ? 'caution' : 'good',
                    icon: <Wind size={18} />,
                },
                {
                    label: 'Ice/Snow Loading',
                    value: current.temperature < 36 && todayPrecip > 5 ? 'HIGH' : current.temperature < 32 ? 'MODERATE' : 'LOW',
                    sub: current.temperature < 36 && todayPrecip > 5 ? 'Ice accretion — structural risk' : 'No icing threat',
                    status: current.temperature < 36 && todayPrecip > 5 ? 'danger' : current.temperature < 32 ? 'caution' : 'good',
                    icon: <CloudSnow size={18} />,
                },
                {
                    label: 'Lightning Risk',
                    value: current.weatherCode >= 95 ? 'ACTIVE' : current.weatherCode >= 80 ? 'ELEVATED' : 'LOW',
                    sub: current.weatherCode >= 95 ? 'Suspend field work immediately' : 'Normal operations',
                    status: current.weatherCode >= 95 ? 'danger' : current.weatherCode >= 80 ? 'caution' : 'good',
                    icon: <CloudLightning size={18} />,
                },
                {
                    label: 'Outage Probability',
                    value: current.weatherCode >= 95 || maxWind > 80 ? 'HIGH' : current.weatherCode >= 80 || maxWind > 50 ? 'MODERATE' : 'LOW',
                    sub: 'Based on current storm index',
                    status: current.weatherCode >= 95 || maxWind > 80 ? 'danger' : current.weatherCode >= 80 || maxWind > 50 ? 'caution' : 'good',
                    icon: <Zap size={18} />,
                },
                {
                    label: 'Drone Ops Window',
                    value: current.windSpeed < 40 && current.visibility > 3 && todayPrecip < 2 ? 'OPEN' : current.windSpeed < 55 ? 'RESTRICTED' : 'CLOSED',
                    sub: current.windSpeed < 40 ? 'FAR Part 107 conditions met' : 'Wind/visibility limits exceeded',
                    status: current.windSpeed < 40 && current.visibility > 3 && todayPrecip < 2 ? 'good' : current.windSpeed < 55 ? 'caution' : 'danger',
                    icon: <Navigation size={18} />,
                },
            ];

        case 'telecom':
            return [
                {
                    label: 'Tower Climb Safety',
                    value: current.windSpeed < 30 && todayPrecip < 2 ? 'GO' : current.windSpeed < 50 ? 'CAUTION' : 'NO-GO',
                    sub: current.windSpeed > 50 ? 'Wind speed exceeds climb threshold' : current.windSpeed > 30 ? 'Use full harness kit' : 'Optimal climb conditions',
                    status: current.windSpeed < 30 && todayPrecip < 2 ? 'good' : current.windSpeed < 50 ? 'caution' : 'danger',
                    icon: <Radio size={18} />,
                },
                {
                    label: 'Wind at Tower Top',
                    value: `${(current.windSpeed * 1.3).toFixed(0)} km/h est.`,
                    sub: `Gust potential: ${(current.windGusts * 1.2).toFixed(0)} km/h`,
                    status: current.windSpeed * 1.3 < 40 ? 'good' : current.windSpeed * 1.3 < 65 ? 'caution' : 'danger',
                    icon: <Wind size={18} />,
                },
                {
                    label: 'Lightning Strike Risk',
                    value: current.weatherCode >= 95 ? 'EXTREME' : current.weatherCode >= 80 ? 'HIGH' : 'LOW',
                    sub: current.weatherCode >= 95 ? 'Ground all tower operations' : 'Normal lightning protection',
                    status: current.weatherCode >= 95 ? 'danger' : current.weatherCode >= 80 ? 'caution' : 'good',
                    icon: <CloudLightning size={18} />,
                },
                {
                    label: 'Icing Risk',
                    value: current.temperature < 32 && (todayPrecip > 2 || current.humidity > 85) ? 'HIGH' : current.temperature < 37 ? 'MODERATE' : 'LOW',
                    sub: current.temperature < 32 ? 'Antenna/cable ice accretion risk' : 'No icing threat',
                    status: current.temperature < 32 && todayPrecip > 2 ? 'danger' : current.temperature < 37 ? 'caution' : 'good',
                    icon: <CloudSnow size={18} />,
                },
                {
                    label: 'Signal Degradation',
                    value: current.cloudCover > 80 || current.humidity > 90 ? 'MODERATE' : 'MINIMAL',
                    sub: `Humidity: ${current.humidity}% · Cloud: ${current.cloudCover}%`,
                    status: current.cloudCover > 80 || current.humidity > 90 ? 'caution' : 'good',
                    icon: <Eye size={18} />,
                },
                {
                    label: 'Drone Survey Window',
                    value: current.windSpeed < 35 && current.visibility > 3 && todayPrecip < 2 ? 'OPEN' : current.windSpeed < 55 ? 'LIMITED' : 'CLOSED',
                    sub: `Visibility: ${current.visibility.toFixed(1)} km · Wind: ${current.windSpeed.toFixed(0)} km/h`,
                    status: current.windSpeed < 35 && current.visibility > 3 ? 'good' : current.windSpeed < 55 ? 'caution' : 'danger',
                    icon: <Navigation size={18} />,
                },
            ];

        default:
            return [];
    }
}

// ── Status color helper ───────────────────────────────────────────────────────

const STATUS_STYLES = {
    good: { bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    caution: { bg: 'bg-amber-400/10', border: 'border-amber-400/30', text: 'text-amber-400', dot: 'bg-amber-400' },
    danger: { bg: 'bg-red-400/10', border: 'border-red-400/30', text: 'text-red-400', dot: 'bg-red-400' },
};

// ── Industry colour config ────────────────────────────────────────────────────

const INDUSTRY_COLOURS: Record<IndustryId, { hex: string; tailwind: string; light: string }> = {
    solar: { hex: '#f59e0b', tailwind: 'text-amber-400', light: 'bg-amber-400/10' },
    insurance: { hex: '#ef4444', tailwind: 'text-red-400', light: 'bg-red-400/10' },
    construction: { hex: '#eab308', tailwind: 'text-yellow-400', light: 'bg-yellow-400/10' },
    utilities: { hex: '#06b6d4', tailwind: 'text-cyan-400', light: 'bg-cyan-400/10' },
    telecom: { hex: '#8b5cf6', tailwind: 'text-violet-400', light: 'bg-violet-400/10' },
};

const INDUSTRY_LABELS: Record<IndustryId, string> = {
    solar: '☀️ Solar', insurance: '🏠 Insurance', construction: '🏗️ Construction',
    utilities: '⚡ Utilities', telecom: '📡 Telecom',
};

// ── Main Component ────────────────────────────────────────────────────────────

interface WeatherDashboardProps {
    industry: IndustryId;
}

const WeatherDashboard: React.FC<WeatherDashboardProps> = ({ industry: industryRaw }) => {
    const industry = (industryRaw?.toLowerCase() ?? 'solar') as IndustryId;
    const { user } = useAuth();

    const [geo, setGeo] = useState<GeoLocation | null>(null);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState(0);
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<any>(null);
    const leafletMarkerRef = useRef<any>(null);

    const colours = INDUSTRY_COLOURS[industry];

    // ── Geolocation → Reverse geocode ─────────────────────────────────────

    const fetchGeocode = useCallback(async (lat: number, lon: number) => {
        try {
            const r = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
            );
            const d = await r.json();
            const a = d.address ?? {};
            setGeo({
                lat, lon,
                city: a.city || a.town || a.village || a.county || 'Unknown',
                region: a.state || a.region || '',
                country: a.country || '',
            });
        } catch {
            setGeo({ lat, lon, city: 'Your Location', region: '', country: '' });
        }
    }, []);

    // ── Weather fetch (Open-Meteo) ─────────────────────────────────────────

    const fetchWeather = useCallback(async (lat: number, lon: number) => {
        try {
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
            url.searchParams.set('forecast_days', '7');
            url.searchParams.set('timezone', 'auto');

            const res = await fetch(url.toString());
            const d = await res.json();

            // API may return error body even on 200 — check for it
            if (d.error || !d.current || !d.hourly || !d.daily) {
                const reason = d.reason || d.error || 'Unexpected API response format';
                console.error('[WeatherDashboard] API error:', reason, d);
                setWeatherError(`Weather API: ${reason}`);
                return;
            }

            const c = d.current;
            const h = d.hourly;
            const day = d.daily;

            setWeather({
                current: {
                    temperature: c.temperature_2m,
                    feelsLike: c.apparent_temperature,
                    humidity: c.relative_humidity_2m,
                    windSpeed: c.wind_speed_10m,
                    windDirection: c.wind_direction_10m,
                    windGusts: c.wind_gusts_10m,
                    precipitation: c.precipitation,
                    cloudCover: c.cloud_cover,
                    visibility: (c.visibility ?? 10000) / 1000,
                    pressure: c.surface_pressure,
                    uvIndex: c.uv_index,
                    weatherCode: c.weather_code,
                    isDay: c.is_day === 1,
                    dewPoint: c.dew_point_2m,
                },
                hourly: {
                    time: h.time,
                    temperature: h.temperature_2m,
                    precipitation: h.precipitation,
                    windSpeed: h.wind_speed_10m,
                    cloudCover: h.cloud_cover,
                    uvIndex: h.uv_index,
                    precipitationProbability: h.precipitation_probability,
                    lightningPotential: h.time.map(() => 0), // derived from weather_code instead
                    irradiance: h.shortwave_radiation ?? h.time.map(() => 0),
                },
                daily: {
                    time: day.time,
                    tempMax: day.temperature_2m_max,
                    tempMin: day.temperature_2m_min,
                    precipitationSum: day.precipitation_sum,
                    windSpeedMax: day.wind_speed_10m_max,
                    uvIndexMax: day.uv_index_max,
                    sunrise: day.sunrise,
                    sunset: day.sunset,
                    weatherCode: day.weather_code,
                    precipitationProbability: day.precipitation_probability_max,
                },
                fetchedAt: new Date(),
            });
            setWeatherError(null);
        } catch (e: any) {
            console.error('[WeatherDashboard] fetch error:', e);
            setWeatherError(`Could not load weather: ${e?.message ?? 'Check connection'}`);
        }
    }, []);

    // ── Request geolocation on mount ──────────────────────────────────────

    const requestLocation = useCallback(() => {
        setLoading(true);
        setGeoError(null);
        if (!navigator.geolocation) {
            setGeoError('Geolocation not supported by this browser.');
            setLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lon } = pos.coords;
                await Promise.all([fetchGeocode(lat, lon), fetchWeather(lat, lon)]);
                setLoading(false);
            },
            (err) => {
                setGeoError(`Location access denied: ${err.message}. Using default location.`);
                // Fallback: New York City
                const lat = 40.7128, lon = -74.0060;
                Promise.all([fetchGeocode(lat, lon), fetchWeather(lat, lon)]).then(() => setLoading(false));
            },
            { timeout: 8000, maximumAge: 300000 }
        );
    }, [fetchGeocode, fetchWeather]);

    useEffect(() => { requestLocation(); }, [requestLocation]);

    // ── Leaflet live map ──────────────────────────────────────────────────
    useEffect(() => {
        if (!geo || !mapRef.current) return;

        let isMounted = true;

        const initMap = () => {
            if (!isMounted) return;
            const L = (window as any).L;
            if (!L) return;

            // Strict cleanup of container to prevent "Map container is already initialized"
            if (mapRef.current) {
                // Remove existing map instance if it was tracked
                if (leafletMapRef.current) {
                    leafletMapRef.current.off();
                    leafletMapRef.current.remove();
                    leafletMapRef.current = null;
                    leafletMarkerRef.current = null;
                }

                // Nuclear option: clear DOM if Leaflet left artifacts
                const container = mapRef.current;
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
            }

            try {
                const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                map.setView([geo.lat, geo.lon], 12);

                const marker = L.marker([geo.lat, geo.lon]).addTo(map)
                    .bindPopup(`<b>${geo.city}</b><br>${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`).openPopup();

                leafletMapRef.current = map;
                leafletMarkerRef.current = marker;

                // Fix for gray tiles when rendered inside flex/grid containers
                setTimeout(() => {
                    if (isMounted && leafletMapRef.current) {
                        leafletMapRef.current.invalidateSize();
                    }
                }, 250);
            } catch (err) {
                console.error("Leaflet initialization error:", err);
            }
        };

        if ((window as any).L) {
            initMap();
        } else {
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            if (!document.getElementById('leaflet-js')) {
                const script = document.createElement('script');
                script.id = 'leaflet-js';
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = () => {
                    if (isMounted) initMap();
                };
                document.head.appendChild(script);
            } else {
                // Script tag exists but window.L might not be ready yet
                const existingScript = document.getElementById('leaflet-js') as HTMLScriptElement;
                existingScript.addEventListener('load', initMap);
            }
        }

        return () => {
            isMounted = false;
            if (leafletMapRef.current) {
                leafletMapRef.current.off();
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
            if (mapRef.current) {
                mapRef.current.innerHTML = '';
            }
        };
    }, [geo]);

    // ── Helpers ───────────────────────────────────────────────────────────

    const getDayLabel = (dateStr: string, idx: number) => {
        if (idx === 0) return 'Today';
        if (idx === 1) return 'Tomorrow';
        return new Date(dateStr + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    // ── Render: Loading ─────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-sm font-semibold">Obtaining your location…</p>
            <p className="text-xs text-slate-600 mt-2">Fetching live weather data</p>
        </div>
    );

    // ── Render: Weather error ───────────────────────────────────────────────

    if (weatherError && !weather) return (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-4">
            <AlertTriangle className="text-amber-400" size={40} />
            <p className="font-semibold">{weatherError}</p>
            <button onClick={requestLocation} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl">Retry</button>
        </div>
    );

    if (!weather) return null;

    const { current, daily, hourly } = weather;
    const wInfo = getWeatherInfo(current.weatherCode);
    const metrics = getIndustryMetrics(industry, weather);

    // Next 12 hours
    const nowHourIdx = hourly.time.findIndex(t => t >= new Date().toISOString().slice(0, 13));
    const next12 = Array.from({ length: 12 }, (_, i) => nowHourIdx + i).filter(i => i < hourly.time.length);

    // ── Flight Go/No-Go assessment ────────────────────────────────────────
    const windOk = current.windSpeed < 40;
    const gustOk = current.windGusts < 55;
    const visOk = current.visibility >= 3;
    const precipOk = current.precipitation < 0.5;
    const noLightning = current.weatherCode < 95;
    const noSevere = !wInfo.severe;
    const flightGo = windOk && gustOk && visOk && precipOk && noLightning;
    const flightCaution = !flightGo && (current.windSpeed < 55) && noLightning && visOk;
    const flightStatus = flightGo ? 'GO' : flightCaution ? 'CAUTION' : 'NO-GO';
    const flightReasons: string[] = [];
    if (!windOk) flightReasons.push(`Wind ${current.windSpeed.toFixed(0)} km/h (limit 40)`);
    if (!gustOk) flightReasons.push(`Gusts ${current.windGusts.toFixed(0)} km/h (limit 55)`);
    if (!visOk) flightReasons.push(`Visibility ${current.visibility.toFixed(1)} km (min 3 km)`);
    if (!precipOk) flightReasons.push('Active precipitation');
    if (!noLightning) flightReasons.push('Lightning/Thunderstorm active');
    const flightBgMap = { 'GO': 'bg-emerald-500/10 border-emerald-500/30', 'CAUTION': 'bg-amber-500/10 border-amber-500/30', 'NO-GO': 'bg-red-500/10 border-red-500/30' };
    const flightTextMap = { 'GO': 'text-emerald-400', 'CAUTION': 'text-amber-400', 'NO-GO': 'text-red-400' };
    const flightDotMap = { 'GO': 'bg-emerald-400', 'CAUTION': 'bg-amber-400', 'NO-GO': 'bg-red-400' };

    // Best window in next 12h (lowest wind + no precip)
    const bestHourIdx = next12.reduce((best, i) => {
        const score = hourly.windSpeed[i] + (hourly.precipitation[i] > 0.1 ? 50 : 0) + (hourly.cloudCover[i] > 80 ? 10 : 0);
        const bestScore = hourly.windSpeed[best] + (hourly.precipitation[best] > 0.1 ? 50 : 0);
        return score < bestScore ? i : best;
    }, next12[0]);
    const bestHour = bestHourIdx != null ? new Date(hourly.time[bestHourIdx]) : null;

    // Current irradiance
    const currentIrradiance = hourly.irradiance[nowHourIdx] ?? 0;
    const peakIrradiance = Math.max(...next12.map(i => hourly.irradiance[i] ?? 0));

    return (
        <div className="space-y-6">

            {/* ── Header: Location + User ──────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <MapPin size={16} className={colours.tailwind} />
                        <h2 className="text-xl font-black text-white tracking-tight">
                            {geo ? `${geo.city}${geo.region ? `, ${geo.region}` : ''}` : 'Locating…'}
                        </h2>
                        {geo && <span className="text-slate-500 text-sm">{geo.country}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>
                            Logged in as <span className="text-slate-300 font-semibold">
                                {user?.fullName || user?.email || 'Unknown User'}
                            </span>
                        </span>
                        {geo && <span>· {geo.lat.toFixed(4)}°, {geo.lon.toFixed(4)}°</span>}
                        <span>· Updated {weather.fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {geoError && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                            <AlertTriangle size={11} /> {geoError}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Industry badge */}
                    <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${colours.tailwind} ${colours.light} border-current/20`}>
                        {INDUSTRY_LABELS[industry]} Operations
                    </span>
                    <button
                        onClick={requestLocation}
                        className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-all"
                        title="Refresh weather"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* ── FLIGHT SUGGESTION PANEL ──────────────────────────────── */}
            <div className={`rounded-2xl border p-4 ${flightBgMap[flightStatus]}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-2xl font-black border ${flightBgMap[flightStatus]}`}>
                            {flightStatus === 'GO' ? '✈️' : flightStatus === 'CAUTION' ? '⚠️' : '🚫'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`text-2xl font-black tracking-tight ${flightTextMap[flightStatus]}`}>{flightStatus}</span>
                                <div className={`w-2 h-2 rounded-full animate-pulse ${flightDotMap[flightStatus]}`} />
                            </div>
                            <p className="text-[11px] text-slate-400 font-semibold">Drone Flight Recommendation · FAR Part 107</p>
                        </div>
                    </div>
                    {bestHour && (
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Best Window</p>
                            <p className={`text-lg font-black ${flightTextMap[flightStatus]}`}>
                                {bestHour.getHours().toString().padStart(2, '0')}:00 – {(bestHour.getHours() + 2).toString().padStart(2, '0')}:00
                            </p>
                            <p className="text-[10px] text-slate-500">
                                Wind {hourly.windSpeed[bestHourIdx].toFixed(0)} km/h · Cloud {hourly.cloudCover[bestHourIdx]}%
                            </p>
                        </div>
                    )}
                </div>
                {flightReasons.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {flightReasons.map(r => (
                            <span key={r} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${flightBgMap[flightStatus]} ${flightTextMap[flightStatus]} border ${flightBgMap[flightStatus].split(' ')[1]}`}>{r}</span>
                        ))}
                    </div>
                )}
                {industry === 'solar' && (
                    <div className="mt-3 flex items-center gap-4 pt-3 border-t border-current/10">
                        <div>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest">Now Irradiance</p>
                            <p className={`text-base font-black ${currentIrradiance > 600 ? 'text-amber-400' : currentIrradiance > 200 ? 'text-yellow-400' : 'text-slate-400'}`}>{currentIrradiance.toFixed(0)} W/m²</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest">Peak (12h)</p>
                            <p className="text-base font-black text-amber-300">{peakIrradiance.toFixed(0)} W/m²</p>
                        </div>
                        <div className="flex-1">
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, (currentIrradiance / 1000) * 100)}%` }} />
                            </div>
                            <p className="text-[9px] text-slate-600 mt-0.5">{((currentIrradiance / 1000) * 100).toFixed(0)}% of peak solar (1000 W/m²)</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── LIVE MAP ─────────────────────────────────────────────── */}
            {geo && (
                <div className="rounded-2xl border border-slate-700/50 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 border-b border-slate-700/50">
                        <MapPin size={13} className={colours.tailwind} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Location Map</span>
                        <span className="ml-auto text-[10px] text-slate-600">{geo.lat.toFixed(4)}°, {geo.lon.toFixed(4)}°</span>
                    </div>
                    <div ref={mapRef} style={{ height: 240 }} className="w-full" />
                </div>
            )}

            {/* ── Current Conditions Hero ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main weather card */}
                <div className="lg:col-span-1 bg-gradient-to-br from-slate-800 to-slate-800/60 border border-slate-700/50 rounded-2xl p-6 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="text-6xl mb-2">{wInfo.icon}</div>
                            <div className="text-5xl font-black text-white">{current.temperature.toFixed(0)}°F</div>
                            <div className="text-slate-400 text-sm mt-1">Feels like {current.feelsLike.toFixed(0)}°F</div>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-bold ${wInfo.severe ? 'text-red-400' : 'text-slate-300'}`}>{wInfo.label}</div>
                            {wInfo.severe && (
                                <div className="flex items-center gap-1 text-red-400 text-xs mt-1 justify-end">
                                    <AlertTriangle size={11} /> Severe Weather
                                </div>
                            )}
                            <div className="text-xs text-slate-500 mt-2">{current.isDay ? '☀️ Daytime' : '🌙 Nighttime'}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-auto">
                        {[
                            { icon: <Wind size={13} />, label: 'Wind', val: `${current.windSpeed.toFixed(0)} km/h ${degToCompass(current.windDirection)}` },
                            { icon: <Droplets size={13} />, label: 'Humidity', val: `${current.humidity}%` },
                            { icon: <Eye size={13} />, label: 'Visibility', val: `${current.visibility.toFixed(1)} km` },
                            { icon: <Gauge size={13} />, label: 'Pressure', val: `${current.pressure.toFixed(0)} hPa` },
                            { icon: <Thermometer size={13} />, label: 'Dew Point', val: `${current.dewPoint.toFixed(0)}°F` },
                            { icon: <Sun size={13} />, label: 'UV Index', val: current.uvIndex.toFixed(1) },
                        ].map(m => (
                            <div key={m.label} className="bg-slate-900/50 rounded-xl p-2.5">
                                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mb-0.5">
                                    {m.icon} {m.label}
                                </div>
                                <div className="text-white text-sm font-bold">{m.val}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Wind gusts + Sunrise/set */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {/* Wind detail */}
                    <div className="col-span-2 sm:col-span-1 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wind Detail</div>
                        <div className="flex flex-col gap-2">
                            <div>
                                <div className="text-2xl font-black text-white">{current.windSpeed.toFixed(0)}<span className="text-sm font-normal text-slate-400 ml-1">km/h</span></div>
                                <div className="text-xs text-slate-500">Sustained {degToCompass(current.windDirection)}</div>
                            </div>
                            <div className="h-px bg-slate-700" />
                            <div>
                                <div className="text-lg font-bold text-amber-400">{current.windGusts.toFixed(0)}<span className="text-sm font-normal text-slate-400 ml-1">km/h</span></div>
                                <div className="text-xs text-slate-500">Gusts</div>
                            </div>
                            {/* Wind direction indicator */}
                            <div className="flex items-center gap-2 mt-1">
                                <div
                                    className="w-6 h-6 flex items-center justify-center"
                                    style={{ transform: `rotate(${current.windDirection}deg)` }}
                                >
                                    <ArrowUp size={20} className={colours.tailwind} />
                                </div>
                                <span className="text-xs text-slate-400">{current.windDirection}° · {degToCompass(current.windDirection)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Sun times */}
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sun Schedule</div>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Sunrise size={16} className="text-amber-400" />
                                <div>
                                    <div className="text-white font-bold text-sm">
                                        {new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-[10px] text-slate-500">Sunrise</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Sunset size={16} className="text-orange-400" />
                                <div>
                                    <div className="text-white font-bold text-sm">
                                        {new Date(daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-[10px] text-slate-500">Sunset</div>
                                </div>
                            </div>
                            <div className="mt-auto text-xs text-slate-500 pt-2 border-t border-slate-700">
                                {(() => {
                                    const hrs = ((new Date(daily.sunset[0]).getTime() - new Date(daily.sunrise[0]).getTime()) / 3600000).toFixed(1);
                                    return `${hrs}h daylight`;
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Today high/low */}
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Today Range</div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <ArrowUp size={16} className="text-red-400" />
                                <div>
                                    <div className="text-white font-bold">{daily.tempMax[0].toFixed(0)}°F</div>
                                    <div className="text-[10px] text-slate-500">High</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <ArrowDown size={16} className="text-blue-400" />
                                <div>
                                    <div className="text-white font-bold">{daily.tempMin[0].toFixed(0)}°F</div>
                                    <div className="text-[10px] text-slate-500">Low</div>
                                </div>
                            </div>
                            <div className="text-xs mt-auto pt-2 border-t border-slate-700 text-slate-500">
                                Precip: {daily.precipitationSum[0].toFixed(1)} mm · {daily.precipitationProbability[0]}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Industry Metrics ─────────────────────────────────────── */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className={`w-1 h-5 rounded-full ${colours.tailwind.replace('text-', 'bg-')}`} />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        {INDUSTRY_LABELS[industry]} Operations Intelligence
                    </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {metrics.map(m => {
                        const s = STATUS_STYLES[m.status];
                        return (
                            <div key={m.label} className={`rounded-2xl border p-4 ${s.bg} ${s.border}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={s.text}>{m.icon}</div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{m.label}</span>
                                    <div className={`ml-auto w-2 h-2 rounded-full ${s.dot}`} />
                                </div>
                                <div className={`text-lg font-black ${s.text}`}>{m.value}</div>
                                {m.sub && <div className="text-xs text-slate-500 mt-0.5 leading-snug">{m.sub}</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── 12-Hour Hourly Forecast ──────────────────────────────── */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className={`w-1 h-5 rounded-full ${colours.tailwind.replace('text-', 'bg-')}`} />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Next 12 Hours</h3>
                </div>
                <div className="overflow-x-auto">
                    <div className="flex gap-2 min-w-max pb-1">
                        {next12.map((i) => {
                            const hour = new Date(hourly.time[i]);
                            const code = Math.round(hourly.cloudCover[i] / 25) * 25; // rough cloud grouping
                            const emoji = hourly.precipitation[i] > 1 ? '🌧️' : hourly.cloudCover[i] > 70 ? '☁️' : hourly.cloudCover[i] > 30 ? '⛅' : '☀️';
                            const popPct = hourly.precipitationProbability[i];
                            return (
                                <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex flex-col items-center gap-1.5 min-w-[68px]">
                                    <div className="text-[10px] text-slate-500 font-bold">
                                        {hour.getHours().toString().padStart(2, '0')}:00
                                    </div>
                                    <div className="text-xl">{emoji}</div>
                                    <div className="text-white text-sm font-bold">{hourly.temperature[i].toFixed(0)}°</div>
                                    <div className="text-[10px] text-slate-400">{hourly.windSpeed[i].toFixed(0)} km/h</div>
                                    {popPct > 10 && (
                                        <div className="text-[10px] text-blue-400 font-bold">{popPct}%</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── 7-Day Daily Forecast ─────────────────────────────────── */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className={`w-1 h-5 rounded-full ${colours.tailwind.replace('text-', 'bg-')}`} />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">7-Day Forecast</h3>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {daily.time.slice(0, 7).map((dateStr, idx) => {
                        const dInfo = getWeatherInfo(daily.weatherCode[idx]);
                        const isActive = activeDay === idx;
                        return (
                            <button
                                key={idx}
                                onClick={() => setActiveDay(idx)}
                                className={`rounded-2xl p-3 flex flex-col items-center gap-2 border transition-all duration-200
                                    ${isActive
                                        ? `${colours.light} ${colours.tailwind.replace('text-', 'border-')}/40 border`
                                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50'
                                    }`}
                            >
                                <div className={`text-[10px] font-bold ${isActive ? colours.tailwind : 'text-slate-500'}`}>
                                    {idx === 0 ? 'Today' : new Date(dateStr + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                                <div className="text-2xl">{dInfo.icon}</div>
                                <div className="text-white font-bold text-sm">{daily.tempMax[idx].toFixed(0)}°</div>
                                <div className="text-slate-500 text-xs">{daily.tempMin[idx].toFixed(0)}°</div>
                                {daily.precipitationProbability[idx] > 20 && (
                                    <div className="text-[9px] text-blue-400 font-bold">{daily.precipitationProbability[idx]}%</div>
                                )}
                                {dInfo.severe && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                            </button>
                        );
                    })}
                </div>

                {/* Selected day detail */}
                {daily.time[activeDay] && (
                    <div className={`mt-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4`}>
                        <div>
                            <div className="text-[10px] text-slate-500 mb-1">Date</div>
                            <div className="text-white font-bold text-sm">{getDayLabel(daily.time[activeDay], activeDay)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 mb-1">Conditions</div>
                            <div className="text-white font-bold text-sm">{getWeatherInfo(daily.weatherCode[activeDay]).label}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 mb-1">Max Wind</div>
                            <div className="text-white font-bold text-sm">{daily.windSpeedMax[activeDay].toFixed(0)} km/h</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 mb-1">UV Max / Precip</div>
                            <div className="text-white font-bold text-sm">UV {daily.uvIndexMax[activeDay].toFixed(0)} · {daily.precipitationSum[activeDay].toFixed(1)} mm</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeatherDashboard;
