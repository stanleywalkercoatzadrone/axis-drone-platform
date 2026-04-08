// PilotWeatherV2 — aviation-grade weather dashboard (2026-03-26)
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import apiClient from '../../../services/apiClient';
import { Heading, Text } from '../../../../stitch/components/Typography';
import { Badge } from '../../../../stitch/components/Badge';
import {
    Thermometer, Wind, Droplets, Cloud, Sun, Database,
    Eye, Gauge, Zap, Compass, AlertTriangle, CheckCircle, XCircle,
    RefreshCw, MapPin, Clock
} from 'lucide-react';

const targetIcon = new Icon({
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41],
});

const DEFAULT_LAT = 36.17;
const DEFAULT_LON = -115.13;

const degreesToCompass = (deg: number): string => {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round((deg % 360) / 22.5) % 16];
};

const wmoToLabel = (code: number): string => {
    if (code === 0) return 'Clear Sky';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 9) return 'Fog / Mist';
    if (code <= 29) return 'Drizzle';
    if (code <= 39) return 'Rain';
    if (code <= 49) return 'Snow';
    if (code <= 59) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 84) return 'Rain Showers';
    if (code <= 86) return 'Snow Showers';
    if (code <= 94) return 'Thunderstorm';
    return 'Severe Storm';
};

const wmoToEmoji = (code?: number): string => {
    if (!code && code !== 0) return '🌡️';
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 9) return '🌫️';
    if (code <= 39) return '🌦️';
    if (code <= 49) return '❄️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 86) return '🌨️';
    if (code <= 94) return '⛈️';
    return '🌪️';
};

const uvLabel = (uv: number) => {
    if (uv < 3) return { label: 'Low', cls: 'text-emerald-400' };
    if (uv < 6) return { label: 'Moderate', cls: 'text-yellow-400' };
    if (uv < 8) return { label: 'High', cls: 'text-orange-400' };
    if (uv < 11) return { label: 'Very High', cls: 'text-red-400' };
    return { label: 'Extreme', cls: 'text-purple-400' };
};

interface FullWeather {
    temperature: number; feels_like: number; humidity: number; dew_point: number;
    wind_speed: number; wind_gusts: number; wind_direction: string; wind_bearing: number;
    precipitation: number; weather_code: number; cloud_cover: number;
    visibility_mi: number; uv_index: number; pressure_hpa: number; solar_radiation: number;
    flight_status: 'GO' | 'CAUTION' | 'NO_GO'; flight_reasons: string[];
}

interface HourlySlot {
    time: string; temp: number; wind: number; precip_prob: number; cloud: number; code: number;
}

interface SourceRow { label: string; color: string; text: string; }

