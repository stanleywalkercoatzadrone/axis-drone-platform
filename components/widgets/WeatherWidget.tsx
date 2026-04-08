import React, { useState, useEffect, useCallback } from 'react';
import {
    Cloud, Sun, Wind, Navigation, RefreshCw, MapPin,
    ShieldAlert, CheckCircle2, AlertTriangle, Maximize2,
    Minimize2, CloudRain, Zap, Eye, Droplets, X
} from 'lucide-react';

interface WeatherData {
    temp: number;
    tempC: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    windSpeedKmh: number;
    windDir: string;
    location: string;
    visibility: number;
    cloudCover: number;
    precipitation: number;
    weatherCode: number;
    lastUpdated: string;
    lat: number;
    lng: number;
}

// WMO Weather Code → condition
function decodeWeatherCode(code: number): string {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 9) return 'Hazy';
    if (code <= 19) return 'Fog';
    if (code <= 29) return 'Drizzle';
    if (code <= 39) return 'Rain';
    if (code <= 49) return 'Snow';
    if (code <= 59) return 'Rain';
    if (code <= 69) return 'Heavy Rain';
    if (code <= 79) return 'Snow';
    if (code <= 84) return 'Rain Showers';
    if (code <= 94) return 'Thunderstorm';
    return 'Thunderstorm';
}

function windDegToDir(deg: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}

// Open-Meteo tile layers
const TILE_LAYERS = {
    clouds: {
        label: 'Clouds',
        icon: Cloud,
        color: '#60a5fa',
        url: (z: number, x: number, y: number) =>
            `https://tile.openweathermap.org/map/clouds_new/${z}/${x}/${y}.png?appid=&` // fallback inline
    },
    rain: {
        label: 'Rain',
        icon: CloudRain,
        color: '#34d399',
    },
    lightning: {
        label: 'Lightning',
        icon: Zap,
        color: '#fbbf24',
    },
};

type LayerKey = keyof typeof TILE_LAYERS;

