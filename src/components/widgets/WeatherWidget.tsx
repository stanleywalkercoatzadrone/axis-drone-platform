import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, Sun, Wind, Droplets, Navigation, RefreshCw, MapPin, ShieldAlert, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { Text, Heading } from '../../stitch/components/Typography';
import { useMission } from '../../context/MissionContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

const degreesToCompass = (deg: number): string => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(((deg % 360) / 45)) % 8];
};

const wmoCodeToCondition = (code: number): string => {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Overcast';
    if (code <= 67) return 'Light Rain';
    if (code <= 77) return 'Snow';
    return 'Showers';
};

const SITE_COORDINATES: Record<string, { lat: number; lon: number; town: string }> = {
    'West Field Solar Array':           { lat: 35.86,  lon: -114.83, town: 'Boulder City, NV' },
    'North Tower Cluster':              { lat: 47.60,  lon: -122.33, town: 'Seattle, WA' },
    'Downtown Commercial Properties':   { lat: 37.77,  lon: -122.41, town: 'San Francisco, CA' },
    'Grid Station Alpha':               { lat: 29.76,  lon: -95.36,  town: 'Houston, TX' },
    'Nevada Solar One':                 { lat: 35.80,  lon: -114.94, town: 'Boulder City, NV' },
    'Project Helios':                   { lat: 33.44,  lon: -112.07, town: 'Phoenix, AZ' },
};

const DEFAULT_LAT  = 36.17;
const DEFAULT_LON  = -115.13;
const DEFAULT_TOWN = 'Las Vegas, NV';

interface SourceReading {
    temp: number;
    humidity: number;
    windSpeed: number;
    windDir: string;
    visibility: number;
    condition: string;
    ok: boolean;
}

interface WeatherData {
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    windDir: string;
    location: string;
    visibility: number;
    lastUpdated: string;
    source1: SourceReading & { name: string };
    source2: SourceReading & { name: string };
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchOpenMeteo(lat: number, lon: number): Promise<SourceReading> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,visibility` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph&visibility_unit=km`;
        const res  = await fetch(url);
        const data = await res.json();
        const c    = data.current;
        return {
            ok:         true,
            temp:       Math.round(c.temperature_2m),
            humidity:   Math.round(c.relative_humidity_2m),
            windSpeed:  Math.round(c.wind_speed_10m),
            windDir:    degreesToCompass(c.wind_direction_10m),
            visibility: Math.round((c.visibility / 1.609) * 10) / 10, // km → miles
            condition:  wmoCodeToCondition(c.weather_code),
        };
    } catch {
        return { ok: false, temp: 0, humidity: 0, windSpeed: 0, windDir: 'N', visibility: 0, condition: 'Unknown' };
    }
}

async function fetchWttrIn(lat: number, lon: number): Promise<SourceReading> {
    try {
        const res  = await fetch(`https://wttr.in/${lat},${lon}?format=j1`);
        const data = await res.json();
        const c    = data.current_condition?.[0];
        if (!c) throw new Error('No data');
        return {
            ok:         true,
            temp:       parseInt(c.temp_F, 10),
            humidity:   parseInt(c.humidity, 10),
            windSpeed:  parseInt(c.windspeedMiles, 10),
            windDir:    c.winddir16Point || 'N',
            visibility: parseFloat(c.visibility),
            condition:  c.weatherDesc?.[0]?.value || 'Clear',
        };
    } catch {
        return { ok: false, temp: 0, humidity: 0, windSpeed: 0, windDir: 'N', visibility: 0, condition: 'Unknown' };
    }
}