async function fetchFull(lat: number, lon: number): Promise<{ weather: FullWeather; hourly: HourlySlot[] }> {
    const url = `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
        `wind_speed_10m,wind_gusts_10m,wind_direction_10m,` +
        `precipitation,weather_code,cloud_cover,visibility,` +
        `uv_index,surface_pressure,dew_point_2m,shortwave_radiation` +
        `&hourly=temperature_2m,wind_speed_10m,precipitation_probability,cloud_cover,weather_code` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_hours=6&timezone=auto`;

    const res = await fetch(url);
    const data = await res.json();
    const c = data.current || {};

    const windSpeed = Math.round(c.wind_speed_10m || 0);
    const gusts     = Math.round(c.wind_gusts_10m || 0);
    const vis       = Math.round((c.visibility || 9999) / 1609.34 * 10) / 10;
    const cloud     = c.cloud_cover || 0;
    const precip    = c.precipitation || 0;
    const code      = c.weather_code;

    const reasons: string[] = [];
    let status: 'GO' | 'CAUTION' | 'NO_GO' = 'GO';

    if (windSpeed > 22 || gusts > 28)          { status = 'NO_GO';   reasons.push(`Winds ${windSpeed} mph, gusts ${gusts} mph — exceeds FAA ~23 mph limit`); }
    else if (windSpeed > 15 || gusts > 20)      { if (status === 'GO') status = 'CAUTION'; reasons.push(`Wind ${windSpeed} mph gusting to ${gusts} mph`); }
    if (precip > 0)                             { status = 'NO_GO';   reasons.push(`Active precipitation: ${precip} mm`); }
    if (code >= 95)                             { status = 'NO_GO';   reasons.push('Active thunderstorm'); }
    else if (code >= 61 && code <= 67)          { status = 'NO_GO';   reasons.push('Active rain'); }
    else if (code >= 71 && code <= 77)          { status = 'NO_GO';   reasons.push('Active snow/ice'); }
    if (vis < 3)                                { status = 'NO_GO';   reasons.push(`Visibility ${vis} mi — below FAA 3 mi minimum`); }
    else if (vis < 5)                           { if (status === 'GO') status = 'CAUTION'; reasons.push(`Reduced visibility: ${vis} mi`); }
    if (cloud > 85)                             { if (status === 'GO') status = 'CAUTION'; reasons.push(`Heavy cloud cover: ${cloud}%`); }

    const hourly: HourlySlot[] = (data.hourly?.time || []).slice(0, 6).map((t: string, i: number) => ({
        time: t,
        temp:        Math.round(data.hourly.temperature_2m?.[i] || 0),
        wind:        Math.round(data.hourly.wind_speed_10m?.[i] || 0),
        precip_prob: data.hourly.precipitation_probability?.[i] || 0,
        cloud:       data.hourly.cloud_cover?.[i] || 0,
        code:        data.hourly.weather_code?.[i] || 0,
    }));

    return {
        weather: {
            temperature:    Math.round(c.temperature_2m || 0),
            feels_like:     Math.round(c.apparent_temperature || 0),
            humidity:       Math.round(c.relative_humidity_2m || 0),
            dew_point:      Math.round(c.dew_point_2m || 0),
            wind_speed:     windSpeed,
            wind_gusts:     gusts,
            wind_direction: degreesToCompass(c.wind_direction_10m || 0),
            wind_bearing:   Math.round(c.wind_direction_10m || 0),
            precipitation:  precip,
            weather_code:   code,
            cloud_cover:    cloud,
            visibility_mi:  vis,
            uv_index:       Math.round((c.uv_index || 0) * 10) / 10,
            pressure_hpa:   Math.round(c.surface_pressure || 0),
            solar_radiation:Math.round(c.shortwave_radiation || 0),
            flight_status:  status,
            flight_reasons: reasons,
        },
        hourly,
    };
}

