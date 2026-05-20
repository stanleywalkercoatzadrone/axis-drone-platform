/**
 * ClientMissions.tsx — Client "Live Site View"
 * Mirrors the Pilot Terminal layout so clients see exactly what's happening:
 * • Live weather at each site (same API the pilot uses)
 * • Real-time block grid (read-only LBDDocumentGrid with userRole="client")
 * • Mission status, progress, and flight conditions — auto-refreshes every 60s
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Plane, Calendar, MapPin, CheckCircle, Clock, XCircle,
    Loader2, ChevronDown, ChevronUp, Grid3X3, RefreshCw,
    Wind, Sun, Cloud, CloudLightning, Zap, Eye,
    AlertTriangle, Activity, Radio,
} from 'lucide-react';
import apiClient from '../../../../services/apiClient';
import LBDDocumentGrid from '../../../components/LBDDocumentGrid';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Mission {
    id: string;
    mission_name: string;
    site: string;
    flight_date: string | null;
    status: 'scheduled' | 'in_flight' | 'completed' | 'cancelled' | 'in_progress' | 'on_hold';
    project_name: string;
    location?: string;
}

interface WeatherData {
    temperature?: number;
    feels_like?: number;
    wind_speed?: number;
    wind_gusts?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    visibility_mi?: number;
    humidity?: number;
    flight_status?: 'GO' | 'CAUTION' | 'NO_GO';
    flight_reasons?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const weatherEmoji = (code?: number) => {
    if (!code && code !== 0) return '🌡️';
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 9) return '🌫️';
    if (code <= 39) return '🌧️';
    if (code <= 49) return '❄️';
    if (code <= 84) return '🌦️';
    if (code <= 94) return '⛈️';
    return '🌪️';
};

const weatherLabel = (code?: number) => {
    if (!code && code !== 0) return 'Unknown';
    if (code === 0) return 'Clear Sky';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 9) return 'Fog';
    if (code <= 39) return 'Rain';
    if (code <= 49) return 'Snow';
    if (code <= 84) return 'Showers';
    if (code <= 94) return 'Thunderstorm';
    return 'Severe Storm';
};

const STATUS_CFG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string; pulse?: boolean }> = {
    completed:   { icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Completed' },
    in_flight:   { icon: Plane,         color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/30',         label: 'In Flight', pulse: true },
    in_progress: { icon: Activity,      color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30',       label: 'In Progress', pulse: true },
    scheduled:   { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     label: 'Scheduled' },
    on_hold:     { icon: Clock,         color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30',     label: 'On Hold' },
    cancelled:   { icon: XCircle,       color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',       label: 'Cancelled' },
};

const MOCK: Mission[] = [
    { id:'1', mission_name:'Block A North Thermal Scan', site:'Riverstart Solar — Indiana', flight_date:'2026-03-05', status:'completed', project_name:'Riverstart Solar Phase I' },
    { id:'2', mission_name:'Block B RGB Survey',         site:'Riverstart Solar — Indiana', flight_date:'2026-03-07', status:'in_flight', project_name:'Riverstart Solar Phase I' },
    { id:'3', mission_name:'Block C Thermal Scan',       site:'Riverstart Solar — Indiana', flight_date:'2026-03-14', status:'scheduled', project_name:'Riverstart Solar Phase I' },
    { id:'4', mission_name:'Section 1 Full Survey',      site:'Desert Ridge — Arizona',     flight_date:'2026-03-07', status:'completed', project_name:'Desert Ridge Solar Farm' },
];

// ── Weather Panel (per-mission live data) ─────────────────────────────────────
const WeatherPanel: React.FC<{ missionId: string }> = ({ missionId }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // Use the pilot weather endpoint — clients benefit from the same live data
        apiClient.get(`/pilot/secure/missions/${missionId}/weather`)
            .then(r => { if (r.data.success) setWeather(r.data.weather || null); })
            .catch(() => { /* no coords — silently ignore */ })
            .finally(() => setLoading(false));
    }, [missionId]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-slate-600 text-xs py-2">
                <Loader2 size={12} className="animate-spin" /> Fetching site conditions…
            </div>
        );
    }

    if (!weather) {
        return (
            <div className="flex items-center gap-2 text-slate-700 text-xs py-2">
                <Cloud size={12} /> No GPS coordinates on this mission — contact your team for live conditions.
            </div>
        );
    }

    const flightStatus = weather.flight_status;
    const flightColor = flightStatus === 'GO' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : flightStatus === 'CAUTION' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                      : 'text-red-400 bg-red-500/10 border-red-500/30';

    return (
        <div className="space-y-3">
            {/* Flight status banner */}
            {flightStatus && (
                <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider ${flightColor}`}>
                    <span className="text-base">
                        {flightStatus === 'GO' ? '✅' : flightStatus === 'CAUTION' ? '⚠️' : '🚫'}
                    </span>
                    <div>
                        <span>
                            {flightStatus === 'GO' ? 'Flight conditions favorable' :
                             flightStatus === 'CAUTION' ? 'Conditions require review' :
                             'Unsafe flight conditions'}
                        </span>
                        {weather.flight_reasons && weather.flight_reasons.length > 0 && (
                            <div className="font-normal normal-case tracking-normal mt-0.5 opacity-80">
                                {weather.flight_reasons.join(' · ')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Weather grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
                    <p className="text-2xl mb-1">{weatherEmoji(weather.weather_code)}</p>
                    <p className="text-lg font-black text-white tabular-nums">{weather.temperature ?? '—'}°F</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{weatherLabel(weather.weather_code)}</p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
                    <Wind size={18} className="text-blue-400 mx-auto mb-1" />
                    <p className="text-lg font-black text-white tabular-nums">{weather.wind_speed ?? '—'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">mph wind{weather.wind_gusts ? ` · gusts ${weather.wind_gusts}` : ''}</p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
                    <Cloud size={18} className="text-slate-400 mx-auto mb-1" />
                    <p className="text-lg font-black text-white tabular-nums">{weather.cloud_cover ?? '—'}%</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">cloud cover</p>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center">
                    <Eye size={18} className="text-emerald-400 mx-auto mb-1" />
                    <p className="text-lg font-black text-white tabular-nums">{weather.visibility_mi ?? '—'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">mi visibility</p>
                </div>
            </div>
        </div>
    );
};

// ── Mission Card ──────────────────────────────────────────────────────────────
const MissionCard: React.FC<{ mission: Mission; defaultExpanded?: boolean }> = ({ mission, defaultExpanded = false }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const cfg = STATUS_CFG[mission.status] ?? STATUS_CFG.scheduled;
    const Icon = cfg.icon;
    const isLive = mission.status === 'in_flight' || mission.status === 'in_progress';

    return (
        <div className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-300 shadow-md ${
            isLive ? 'border-sky-500/50 shadow-sky-500/10 shadow-lg' :
            expanded ? 'border-slate-600/60' : 'border-slate-700/50'
        }`}>
            {/* Live mission indicator bar */}
            {isLive && (
                <div className="h-0.5 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-sky-500 animate-pulse" />
            )}

            {/* Header */}
            <div
                className="px-5 py-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon size={20} className={`${cfg.color} ${isLive ? 'animate-pulse' : ''}`} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                        {/* Project label */}
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-0.5">
                            {mission.project_name}
                        </p>
                        <h3 className="font-bold text-white text-sm leading-tight truncate">
                            {mission.mission_name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <MapPin size={9} />{mission.site}
                            </span>
                            {mission.flight_date && (
                                <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                    <Calendar size={9} />
                                    {new Date(mission.flight_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border rounded-lg ${cfg.bg} ${cfg.color}`}>
                            <Icon size={9} className={isLive ? 'animate-pulse' : ''} />
                            {cfg.label}
                        </span>
                        {isLive && (
                            <span className="flex items-center gap-1 text-[10px] text-sky-400 font-black">
                                <Radio size={9} className="animate-pulse" /> LIVE
                            </span>
                        )}
                    </div>

                    {expanded
                        ? <ChevronUp size={16} className="text-slate-500 shrink-0 mt-1" />
                        : <ChevronDown size={16} className="text-slate-500 shrink-0 mt-1" />
                    }
                </div>
            </div>

            {/* Expanded Panel */}
            {expanded && (
                <div className="border-t border-slate-700/60 bg-slate-900/80 px-5 py-5 space-y-5">

                    {/* Live site conditions */}
                    <div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Sun size={11} className="text-amber-400" /> Live Site Conditions
                        </h4>
                        <WeatherPanel missionId={mission.id} />
                    </div>

                    {/* Block progress grid */}
                    <div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Grid3X3 size={11} className="text-orange-400" /> Block Scan Progress
                        </h4>
                        <LBDDocumentGrid
                            deploymentId={mission.id}
                            userRole="client"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const ClientMissions: React.FC = () => {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(Date.now());
    const [filter, setFilter] = useState<'all' | 'in_flight' | 'in_progress' | 'scheduled' | 'completed'>('all');

    const load = useCallback(async () => {
        try {
            const r = await apiClient.get('/client/missions');
            setMissions(r.data.data ?? []);
        } catch {
            setMissions(MOCK);
        } finally {
            setLoading(false);
            setLastUpdated(Date.now());
        }
    }, []);

    useEffect(() => {
        load();
        // Auto-refresh every 60s — clients see updates in near-real-time
        const interval = setInterval(load, 60_000);
        return () => clearInterval(interval);
    }, [load]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="text-sky-400 animate-spin" size={32} />
        </div>
    );

    const live = missions.filter(m => m.status === 'in_flight' || m.status === 'in_progress');
    const counts = missions.reduce((a, m) => { a[m.status] = (a[m.status] ?? 0) + 1; return a; }, {} as Record<string, number>);
    const totalDone = counts['completed'] ?? 0;
    const overallPct = missions.length > 0 ? Math.round((totalDone / missions.length) * 100) : 0;

    const filtered = filter === 'all' ? missions
        : missions.filter(m => m.status === filter || (filter === 'in_flight' && m.status === 'in_progress'));

    // Sort: live first, then scheduled, then completed, then cancelled
    const sortOrder: Record<string, number> = { in_flight: 0, in_progress: 0, scheduled: 1, on_hold: 2, completed: 3, cancelled: 4 };
    const sorted = [...filtered].sort((a, b) => (sortOrder[a.status] ?? 5) - (sortOrder[b.status] ?? 5));

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <Plane size={24} className="text-sky-400" /> Mission View
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                        Live site operations · auto-refreshes every 60s
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-600">
                        Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <button
                        onClick={load}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition-colors font-bold"
                    >
                        <RefreshCw size={11} /> Refresh
                    </button>
                </div>
            </div>

            {/* LIVE NOW banner */}
            {live.length > 0 && (
                <div className="bg-sky-500/5 border border-sky-500/30 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                        <Radio size={18} className="text-sky-400 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Active Right Now</p>
                        <p className="text-sm font-bold text-white mt-0.5">
                            {live.length} mission{live.length !== 1 ? 's' : ''} currently in progress — block grid updates in real time
                        </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                    </div>
                </div>
            )}

            {/* Overall Progress */}
            {missions.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap size={14} className="text-amber-400" />
                            <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Overall Mission Progress</span>
                        </div>
                        <span className="text-xl font-black text-white tabular-nums">{overallPct}%</span>
                    </div>
                    <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-700 relative"
                            style={{ width: `${overallPct}%` }}
                        >
                            {overallPct > 0 && overallPct < 100 && (
                                <div className="absolute right-0 top-0 h-full w-4 bg-white/20 animate-pulse rounded-full" />
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {Object.entries({
                            'In Flight': (counts['in_flight'] ?? 0) + (counts['in_progress'] ?? 0),
                            'Scheduled': counts['scheduled'] ?? 0,
                            'Completed': counts['completed'] ?? 0,
                            'Cancelled': counts['cancelled'] ?? 0,
                        }).map(([label, count]) => (
                            <div key={label} className="text-center">
                                <div className="text-xl font-black text-white tabular-nums">{count}</div>
                                <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
                {([
                    { key: 'all',       label: `All (${missions.length})` },
                    { key: 'in_flight', label: `Live (${(counts['in_flight'] ?? 0) + (counts['in_progress'] ?? 0)})` },
                    { key: 'scheduled', label: `Scheduled (${counts['scheduled'] ?? 0})` },
                    { key: 'completed', label: `Completed (${counts['completed'] ?? 0})` },
                ] as const).map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border
                            ${filter === f.key
                                ? 'bg-sky-600/20 text-sky-400 border-sky-500/40'
                                : 'text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Mission Cards — live missions auto-expanded */}
            <div className="space-y-3">
                {sorted.map(m => (
                    <MissionCard
                        key={m.id}
                        mission={m}
                        defaultExpanded={m.status === 'in_flight' || m.status === 'in_progress'}
                    />
                ))}
                {sorted.length === 0 && (
                    <div className="py-20 text-center border border-slate-800 rounded-2xl">
                        <Plane size={28} className="text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm font-bold">No missions for this filter</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientMissions;