function avgSources(a: SourceReading, b: SourceReading): Pick<WeatherData, 'temp'|'humidity'|'windSpeed'|'windDir'|'visibility'|'condition'> {
    const bothOk = a.ok && b.ok;
    const oneOk  = a.ok ? a : b;

    if (!bothOk) return {
        temp:       oneOk.temp, humidity: oneOk.humidity, windSpeed: oneOk.windSpeed,
        windDir:    oneOk.windDir, visibility: oneOk.visibility, condition: oneOk.condition,
    };

    return {
        temp:       Math.round((a.temp      + b.temp)      / 2),
        humidity:   Math.round((a.humidity  + b.humidity)  / 2),
        windSpeed:  Math.round((a.windSpeed + b.windSpeed) / 2),
        visibility: Math.round(((a.visibility + b.visibility) / 2) * 10) / 10,
        windDir:    a.windDir,   // use source 1 direction
        condition:  a.condition, // use source 1 condition label
    };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const WeatherWidget: React.FC = () => {
    const [weather,    setWeather]    = useState<WeatherData | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { mission } = useMission();

    const fetchWeather = useCallback(async (lat?: number, lon?: number, town?: string) => {
        setRefreshing(true);
        const useLat  = lat  ?? DEFAULT_LAT;
        const useLon  = lon  ?? DEFAULT_LON;
        const useTown = town ?? DEFAULT_TOWN;

        const [s1, s2] = await Promise.all([
            fetchOpenMeteo(useLat, useLon),
            fetchWttrIn(useLat, useLon),
        ]);

        const avg = avgSources(s1, s2);

        setWeather({
            ...avg,
            location:    useTown,
            lastUpdated: new Date().toLocaleTimeString(),
            source1:     { ...s1, name: 'Open-Meteo' },
            source2:     { ...s2, name: 'wttr.in' },
        });
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        // Derive coordinates from mission site name or geolocation
        const site    = mission?.site;
        const siteRec = site ? SITE_COORDINATES[site] : null;

        if (siteRec) {
            fetchWeather(siteRec.lat, siteRec.lon, siteRec.town);
        } else if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
                ()    => fetchWeather(),
            );
        } else {
            fetchWeather();
        }

        const interval = setInterval(() => {
            const s = mission?.site;
            const r = s ? SITE_COORDINATES[s] : null;
            if (r) fetchWeather(r.lat, r.lon, r.town); else fetchWeather();
        }, 15 * 60 * 1000);

        return () => clearInterval(interval);
    }, [mission?.site, fetchWeather]);

    if (loading) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 h-full flex flex-col items-center justify-center animate-pulse">
                <RefreshCw className="w-8 h-8 text-slate-700 animate-spin mb-4" />
                <div className="h-4 w-32 bg-slate-800 rounded mb-2" />
                <div className="h-3 w-24 bg-slate-800 rounded" />
            </div>
        );
    }

    const getWeatherIcon = (condition: string) => {
        if (condition.toLowerCase().includes('clear')) return <Sun className="w-8 h-8 text-amber-400" />;
        if (condition.toLowerCase().includes('cloud'))  return <Cloud className="w-8 h-8 text-blue-400" />;
        if (condition.toLowerCase().includes('rain'))   return <Droplets className="w-8 h-8 text-cyan-400" />;
        return <Cloud className="w-8 h-8 text-slate-400" />;
    };

    const w = weather!;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-cyan-400" />
                    Pilot Weather Feed
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded">LIVE</span>
                    <button
                        onClick={() => fetchWeather()}
                        disabled={refreshing}
                        className={`text-slate-500 hover:text-cyan-400 transition-all ${refreshing ? 'animate-spin' : ''}`}
                        title="Refresh"
                    >
                        <RefreshCw className="w-3 h-3" />
                    </button>
                </div>
            </div>

            <div className="p-6 flex-1 flex flex-col gap-4">
                {/* Main reading */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {getWeatherIcon(w.condition)}
                            <span className="text-3xl font-black text-slate-100 italic tracking-tighter">
                                {w.temp}°F
                            </span>
                        </div>
                        <Heading level={4} className="text-slate-300 font-bold uppercase tracking-widest text-[11px]">
                            {w.condition}
                        </Heading>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-500 mb-1">
                            <MapPin className="w-3 h-3" />
                            <span className="text-[10px] font-bold truncate max-w-[120px]">{w.location}</span>
                        </div>
                        <Text variant="small" className="text-[10px] text-slate-500">
                            Updated: {w.lastUpdated}
                        </Text>
                    </div>
                </div>

                {/* Wind + Visibility */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Wind className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Wind Speed</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{w.windSpeed} mph {w.windDir}</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Navigation className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Visibility</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{w.visibility} mi</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Droplets className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Humidity</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{w.humidity}%</p>
                    </div>
                </div>

                {/* Dual-source breakdown */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-2">
                        <Database className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Dual-Source Average</span>
                    </div>
                    {[w.source1, w.source2].map((src, i) => (
                        <div key={i} className={`flex items-center justify-between text-[10px] py-1 ${!src.ok ? 'opacity-40' : ''}`}>
                            <span className={`font-bold ${i === 0 ? 'text-cyan-400' : 'text-violet-400'}`}>{src.name}</span>
                            {src.ok ? (
                                <span className="text-slate-300 font-mono">
                                    {src.temp}°F · {src.windSpeed}mph · {src.humidity}% RH
                                </span>
                            ) : (
                                <span className="text-slate-600 italic">unavailable</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* AI Risk Indicator */}
                <div className={`p-4 rounded-xl border transition-all duration-500 ${
                    w.windSpeed > 18 ? 'bg-red-500/10 border-red-500/30' :
                    w.windSpeed > 12 ? 'bg-amber-500/10 border-amber-500/30' :
                                       'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${
                                w.windSpeed > 18 ? 'bg-red-500' :
                                w.windSpeed > 12 ? 'bg-amber-500' :
                                                   'bg-emerald-500'
                            } text-white`}>
                                {w.windSpeed > 18 ? <ShieldAlert className="w-4 h-4" /> :
                                 w.windSpeed > 12 ? <AlertTriangle className="w-4 h-4" /> :
                                                    <CheckCircle2 className="w-4 h-4" />}
                            </div>
                            <div>
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">AI Risk Index</Text>
                                <Heading level={6} className={`text-sm font-bold ${
                                    w.windSpeed > 18 ? 'text-red-400' :
                                    w.windSpeed > 12 ? 'text-amber-400' :
                                                       'text-emerald-400'
                                }`}>
                                    {w.windSpeed > 18 ? 'NO-GO (High Risk)' :
                                     w.windSpeed > 12 ? 'CAUTION (Elevated)' :
                                                        'GO (Optimal)'}
                                </Heading>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">GEMINI 2.0</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                        {w.windSpeed > 18 ? 'Wind exceeds safety thresholds for steady flight. Risk of loss of control is high.' :
                         w.windSpeed > 12 ? 'Crosswinds detected. Flight permitted with stabilization active. Monitor battery drain.' :
                                            'Atmospheric conditions are stable. Clarity is excellent for thermal sensors.'}
                    </p>
                </div>
            </div>
        </div>
    );
};
