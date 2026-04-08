/**
 * MissionForecastPanel.tsx
 * Mission Forecasting & Performance Intelligence — Admin View
 * 
 * Displays 14-day forecast timeline, recommended windows, performance analysis,
 * and risk warnings. Admin only. Advisory — no mission mutations.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, TrendingDown, Minus, Calendar, Wind, CloudRain,
    Sun, AlertTriangle, CheckCircle, BarChart3, Sparkles, RefreshCw,
    ChevronRight, Target, Activity, Clock, Shield, MapPin
} from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface ForecastWindow {
    startDate: string;
    endDate: string;
    consecutiveDays: number;
    weatherScore: number;
    irradianceScore: number;
    predictedCompletionRate: number;
    confidenceScore: number;
    recommended: boolean;
}

interface ScoredDay {
    date: string;
    weatherScore: number;
    irradianceScore: number;
    flyable: boolean;
    windMax: number;
    precipSum: number;
    tempMax: number;
    reasons: string[];
}

interface PerformanceData {
    avgVelocity: number;
    avgCompletionRate: number;
    weatherImpactFactor: number;
    irradianceImpactFactor: number;
    delayPatterns: { factor: string; frequency: number; percentage: number }[];
    projectedDailyCapacity: number;
    productivityVariance: number;
    riskTrend: 'improving' | 'declining' | 'stable';
    activeDays: number;
    totalLogs: number;
    dataQuality: 'high' | 'medium' | 'low';
}

interface ForecastData {
    missionId: string;
    generatedAt: string;
    usingDefaultCoords?: boolean;
    locationUsed?: string;
    performance: PerformanceData;
    scoredDays: ScoredDay[];
    recommendedWindows: ForecastWindow[];
    riskWarnings: string[];
    recommendedAction: string;
    forecastSummary: string;
}

const DELAY_LABELS: Record<string, string> = {
    wind: 'Wind', rain: 'Rain', lowVisibility: 'Low Visibility',
    equipmentFailure: 'Equipment Failure', crewShortage: 'Crew Shortage',
    accessIssue: 'Site Access', safetyRestriction: 'Safety Hold',
    clientHold: 'Client Hold', schedulingDelay: 'Scheduling',
    weatherGeneral: 'Weather (General)',
};

const WeatherBar: React.FC<{ score: number }> = ({ score }) => {
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    return (
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${score}%`, background: color }}
            />
        </div>
    );
};

const MissionForecastPanel: React.FC<{ missionId: string; missionTitle?: string }> = ({
    missionId, missionTitle
}) => {
    const [forecast, setForecast] = useState<ForecastData | null>(null);
    const [storedWindows, setStoredWindows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'timeline' | 'performance' | 'delays'>('timeline');

    // Inline coordinate capture state (for setting real coords after seeing default forecast)
    const [coordsNeeded, setCoordsNeeded] = useState(false);
    const [coordLat, setCoordLat] = useState('');
    const [coordLon, setCoordLon] = useState('');
    const [savingCoords, setSavingCoords] = useState(false);
    const [coordError, setCoordError] = useState<string | null>(null);

    const loadStoredData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/forecast/${missionId}`);
            if (res.data.success && res.data.windows.length > 0) {
                setStoredWindows(res.data.windows);
            }
        } catch { /* no forecast yet — normal */ }
        finally { setLoading(false); }
    }, [missionId]);

    useEffect(() => { loadStoredData(); }, [loadStoredData]);

    const browserGeocode = async (text: string): Promise<{ lat: number; lon: number; label: string } | null> => {
        if (!text) return null;
        const searchTerm = text.split(',')[0].trim();
        if (searchTerm.length < 2) return null;
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const r = data.results[0];
                return { lat: r.latitude, lon: r.longitude, label: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}` };
            }
        } catch (e) { /* silent */ }
        return null;
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setCoordsNeeded(false);
        try {
            // Step 1: Fetch mission to get location/siteName/coords
            let overrideLat: number | undefined;
            let overrideLon: number | undefined;

            try {
                const detailRes = await apiClient.get(`/deployments/${missionId}`);
                const mission = detailRes.data?.data || detailRes.data;

                if (mission?.latitude && mission?.longitude) {
                    // Already in DB — server will use them
                    overrideLat = undefined;
                    overrideLon = undefined;
                } else {
                    // Geocode from browser using any available text field
                    const candidates = [mission?.location, mission?.siteName, missionTitle].filter(Boolean) as string[];
                    for (const candidate of candidates) {
                        const geo = await browserGeocode(candidate);
                        if (geo) {
                            overrideLat = geo.lat;
                            overrideLon = geo.lon;
                            break;
                        }
                    }
                }
            } catch (fetchErr) {
                // If mission fetch fails, try geocoding from props
                const geo = missionTitle ? await browserGeocode(missionTitle) : null;
                if (geo) { overrideLat = geo.lat; overrideLon = geo.lon; }
            }

            // Step 2: Call generate with coords in body — server uses them directly
            const body: Record<string, any> = {};
            if (overrideLat !== undefined && overrideLon !== undefined) {
                body.latitude = overrideLat;
                body.longitude = overrideLon;
            }

            const res = await apiClient.post(`/forecast/${missionId}/generate`, body);
            if (res.data.success) {
                setForecast(res.data.forecast);
                setStoredWindows(res.data.forecast.recommendedWindows || []);
            } else {
                throw new Error(res.data.message);
            }
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Forecast generation failed';
            setError(msg);
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveCoordsveCoords = async () => {
        const lat = parseFloat(coordLat);
        const lon = parseFloat(coordLon);
        if (isNaN(lat) || lat < -90 || lat > 90) {
            setCoordError('Latitude must be a number between -90 and 90');
            return;
        }
        if (isNaN(lon) || lon < -180 || lon > 180) {
            setCoordError('Longitude must be a number between -180 and 180');
            return;
        }
        setSavingCoords(true);
        setCoordError(null);
        try {
            await apiClient.put(`/deployments/${missionId}`, { latitude: lat, longitude: lon });
            setCoordsNeeded(false);
            // Auto-retry forecast
            await handleGenerate();
        } catch (e: any) {
            setCoordError(e?.response?.data?.message || e?.message || 'Failed to save coordinates');
        } finally {
            setSavingCoords(false);
        }
    };

    const perf = forecast?.performance;
    const windows = forecast?.recommendedWindows || storedWindows || [];
    const days = forecast?.scoredDays || [];

    const trendIcon = perf?.riskTrend === 'improving'
        ? <TrendingUp className="w-4 h-4 text-emerald-400" />
        : perf?.riskTrend === 'declining'
            ? <TrendingDown className="w-4 h-4 text-red-400" />
            : <Minus className="w-4 h-4 text-amber-400" />;

    const trendColor = perf?.riskTrend === 'improving' ? 'text-emerald-400'
        : perf?.riskTrend === 'declining' ? 'text-red-400' : 'text-amber-400';

    // Format date label
    const fmtDate = (d: string) => {
        const dt = new Date(d + 'T00:00');
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="bg-slate-950 text-white min-h-[500px] p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-violet-400" />
                        </div>
                        <h2 className="text-lg font-black text-white">Mission Forecast</h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                            ADVISORY
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 ml-10">
                        Predictive intelligence only — no automatic scheduling or mission changes
                    </p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-60"
                >
                    {generating
                        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                        : <><Sparkles className="w-3.5 h-3.5" /> Generate Forecast</>
                    }
                </button>
            </div>

            {/* Coordinate capture form — shown when mission has no lat/lon */}
            {coordsNeeded && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-amber-300">Site Coordinates Required</div>
                            <div className="text-xs text-amber-400/70">Enter the GPS coordinates for this mission site to enable weather forecasting</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Latitude</label>
                            <input
                                type="number"
                                step="any"
                                placeholder="e.g. 33.4484"
                                value={coordLat}
                                onChange={e => setCoordLat(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Longitude</label>
                            <input
                                type="number"
                                step="any"
                                placeholder="e.g. -112.0740"
                                value={coordLon}
                                onChange={e => setCoordLon(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                            />
                        </div>
                    </div>
                    {coordError && (
                        <p className="text-xs text-red-400">{coordError}</p>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSaveCoords}
                            disabled={savingCoords || !coordLat || !coordLon}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 transition-all disabled:opacity-50"
                        >
                            {savingCoords ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><MapPin className="w-3.5 h-3.5" /> Save & Generate Forecast</>}
                        </button>
                        <a
                            href="https://maps.google.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-500 hover:text-slate-300 underline"
                        >
                            Find coordinates on Google Maps ↗
                        </a>
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Advisory disclaimer */}
            <div className="flex items-start gap-2 bg-amber-400/5 border border-amber-400/20 rounded-xl p-3">
                <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/80">
                    This forecast is <strong>advisory only</strong>. It does not auto-reschedule missions,
                    assign pilots, change mission status, or trigger billing. All decisions require admin approval.
                </p>
            </div>

            {/* Default location notice */}
            {forecast?.usingDefaultCoords && !coordsNeeded && (
                <div className="flex items-start gap-3 bg-slate-800/60 border border-slate-700 rounded-xl p-3">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300">
                            <span className="font-bold">Using default location</span> ({forecast.locationUsed}) — no site coordinates set for this mission.
                        </p>
                        <button
                            onClick={() => setCoordsNeeded(true)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline mt-0.5"
                        >
                            Set real coordinates for accurate forecasting →
                        </button>
                    </div>
                </div>
            )}

            {/* AI Summary */}
            {forecast?.forecastSummary && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-black text-violet-400 uppercase tracking-widest">AI Forecast Summary</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{forecast.forecastSummary}</p>
                    {forecast.recommendedAction && (
                        <div className="mt-3 flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 rounded-lg p-2">
                            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {forecast.recommendedAction}
                        </div>
                    )}
                </div>
            )}

            {/* Risk Warnings */}
            {(forecast?.riskWarnings || []).length > 0 && (
                <div className="space-y-2">
                    {forecast!.riskWarnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {w}
                        </div>
                    ))}
                </div>
            )}

            {/* View tabs */}
            {(windows.length > 0 || perf) && (
                <div className="flex gap-1 bg-slate-900 rounded-xl p-1">
                    {[
                        { key: 'timeline', label: 'Forecast Timeline', icon: Calendar },
                        { key: 'performance', label: 'Performance', icon: Activity },
                        { key: 'delays', label: 'Delay Patterns', icon: AlertTriangle },
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveView(key as any)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all
                                ${activeView === key
                                    ? 'bg-violet-600 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* ── TIMELINE VIEW ─────────────────────────────────────────── */}
            {activeView === 'timeline' && (
                <div className="space-y-4">
                    {/* 14-day grid */}
                    {days.length > 0 && (
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                                14-Day Operations Score
                            </h3>
                            <div className="grid grid-cols-7 gap-1.5">
                                {days.map(day => (
                                    <div
                                        key={day.date}
                                        title={`${day.date}\nWeather: ${day.weatherScore}/100\nWind: ${day.windMax.toFixed(0)} km/h\nPrecip: ${day.precipSum.toFixed(1)}mm\n${day.reasons.join(', ')}`}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-default
                                            ${day.flyable
                                                ? day.weatherScore >= 80
                                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                                    : 'bg-amber-500/10 border-amber-500/20'
                                                : 'bg-red-500/10 border-red-500/20'
                                            }`}
                                    >
                                        <span className="text-[9px] font-bold text-slate-400">
                                            {new Date(day.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                                        </span>
                                        <span className="text-[10px] text-slate-300">
                                            {new Date(day.date + 'T00:00').getDate()}
                                        </span>
                                        <span className={`text-[11px] font-black
                                            ${day.flyable
                                                ? day.weatherScore >= 80 ? 'text-emerald-400' : 'text-amber-400'
                                                : 'text-red-400'
                                            }`}>
                                            {day.weatherScore}
                                        </span>
                                        <div className="w-full">
                                            <WeatherBar score={day.weatherScore} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500" /> Excellent (80+)</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-amber-500" /> Good (60-79)</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-500" /> Poor (&lt;60)</div>
                            </div>
                        </div>
                    )}

                    {/* Recommended windows */}
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                            Recommended Work Windows
                        </h3>
                        {windows.length === 0 ? (
                            <div className="text-slate-500 text-sm text-center py-8 bg-slate-900/50 rounded-2xl border border-slate-800">
                                {loading ? 'Loading…' : 'Click "Generate Forecast" to find optimal work windows'}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {windows.map((w, i) => {
                                    const startDate = w.startDate || w.forecast_start_date;
                                    const endDate = w.endDate || w.forecast_end_date;
                                    const days = w.consecutiveDays || w.consecutive_days;
                                    const completion = w.predictedCompletionRate || w.predicted_completion_rate;
                                    const confidence = w.confidenceScore || w.confidence_score;
                                    const weather = w.weatherScore || w.weather_score;
                                    const recommended = w.recommended;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all
                                                ${recommended
                                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                                    : 'bg-slate-900 border-slate-800'
                                                }`}
                                        >
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                                                style={{ background: recommended ? '#10b98120' : '#1e293b', color: recommended ? '#10b981' : '#64748b', border: `1px solid ${recommended ? '#10b98130' : '#334155'}` }}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-bold text-white">
                                                        {fmtDate(startDate)} – {fmtDate(endDate)}
                                                    </span>
                                                    <span className="text-xs text-slate-500">{days}d consecutive</span>
                                                    {recommended && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                                            RECOMMENDED
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Sun className="w-3 h-3" /> Weather {weather}/100
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Target className="w-3 h-3" /> {completion}% completion
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className={`text-xl font-black ${confidence >= 80 ? 'text-emerald-400' : confidence >= 60 ? 'text-amber-400' : 'text-slate-400'}`}>
                                                    {confidence}%
                                                </div>
                                                <div className="text-[9px] text-slate-500 uppercase tracking-widest">Confidence</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── PERFORMANCE VIEW ──────────────────────────────────────── */}
            {activeView === 'performance' && perf && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            {
                                label: 'Avg Daily Output', value: perf.avgVelocity.toString(),
                                sub: 'units/day', icon: <Activity className="w-4 h-4" />, color: '#8b5cf6'
                            },
                            {
                                label: 'Completion Rate', value: `${perf.avgCompletionRate}%`,
                                sub: 'historical avg', icon: <Target className="w-4 h-4" />, color: '#10b981'
                            },
                            {
                                label: 'Weather Impact', value: `${Math.round(perf.weatherImpactFactor * 100)}%`,
                                sub: 'of work days affected', icon: <CloudRain className="w-4 h-4" />, color: '#06b6d4'
                            },
                            {
                                label: 'Productivity Trend', value: perf.riskTrend,
                                sub: 'vs prior period', icon: trendIcon, color: perf.riskTrend === 'improving' ? '#10b981' : perf.riskTrend === 'declining' ? '#ef4444' : '#f59e0b'
                            },
                        ].map(stat => (
                            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-2" style={{ color: stat.color }}>
                                    {stat.icon}
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                                </div>
                                <div className="text-xl font-black text-white capitalize">{stat.value}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{stat.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Data Quality</h4>
                        <div className="flex items-center gap-3">
                            <div className={`text-sm font-bold capitalize ${perf.dataQuality === 'high' ? 'text-emerald-400' : perf.dataQuality === 'medium' ? 'text-amber-400' : 'text-slate-500'}`}>
                                {perf.dataQuality}
                            </div>
                            <span className="text-xs text-slate-500">
                                Based on {perf.activeDays} active work days from {perf.totalLogs} total logs
                            </span>
                        </div>
                        {perf.dataQuality === 'low' && (
                            <p className="text-xs text-slate-500 mt-2">
                                Forecast accuracy improves significantly with 5+ daily logs containing output data.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── DELAYS VIEW ───────────────────────────────────────────── */}
            {activeView === 'delays' && perf && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Contributing Delay Factors</h3>
                    {perf.delayPatterns.length === 0 ? (
                        <div className="text-slate-500 text-sm text-center py-8 bg-slate-900/50 rounded-2xl border border-slate-800">
                            No delay patterns extracted yet. Generate a forecast after adding daily logs with notes.
                        </div>
                    ) : (
                        perf.delayPatterns.map((d, i) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
                                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-white">
                                        {DELAY_LABELS[d.factor] || d.factor}
                                    </div>
                                    <div className="text-xs text-slate-500">{d.frequency} occurrences</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black text-amber-400">{d.percentage}%</div>
                                    <div className="text-[9px] text-slate-500">of days</div>
                                </div>
                                <div className="w-24">
                                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${d.percentage}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Empty state */}
            {!forecast && !loading && windows.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No forecast generated yet.</p>
                    <p className="text-xs mt-1">Click "Generate Forecast" to run the AI analysis and find optimal work windows.</p>
                </div>
            )}
        </div>
    );
};

export default MissionForecastPanel;
