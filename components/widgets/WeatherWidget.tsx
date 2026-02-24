import React, { useState, useEffect } from 'react';
import { Cloud, Sun, Wind, Droplets, Thermometer, Navigation, RefreshCw, MapPin, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Text, Heading } from '../../stitch/components/Typography';
import { useMission } from '../../context/MissionContext';
import { useAuth } from '../../context/AuthContext';
import { isPilot } from '../../utils/roleUtils';

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

const SITE_COORDINATES: Record<string, { lat: number, lon: number, town: string }> = {
    'West Field Solar Array': { lat: 35.86, lon: -114.83, town: 'Boulder City, NV' },
    'North Tower Cluster': { lat: 47.60, lon: -122.33, town: 'Seattle, WA' },
    'Downtown Commercial Properties': { lat: 37.77, lon: -122.41, town: 'San Francisco, CA' },
    'Grid Station Alpha': { lat: 29.76, lon: -95.36, town: 'Houston, TX' },
    'Nevada Solar One': { lat: 35.80, lon: -114.94, town: 'Boulder City, NV' },
    'Project Helios': { lat: 33.44, lon: -112.07, town: 'Phoenix, AZ' }
};

export const WeatherWidget: React.FC = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const mission = useMission();
    const { user } = useAuth();

    const fetchWeather = async (lat?: number, lon?: number, siteName?: string) => {
        setRefreshing(true);

        let targetLat = lat;
        let targetLon = lon;
        let town = siteName || 'Mission HQ';

        if (siteName && SITE_COORDINATES[siteName]) {
            targetLat = SITE_COORDINATES[siteName].lat;
            targetLon = SITE_COORDINATES[siteName].lon;
            town = SITE_COORDINATES[siteName].town;
        }

        setTimeout(() => {
            setWeather({
                temp: Math.floor(Math.random() * (85 - 65 + 1)) + 65,
                condition: ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain'][Math.floor(Math.random() * 4)],
                humidity: Math.floor(Math.random() * (70 - 40 + 1)) + 40,
                windSpeed: Math.floor(Math.random() * (22 - 2 + 1)) + 2, // Wider range for risk demo
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
        if (mission.site) {
            fetchWeather(undefined, undefined, mission.site);
        } else if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    fetchWeather(position.coords.latitude, position.coords.longitude);
                },
                () => {
                    fetchWeather(); // Fallback to default
                }
            );
        } else {
            fetchWeather();
        }

        // Automatic update every 15 minutes
        const interval = setInterval(() => {
            fetchWeather(undefined, undefined, mission.site);
        }, 15 * 60 * 1000);

        return () => clearInterval(interval);
    }, [mission.site]);

    if (loading) {
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 h-full flex flex-col items-center justify-center animate-pulse">
                <RefreshCw className="w-8 h-8 text-slate-700 animate-spin mb-4" />
                <div className="h-4 w-32 bg-slate-800 rounded mb-2"></div>
                <div className="h-3 w-24 bg-slate-800 rounded"></div>
            </div>
        );
    }

    const getWeatherIcon = (condition: string) => {
        switch (condition) {
            case 'Clear': return <Sun className="w-8 h-8 text-amber-400" />;
            case 'Partly Cloudy': return <Cloud className="w-8 h-8 text-blue-400" />;
            case 'Overcast': return <Cloud className="w-8 h-8 text-slate-400" />;
            case 'Light Rain': return <Droplets className="w-8 h-8 text-cyan-400" />;
            default: return <Sun className="w-8 h-8 text-amber-400" />;
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm flex flex-col h-full group">
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
                        <Heading level={4} className="text-slate-300 font-bold uppercase tracking-widest text-[11px]">
                            {weather?.condition}
                        </Heading>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-500 mb-1">
                            <MapPin className="w-3 h-3" />
                            <span className="text-[10px] font-bold truncate max-w-[120px]">{weather?.location}</span>
                        </div>
                        <Text variant="small" className="text-[10px] text-slate-500 font-medium">
                            Synced: {weather?.lastUpdated}
                        </Text>
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
                <div className={`mt-6 p-4 rounded-xl border transition-all duration-500 ${weather && weather.windSpeed > 18 ? 'bg-red-500/10 border-red-500/30' :
                    weather && weather.windSpeed > 12 ? 'bg-amber-500/10 border-amber-500/30' :
                        'bg-emerald-500/10 border-emerald-500/30'
                    }`}>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${weather && weather.windSpeed > 18 ? 'bg-red-500 text-white' :
                                    weather && weather.windSpeed > 12 ? 'bg-amber-500 text-white' :
                                        'bg-emerald-500 text-white'
                                    }`}>
                                    {weather && weather.windSpeed > 18 ? <ShieldAlert className="w-4 h-4" /> :
                                        weather && weather.windSpeed > 12 ? <AlertTriangle className="w-4 h-4" /> :
                                            <CheckCircle2 className="w-4 h-4" />
                                    }
                                </div>
                                <div>
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none">AI Risk Index</Text>
                                    <Heading level={6} className={`text-sm font-bold tracking-tight ${weather && weather.windSpeed > 18 ? 'text-red-400' :
                                        weather && weather.windSpeed > 12 ? 'text-amber-400' :
                                            'text-emerald-400'
                                        }`}>
                                        {weather && weather.windSpeed > 18 ? 'NO-GO (High Risk)' :
                                            weather && weather.windSpeed > 12 ? 'CAUTION (Elevated)' :
                                                'GO (Optimal)'
                                        }
                                    </Heading>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">GEMINI 2.0</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                            {weather && weather.windSpeed > 18 ? 'Wind exceeds safety thresholds for steady flight. Risk of loss of control is high.' :
                                weather && weather.windSpeed > 12 ? 'Crosswinds detected. Flight permitted with stabilization active. Monitor battery drain.' :
                                    'Atmospheric conditions are stable. Clarity is excellent for thermal sensors.'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