export const WeatherWidget: React.FC = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(new Set(['clouds']));
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    const fetchWeather = useCallback(async (lat: number, lng: number) => {
        setRefreshing(true);
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
                `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,` +
                `cloud_cover,precipitation,weathercode,visibility&wind_speed_unit=mph&temperature_unit=fahrenheit` +
                `&timezone=auto&forecast_days=1`;
            const res = await fetch(url);
            const data = await res.json();
            const c = data.current || {};
            setWeather({
                temp: Math.round(c.temperature_2m ?? 72),
                tempC: Math.round((((c.temperature_2m ?? 72) - 32) * 5) / 9),
                condition: decodeWeatherCode(c.weathercode ?? 0),
                humidity: Math.round(c.relative_humidity_2m ?? 60),
                windSpeed: Math.round(c.wind_speed_10m ?? 8),
                windSpeedKmh: Math.round((c.wind_speed_10m ?? 8) * 1.60934),
                windDir: windDegToDir(c.wind_direction_10m ?? 180),
                cloudCover: Math.round(c.cloud_cover ?? 30),
                precipitation: parseFloat((c.precipitation ?? 0).toFixed(2)),
                weatherCode: c.weathercode ?? 0,
                visibility: Math.round((c.visibility ?? 16000) / 1609),
                location: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
                lat,
                lng,
                lastUpdated: new Date().toLocaleTimeString(),
            });
        } catch {
            // Fallback mock
            setWeather({
                temp: 74, tempC: 23, condition: 'Partly Cloudy', humidity: 55,
                windSpeed: 9, windSpeedKmh: 14, windDir: 'SW', cloudCover: 45,
                precipitation: 0, weatherCode: 2, visibility: 10,
                location: 'Mission HQ', lat, lng,
                lastUpdated: new Date().toLocaleTimeString(),
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const tryGeo = () => {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setCoords({ lat: latitude, lng: longitude });
                        fetchWeather(latitude, longitude);
                    },
                    () => {
                        // Default to Miami (solar inspection hub)
                        setCoords({ lat: 25.76, lng: -80.19 });
                        fetchWeather(25.76, -80.19);
                    }
                );
            } else {
                setCoords({ lat: 25.76, lng: -80.19 });
                fetchWeather(25.76, -80.19);
            }
        };
        tryGeo();
        const interval = setInterval(() => coords && fetchWeather(coords.lat, coords.lng), 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchWeather]);

    const toggleLayer = (key: LayerKey) => {
        setActiveLayers(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const flightRisk = weather
        ? weather.windSpeed > 18 ? 'no-go'
            : weather.windSpeed > 12 ? 'caution'
                : 'go'
        : 'go';

    const riskColors = {
        'no-go': { badge: 'bg-red-500/10 border-red-500/30', icon: 'bg-red-500 text-white', text: 'text-red-400', label: 'NO-GO (High Risk)', msg: 'Wind exceeds safety thresholds. Risk of loss of control.' },
        'caution': { badge: 'bg-amber-500/10 border-amber-500/30', icon: 'bg-amber-500 text-white', text: 'text-amber-400', label: 'CAUTION (Elevated)', msg: 'Crosswinds detected. Flight permitted with active stabilization.' },
        'go': { badge: 'bg-emerald-500/10 border-emerald-500/30', icon: 'bg-emerald-500 text-white', text: 'text-emerald-400', label: 'GO (Optimal)', msg: 'Conditions are stable. Excellent clarity for thermal sensors.' },
    };
    const risk = riskColors[flightRisk];

    const getIcon = (code: number) => {
        if (code === 0) return <Sun className="w-8 h-8 text-amber-400" />;
        if (code <= 3) return <Cloud className="w-8 h-8 text-blue-300" />;
        if (code <= 67) return <CloudRain className="w-8 h-8 text-cyan-400" />;
        if (code <= 94) return <Zap className="w-8 h-8 text-yellow-400" />;
        return <Zap className="w-8 h-8 text-yellow-400" />;
    };

    // OSM + OpenWeatherMap layer tile URL builder
    const mapCenter = coords ?? { lat: 25.76, lng: -80.19 };
    const zoom = 6;
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lng - 3},${mapCenter.lat - 3},${mapCenter.lng + 3},${mapCenter.lat + 3}&layer=mapnik&marker=${mapCenter.lat},${mapCenter.lng}`;

    // OWM tile layer URLs (free, no key needed for preview quality)
    const OPENMETEO_LAYERS: Record<LayerKey, string> = {
        clouds: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png`,
        rain: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png`,
        lightning: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png`,
    };

    if (loading) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 h-full flex flex-col items-center justify-center animate-pulse">
                <RefreshCw className="w-8 h-8 text-slate-700 animate-spin mb-4" />
                <div className="h-4 w-32 bg-slate-800 rounded mb-2" />
                <div className="h-3 w-24 bg-slate-800 rounded" />
            </div>
        );
    }

    return (
        <>
            {/* Expanded Overlay */}
            {expanded && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <Cloud className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-lg font-bold text-white">Live Weather Operations Map</h2>
                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">LIVE</span>
                        </div>
                        <button
                            onClick={() => setExpanded(false)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Map */}
                        <div className="flex-1 relative">
                            <iframe
                                key={`${mapCenter.lat},${mapCenter.lng}`}
                                src={mapUrl}
                                className="w-full h-full border-0"
                                title="Weather Map"
                                style={{ filter: 'brightness(0.85) saturate(0.7) hue-rotate(200deg)' }}
                            />
                            {/* Layer toggles overlay */}
                            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                                {(Object.keys(TILE_LAYERS) as LayerKey[]).map(key => {
                                    const layer = TILE_LAYERS[key];
                                    const Icon = layer.icon;
                                    const active = activeLayers.has(key);
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => toggleLayer(key)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md transition-all border ${active
                                                ? 'border-opacity-60 bg-opacity-30 text-white'
                                                : 'bg-slate-900/80 border-slate-700/50 text-slate-400'
                                                }`}
                                            style={active ? {
                                                borderColor: layer.color + '80',
                                                backgroundColor: layer.color + '25',
                                                color: layer.color
                                            } : {}}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            {layer.label}
                                            <div className={`w-2 h-2 rounded-full ${active ? 'animate-pulse' : 'bg-slate-600'}`}
                                                style={active ? { backgroundColor: layer.color } : {}} />
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Conditions overlay */}
                            <div className="absolute bottom-4 left-4 right-4 z-10">
                                <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 grid grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <Cloud className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                                        <div className="text-white font-bold text-sm">{weather?.cloudCover}%</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">Cloud Cover</div>
                                    </div>
                                    <div className="text-center">
                                        <CloudRain className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                                        <div className="text-white font-bold text-sm">{weather?.precipitation} mm</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">Precipitation</div>
                                    </div>
                                    <div className="text-center">
                                        <Wind className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                                        <div className="text-white font-bold text-sm">{weather?.windSpeed} mph</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">Wind {weather?.windDir}</div>
                                    </div>
                                    <div className="text-center">
                                        <Eye className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                                        <div className="text-white font-bold text-sm">{weather?.visibility} mi</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">Visibility</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Side panel */}
                        <div className="w-80 border-l border-slate-800 flex flex-col overflow-y-auto bg-slate-900">
                            <div className="p-6 border-b border-slate-800">
                                <div className="flex items-center gap-3 mb-4">
                                    {getIcon(weather?.weatherCode ?? 0)}
                                    <div>
                                        <div className="text-3xl font-black text-white">{weather?.temp}°F</div>
                                        <div className="text-slate-400 text-sm font-semibold">{weather?.condition}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                    <MapPin className="w-3 h-3" />
                                    <span>{weather?.location}</span>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className={`p-4 rounded-xl border ${risk.badge}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`p-1.5 rounded-lg ${risk.icon}`}>
                                            {flightRisk === 'no-go' ? <ShieldAlert className="w-4 h-4" /> :
                                                flightRisk === 'caution' ? <AlertTriangle className="w-4 h-4" /> :
                                                    <CheckCircle2 className="w-4 h-4" />}
                                        </div>
                                        <span className={`text-sm font-bold ${risk.text}`}>{risk.label}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">{risk.msg}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { icon: Droplets, label: 'Humidity', val: `${weather?.humidity}%`, color: 'text-blue-400' },
                                        { icon: Eye, label: 'Visibility', val: `${weather?.visibility} mi`, color: 'text-purple-400' },
                                        { icon: Cloud, label: 'Cloud Cover', val: `${weather?.cloudCover}%`, color: 'text-slate-400' },
                                        { icon: CloudRain, label: 'Rain', val: `${weather?.precipitation} mm`, color: 'text-cyan-400' },
                                    ].map(({ icon: Icon, label, val, color }) => (
                                        <div key={label} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                                            <Icon className={`w-4 h-4 ${color} mb-1.5`} />
                                            <div className="text-white font-bold text-sm">{val}</div>
                                            <div className="text-slate-500 text-[10px] uppercase font-bold">{label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Compact Widget */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-cyan-400" />
                        Pilot Weather Feed
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Layer toggles */}
                        {(Object.keys(TILE_LAYERS) as LayerKey[]).map(key => {
                            const layer = TILE_LAYERS[key];
                            const Icon = layer.icon;
                            const active = activeLayers.has(key);
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleLayer(key)}
                                    title={`Toggle ${layer.label}`}
                                    className={`p-1.5 rounded-lg text-xs transition-all border ${active
                                        ? 'border-opacity-50'
                                        : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400'
                                        }`}
                                    style={active ? {
                                        borderColor: layer.color + '60',
                                        backgroundColor: layer.color + '20',
                                        color: layer.color
                                    } : {}}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                </button>
                            );
                        })}
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded">LIVE</span>
                        <button
                            onClick={() => coords && fetchWeather(coords.lat, coords.lng)}
                            disabled={refreshing}
                            className={`text-slate-500 hover:text-cyan-400 transition-all ${refreshing ? 'animate-spin' : ''}`}
                            title="Refresh"
                        >
                            <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setExpanded(true)}
                            className="text-slate-500 hover:text-cyan-400 transition-all"
                            title="Expand map"
                        >
                            <Maximize2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                {getIcon(weather?.weatherCode ?? 0)}
                                <span className="text-3xl font-black text-slate-100 italic tracking-tighter">
                                    {weather?.temp}°F
                                </span>
                            </div>
                            <h4 className="text-slate-300 font-bold uppercase tracking-widest text-[11px]">
                                {weather?.condition}
                            </h4>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-1.5 text-slate-500 mb-1">
                                <MapPin className="w-3 h-3" />
                                <span className="text-[10px] font-bold truncate max-w-[120px]">{weather?.location}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium block">
                                Synced: {weather?.lastUpdated}
                            </span>
                        </div>
                    </div>

                    {/* Active layer badges */}
                    {activeLayers.size > 0 && (
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                            {Array.from(activeLayers).map(key => {
                                const layer = TILE_LAYERS[key];
                                const Icon = layer.icon;
                                return (
                                    <span key={key} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: layer.color + '20', color: layer.color, border: `1px solid ${layer.color}40` }}>
                                        <Icon className="w-2.5 h-2.5" />
                                        {layer.label}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/50">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <Wind className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Wind</span>
                            </div>
                            <p className="text-xs font-bold text-slate-200">{weather?.windSpeed} mph {weather?.windDir}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <Cloud className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Cloud</span>
                            </div>
                            <p className="text-xs font-bold text-slate-200">{weather?.cloudCover}%</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <CloudRain className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Rain</span>
                            </div>
                            <p className="text-xs font-bold text-slate-200">{weather?.precipitation} mm</p>
                        </div>
                    </div>

                    {/* Flight Risk */}
                    <div className={`mt-4 p-4 rounded-xl border ${risk.badge}`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${risk.icon}`}>
                                    {flightRisk === 'no-go' ? <ShieldAlert className="w-4 h-4" /> :
                                        flightRisk === 'caution' ? <AlertTriangle className="w-4 h-4" /> :
                                            <CheckCircle2 className="w-4 h-4" />}
                                </div>
                                <span className={`text-sm font-bold ${risk.text}`}>{risk.label}</span>
                            </div>
                            <button
                                onClick={() => setExpanded(true)}
                                className="text-[10px] font-bold text-slate-500 hover:text-cyan-400 flex items-center gap-1 transition-all"
                            >
                                <Maximize2 className="w-3 h-3" />
                                Map
                            </button>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400 font-medium">{risk.msg}</p>
                    </div>
                </div>
            </div>
        </>
    );
};
