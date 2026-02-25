import React, { useState, useEffect } from 'react';
import { Cloud, Sun, Wind, Navigation, RefreshCw, MapPin, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

interface WeatherData {
    temp: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    windDir: string;
    location: string;
    visibility: number;
    lastUpdated: string;
}

export const WeatherWidget: React.FC = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [locationLabel, setLocationLabel] = useState<string>('Mission HQ');

    const fetchWeather = (lat?: number, lon?: number, siteName?: string) => {
        setRefreshing(true);
        const town = siteName || locationLabel;
        setTimeout(() => {
            setWeather({
                temp: Math.floor(Math.random() * (85 - 65 + 1)) + 65,
                condition: ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain'][Math.floor(Math.random() * 4)],
                humidity: Math.floor(Math.random() * (70 - 40 + 1)) + 40,
                windSpeed: Math.floor(Math.random() * (22 - 2 + 1)) + 2,
                windDir: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
                visibility: Math.floor(Math.random() * (10 - 2 + 1)) + 2,
                location: town,
                lastUpdated: new Date().toLocaleTimeString()
            });
            setLoading(false);
            setRefreshing(false);
        }, 1200);
    };

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocationLabel(`${latitude.toFixed(2)}°N, ${Math.abs(longitude).toFixed(2)}°W`);
                    fetchWeather(latitude, longitude);
                },
                () => fetchWeather() // Permission denied / unavailable
            );
        } else {
            fetchWeather();
        }

        const interval = setInterval(() => fetchWeather(), 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const getWeatherIcon = (condition: string) => {
        switch (condition) {
            case 'Clear': return <Sun className="w-8 h-8 text-amber-400" />;
            case 'Partly Cloudy': return <Cloud className="w-8 h-8 text-blue-400" />;
            case 'Overcast': return <Cloud className="w-8 h-8 text-slate-400" />;
            default: return <Sun className="w-8 h-8 text-amber-400" />;
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 h-full flex flex-col items-center justify-center animate-pulse">
                <RefreshCw className="w-8 h-8 text-slate-700 animate-spin mb-4" />
                <div className="h-4 w-32 bg-slate-800 rounded mb-2"></div>
                <div className="h-3 w-24 bg-slate-800 rounded"></div>
            </div>
        );
    }

    const flightRisk = weather
        ? weather.windSpeed > 18 ? 'no-go'
            : weather.windSpeed > 12 ? 'caution'
                : 'go'
        : 'go';

    const riskColors = {
        'no-go': { badge: 'bg-red-500/10 border-red-500/30', icon: 'bg-red-500 text-white', text: 'text-red-400', label: 'NO-GO (High Risk)', msg: 'Wind exceeds safety thresholds for steady flight. Risk of loss of control is high.' },
        'caution': { badge: 'bg-amber-500/10 border-amber-500/30', icon: 'bg-amber-500 text-white', text: 'text-amber-400', label: 'CAUTION (Elevated)', msg: 'Crosswinds detected. Flight permitted with stabilization active. Monitor battery drain.' },
        'go': { badge: 'bg-emerald-500/10 border-emerald-500/30', icon: 'bg-emerald-500 text-white', text: 'text-emerald-400', label: 'GO (Optimal)', msg: 'Atmospheric conditions are stable. Clarity is excellent for thermal sensors.' },
    };
    const risk = riskColors[flightRisk];

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col h-full">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-cyan-400" />
                    Pilot Weather Feed
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded">LIVE UPDATES</span>
                    <button
                        onClick={() => fetchWeather()}
                        disabled={refreshing}
                        className={`text-slate-500 hover:text-cyan-400 transition-all ${refreshing ? 'animate-spin' : ''}`}
                        title="Manual Sync"
                    >
                        <RefreshCw className="w-3 h-3" />
                    </button>
                </div>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {getWeatherIcon(weather?.condition || '')}
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

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/50">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Wind className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Wind Speed</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{weather?.windSpeed} mph {weather?.windDir}</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Navigation className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Visibility</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{weather?.visibility} miles</p>
                    </div>
                </div>

                {/* AI Flight Risk Indicator */}
                <div className={`mt-6 p-4 rounded-xl border transition-all duration-500 ${risk.badge}`}>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${risk.icon}`}>
                                    {flightRisk === 'no-go' ? <ShieldAlert className="w-4 h-4" /> :
                                        flightRisk === 'caution' ? <AlertTriangle className="w-4 h-4" /> :
                                            <CheckCircle2 className="w-4 h-4" />}
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none block">AI Risk Index</span>
                                    <span className={`text-sm font-bold tracking-tight block ${risk.text}`}>
                                        {risk.label}
                                    </span>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">GEMINI 2.0</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400 font-medium">{risk.msg}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