// ── Wind Compass ──────────────────────────────────────────────────────────────
const WindCompass: React.FC<{ bearing: number; speed: number }> = ({ bearing, speed }) => (
    <div className="relative w-28 h-28 mx-auto">
        <div className="absolute inset-0 rounded-full border-2 border-slate-700 bg-slate-900/80" />
        {['N','E','S','W'].map((d, i) => {
            const angle = i * 90;
            const rad = (angle - 90) * Math.PI / 180;
            const x = 50 + 40 * Math.cos(rad);
            const y = 50 + 40 * Math.sin(rad);
            return (
                <span key={d} className="absolute text-[10px] font-black text-slate-400 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}>{d}</span>
            );
        })}
        {/* Arrow */}
        <div className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${bearing}deg)` }}>
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[40px] border-l-transparent border-r-transparent border-b-cyan-400"
                style={{ marginTop: '-20px' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-black text-white">{speed}</span>
        </div>
    </div>
);

// ── Tile component ────────────────────────────────────────────────────────────
const Tile: React.FC<{
    icon: string; label: string; value: string; sub?: string;
    accent?: string; wide?: boolean; warn?: boolean;
}> = ({ icon, label, value, sub, accent = 'text-slate-300', wide, warn }) => (
    <div className={`bg-slate-900/80 border ${warn ? 'border-red-500/40 bg-red-950/20' : 'border-slate-700/60'} rounded-2xl p-4 ${wide ? 'col-span-2' : ''}`}>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{icon} {label}</p>
        <p className={`text-xl font-black font-mono ${accent}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function PilotWeatherV2() {
    const [coords,  setCoords]  = useState<{ lat: number; lon: number; town: string } | null>(null);
    const [wx,      setWx]      = useState<FullWeather | null>(null);
    const [hourly,  setHourly]  = useState<HourlySlot[]>([]);
    const [wttrRow, setWttrRow] = useState<SourceRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        let lat = DEFAULT_LAT, lon = DEFAULT_LON, town = 'Mission Site';

        try {
            const acts = await apiClient.get('/pilot/secure/missions');
            const mission = acts.data?.data?.[0];
            if (mission?.latitude && mission?.longitude) {
                lat  = parseFloat(mission.latitude);
                lon  = parseFloat(mission.longitude);
                town = mission.location || mission.title || 'Mission Site';
            } else if (mission?.location) { town = mission.location; }
        } catch (_) {}

        if (lat === DEFAULT_LAT && 'geolocation' in navigator) {
            await new Promise<void>((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (p) => { lat = p.coords.latitude; lon = p.coords.longitude; resolve(); },
                    () => resolve(), { timeout: 4000 }
                );
            });
        }

        setCoords({ lat, lon, town });

        try {
            const { weather, hourly: h } = await fetchFull(lat, lon);
            setWx(weather);
            setHourly(h);
            setLastFetch(new Date());
        } catch (e) { console.error('[PilotWeatherV2]', e); }

        // wttr.in as secondary source
        try {
            const res  = await fetch(`https://wttr.in/${lat},${lon}?format=j1`);
            const data = await res.json();
            const c    = data.current_condition?.[0];
            if (c) {
                setWttrRow({
                    color: 'text-violet-400', label: 'wttr.in',
                    text: `${c.temp_F}°F · ${c.windspeedMiles} mph ${c.winddir16Point} · ${c.humidity}% RH · ${c.cloudcover}% cloud · Vis ${c.visibility} mi`,
                });
            }
        } catch { setWttrRow({ color: 'text-slate-600', label: 'wttr.in', text: 'source unavailable' }); }

        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-400">
            <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest">Fetching atmospheric data...</span>
        </div>
    );

    if (!coords || !wx) return (
        <div className="flex items-center justify-center min-h-[60vh] text-slate-500 text-sm">
            Unable to load weather data.
        </div>
    );

    const statusCfg = {
        GO:      { cls: 'border-emerald-500/40 bg-emerald-950/30', icon: '✅', text: 'text-emerald-400', label: 'GO — CONDITIONS FAVORABLE', sub: 'All FAA Part 107 parameters within limits' },
        CAUTION: { cls: 'border-amber-500/40 bg-amber-950/20',     icon: '⚠️', text: 'text-amber-400',    label: 'CAUTION — REVIEW BEFORE FLIGHT', sub: 'One or more conditions require pilot review' },
        NO_GO:   { cls: 'border-red-500/40 bg-red-950/30',         icon: '🚫', text: 'text-red-400',      label: 'NO-GO — UNSAFE CONDITIONS',     sub: 'Flight not recommended — see reasons below' },
    }[wx.flight_status];

    const uv = uvLabel(wx.uv_index);

    return (
        <div className="p-3 md:p-8 space-y-5 pb-36 pt-16 md:pt-8 md:pb-8 max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Heading level={2} className="text-2xl font-black text-white tracking-tight uppercase">
                        Atmospheric Conditions
                    </Heading>
                    <div className="flex items-center gap-2 mt-1">
                        <MapPin size={12} className="text-emerald-400" />
                        <Text variant="small" className="text-emerald-400 font-black uppercase tracking-widest">
                            {coords.town}
                        </Text>
                        {lastFetch && (
                            <span className="text-[10px] text-slate-500 ml-2">
                                Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
                        <RefreshCw size={12} /> Refresh
                    </button>
                    <Badge variant="success" className="animate-pulse">Live</Badge>
                </div>
            </div>

            {/* ── Flight Status Banner ───────────────────────────────────────── */}
            <div className={`border rounded-2xl px-6 py-5 flex items-start gap-4 ${statusCfg.cls}`}>
                <span className="text-3xl flex-shrink-0">{statusCfg.icon}</span>
                <div className="flex-1">
                    <p className={`text-sm font-black uppercase tracking-widest ${statusCfg.text}`}>{statusCfg.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{statusCfg.sub}</p>
                    {wx.flight_reasons.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                            {wx.flight_reasons.map((r, i) => (
                                <p key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                    <span className="text-red-400">•</span> {r}
                                </p>
                            ))}
                        </div>
                    )}
                    {wx.flight_status === 'GO' && (
                        <p className="text-xs text-slate-400 mt-1.5">Wind, visibility, precipitation, and sky conditions all within Part 107 parameters.</p>
                    )}
                </div>
                <div className="hidden md:block text-right flex-shrink-0">
                    <p className="text-4xl font-black font-mono text-white">{wx.temperature}°F</p>
                    <p className="text-xs text-slate-400 mt-1">{wmoToEmoji(wx.weather_code)} {wmoToLabel(wx.weather_code)}</p>
                    <p className="text-[10px] text-slate-500">Feels {wx.feels_like}°F</p>
                </div>
            </div>

            {/* ── Map ──────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-700 overflow-hidden shadow-2xl relative">
                <div className="h-[220px] md:h-[320px] w-full">
                    <MapContainer center={[coords.lat, coords.lon]} zoom={11}
                        style={{ height: '100%', width: '100%', backgroundColor: '#020617' }} zoomControl>
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                        />
                        <Marker position={[coords.lat, coords.lon]} icon={targetIcon}>
                            <Popup>
                                <span className="font-bold">{wx.temperature}°F — {wmoToLabel(wx.weather_code)}</span>
                            </Popup>
                        </Marker>
                        <Circle center={[coords.lat, coords.lon]}
                            radius={wx.wind_speed > 18 ? 5000 : wx.wind_speed > 12 ? 3000 : 2000}
                            pathOptions={{
                                color: 'transparent',
                                fillColor: wx.flight_status === 'NO_GO' ? '#ef4444' : wx.flight_status === 'CAUTION' ? '#f59e0b' : '#10b981',
                                fillOpacity: 0.15,
                            }} />
                    </MapContainer>
                </div>
                {/* Map overlay */}
                <div className="absolute bottom-4 left-4 z-[1000] bg-slate-950/90 backdrop-blur border border-slate-700 px-4 py-2 rounded-xl">
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Radius</p>
                    <p className="text-emerald-400 text-xs font-mono font-bold">
                        {wx.wind_speed > 18 ? '5 km' : wx.wind_speed > 12 ? '3 km' : '2 km'} safety buffer
                    </p>
                </div>
                <div className="absolute bottom-4 right-4 z-[1000] bg-slate-950/90 backdrop-blur border border-slate-700 px-4 py-2 rounded-xl">
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Conditions</p>
                    <p className="text-amber-400 font-mono font-bold text-sm">{wx.temperature}°F — {wmoToLabel(wx.weather_code)}</p>
                </div>
            </div>

            {/* ── Primary Metrics Grid ───────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                <Tile icon="🌡️" label="Temperature"   value={`${wx.temperature}°F`}       sub={`Feels ${wx.feels_like}°F`}              accent="text-rose-400" />
                <Tile icon="💧" label="Humidity"       value={`${wx.humidity}%`}            sub={`Dew point ${wx.dew_point}°F`}           accent="text-blue-400" />
                <Tile icon="💨" label="Wind Speed"     value={`${wx.wind_speed} mph`}       sub={`Gusts ${wx.wind_gusts} mph`}            accent={wx.wind_speed > 22 ? 'text-red-400' : wx.wind_speed > 15 ? 'text-amber-400' : 'text-cyan-400'} warn={wx.wind_speed > 22} />
                <Tile icon="🧭" label="Wind Direction" value={wx.wind_direction}             sub={`Bearing ${wx.wind_bearing}°`}           accent="text-cyan-300" />
                <Tile icon="☁️" label="Cloud Cover"   value={`${wx.cloud_cover}%`}          sub={wx.cloud_cover > 85 ? 'Heavy overcast' : wx.cloud_cover > 50 ? 'Mostly cloudy' : 'Clear to partly cloudy'} accent="text-slate-300" />
                <Tile icon="👁️" label="Visibility"    value={`${wx.visibility_mi} mi`}      sub={wx.visibility_mi < 3 ? '⚠ Below FAA min' : wx.visibility_mi < 5 ? 'Reduced' : 'Good visibility'}          accent={wx.visibility_mi < 3 ? 'text-red-400' : wx.visibility_mi < 5 ? 'text-amber-400' : 'text-emerald-400'} warn={wx.visibility_mi < 3} />
                <Tile icon="🌧️" label="Precipitation"  value={`${wx.precipitation} mm`}     sub={wx.precipitation > 0 ? '⚠ Active — no-fly'  : 'None active'}                                              accent={wx.precipitation > 0 ? 'text-red-400' : 'text-slate-300'} warn={wx.precipitation > 0} />
                <Tile icon="☀️" label="UV Index"       value={`${wx.uv_index}`}             sub={uv.label}                                accent={uv.cls} />
                <Tile icon="🧭" label="Pressure"       value={`${wx.pressure_hpa}`}         sub="hPa"                                     accent="text-violet-400" />
                <Tile icon="⚡" label="Solar Radiation" value={`${wx.solar_radiation}`}     sub="W/m²"                                     accent="text-yellow-400" />
                <Tile icon="🌤️" label="Sky Condition"  value={wmoToEmoji(wx.weather_code)}  sub={wmoToLabel(wx.weather_code)}             accent="text-slate-200" />
                <Tile icon="💦" label="Dew Point"      value={`${wx.dew_point}°F`}          sub={`RH ${wx.humidity}%`}                    accent="text-sky-400" />
            </div>

            {/* ── Wind Compass + Hourly row ──────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Wind compass card */}
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">🧭 Wind Direction</p>
                    <WindCompass bearing={wx.wind_bearing} speed={wx.wind_speed} />
                    <div className="text-center">
                        <p className="text-lg font-black font-mono text-cyan-400">{wx.wind_speed} mph {wx.wind_direction}</p>
                        <p className="text-[10px] text-slate-500">Gusting {wx.wind_gusts} mph</p>
                    </div>
                </div>

                {/* 6-hour forecast */}
                <div className="md:col-span-2 bg-slate-900/80 border border-slate-700/60 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                        <Clock size={10} className="inline mr-1.5" />6-Hour Forecast
                    </p>
                    {hourly.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {hourly.map((h, i) => (
                                <div key={i} className={`rounded-xl p-2 text-center border ${
                                    h.precip_prob > 50 ? 'border-blue-700/40 bg-blue-950/30' :
                                    h.wind > 20        ? 'border-amber-700/40 bg-amber-950/20' :
                                                         'border-slate-700/40 bg-slate-800/50'
                                }`}>
                                    <p className="text-[9px] text-slate-500 font-bold">
                                        {new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}
                                    </p>
                                    <p className="text-xl my-1">{wmoToEmoji(h.code)}</p>
                                    <p className="text-sm font-black font-mono text-white">{h.temp}°</p>
                                    <p className="text-[9px] text-cyan-400 font-bold mt-0.5">💨 {h.wind}</p>
                                    {h.precip_prob > 0 && (
                                        <p className="text-[9px] text-sky-400 font-bold">🌧 {h.precip_prob}%</p>
                                    )}
                                    <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-400 rounded-full" style={{ width: `${h.cloud}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-xs text-center py-6">Hourly forecast unavailable</p>
                    )}
                </div>
            </div>

            {/* ── FAA Reference ──────────────────────────────────────────── */}
            <div className="bg-slate-900/50 border border-slate-700/40 rounded-2xl p-5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">📋 FAA Part 107 Flight Limits (Reference)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    {[
                        { label: 'Max Wind Speed', limit: '≤ 23 mph', current: `${wx.wind_speed} mph`, ok: wx.wind_speed <= 23 },
                        { label: 'Max Altitude',   limit: '400 ft AGL', current: '—', ok: true },
                        { label: 'Visibility Min', limit: '≥ 3 statute mi', current: `${wx.visibility_mi} mi`, ok: wx.visibility_mi >= 3 },
                        { label: 'Precipitation',  limit: 'None allowed', current: wx.precipitation > 0 ? 'Active' : 'None', ok: wx.precipitation === 0 },
                    ].map((r, i) => (
                        <div key={i} className={`rounded-xl p-3 border ${r.ok ? 'border-emerald-700/30 bg-emerald-950/20' : 'border-red-700/40 bg-red-950/30'}`}>
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{r.label}</p>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">{r.limit}</p>
                            <p className={`text-sm font-black font-mono mt-1 ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                {r.ok ? '✓' : '✗'} {r.current}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Dual-source breakdown ───────────────────────────────────── */}
            <div className="bg-slate-900/50 border border-slate-700/40 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Database size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Dual-Source Data</span>
                    <span className="ml-auto text-[10px] text-slate-500 italic">Primary = Open-Meteo</span>
                </div>
                {/* Open-Meteo row */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
                    <span className="text-xs font-bold text-cyan-400">Open-Meteo</span>
                    <span className="text-[11px] text-slate-300 font-mono">
                        {wx.temperature}°F · {wx.wind_speed} mph {wx.wind_direction} · {wx.humidity}% RH · {wx.cloud_cover}% cloud · Vis {wx.visibility_mi} mi · UV {wx.uv_index} · {wx.pressure_hpa} hPa
                    </span>
                </div>
                {wttrRow && (
                    <div className={`flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 ${wttrRow.text === 'source unavailable' ? 'opacity-40' : ''}`}>
                        <span className={`text-xs font-bold ${wttrRow.color}`}>{wttrRow.label}</span>
                        <span className={`text-[11px] font-mono ${wttrRow.text === 'source unavailable' ? 'text-slate-600 italic' : 'text-slate-300'}`}>
                            {wttrRow.text}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
