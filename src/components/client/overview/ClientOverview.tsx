import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard, Plane, AlertTriangle, Package, CheckCircle,
    Calendar, MapPin, ChevronRight, Radio, Zap, Clock,
    Flame, BrainCircuit, Download, Activity, RefreshCw, Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../services/apiClient';
import { useAuth } from '../../../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Project {
    id: string;
    name: string;
    site_name?: string;
    status?: string;
    mission_count?: number;
    completed_missions?: number;
    last_flight_date?: string | null;
    next_flight_date?: string | null;
    open_critical?: number;
    lbd_total?: number;
    lbd_resolved?: number;
}

interface ActivityEvent {
    event_id: string;
    event_type: 'mission' | 'report' | 'lbd' | 'deliverable';
    title: string;
    subtitle?: string;
    event_at: string;
}

interface LBDStats {
    total: number;
    resolved: number;
    inProgress: number;
    identified: number;
}

interface Mission {
    id: string;
    mission_name: string;
    site: string;
    status: string;
    project_name: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function fmtDate(d: string | null | undefined) {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
}

// ── Progress Ring ──────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 56, stroke = 5 }: { pct: number; size?: number; stroke?: number }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    return (
        <svg width={size} height={size} className="-rotate-90 shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="#1e293b" />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
                stroke={pct >= 100 ? '#10b981' : pct > 50 ? '#6366f1' : '#f59e0b'}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
        </svg>
    );
}

// ── Event Config ───────────────────────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { icon: typeof Plane; color: string; bg: string }> = {
    mission:     { icon: Plane,          color: 'text-sky-400',    bg: 'bg-sky-500/10' },
    report:      { icon: BrainCircuit,   color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    lbd:         { icon: AlertTriangle,  color: 'text-amber-400',  bg: 'bg-amber-500/10' },
    deliverable: { icon: Package,        color: 'text-violet-400', bg: 'bg-violet-500/10' },
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ClientOverview: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [projects, setProjects]   = useState<Project[]>([]);
    const [activity, setActivity]   = useState<ActivityEvent[]>([]);
    const [lbd, setLbd]             = useState<LBDStats>({ total: 0, resolved: 0, inProgress: 0, identified: 0 });
    const [missions, setMissions]   = useState<Mission[]>([]);
    const [delivCount, setDelivCount] = useState(0);
    const [loading, setLoading]     = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        await Promise.allSettled([
            apiClient.get('/client/projects').then(r => setProjects(r.data.data ?? [])),
            apiClient.get('/client/activity').then(r => setActivity((r.data.data ?? []).slice(0, 8))),
            apiClient.get('/client/lbd').then(r => {
                const s = r.data.stats;
                if (s) setLbd(s);
            }),
            apiClient.get('/client/missions').then(r => setMissions(r.data.data ?? [])),
            apiClient.get('/client/deliverables').then(r => setDelivCount((r.data.data ?? []).length)),
        ]);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const liveMissions = missions.filter(m => m.status === 'in_flight' || m.status === 'in_progress');
    const totalMissions = projects.reduce((s, p) => s + (p.mission_count ?? 0), 0);
    const openDefects = lbd.identified + lbd.inProgress;
    const companyName = user?.companyName || user?.fullName || 'Your Portal';

    // KPI cards
    const kpis = [
        { label: 'Total Missions',  value: totalMissions, icon: Plane,          color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20' },
        { label: 'Active Now',      value: liveMissions.length, icon: Radio,    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        { label: 'Defects Open',    value: openDefects,   icon: AlertTriangle,  color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
        { label: 'Deliverables',    value: delivCount,    icon: Package,        color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
    ];

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="p-5 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1">
                            {greeting()},
                        </p>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                            {companyName}
                        </h1>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">
                            Client Portal — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all font-bold uppercase tracking-wider">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>

                {/* ── Active Mission Banner ───────────────────────────────── */}
                {liveMissions.length > 0 && (
                    <div className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent p-5 flex items-center gap-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent pointer-events-none" />
                        <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
                            <Radio size={20} className="text-sky-400 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Live Now</span>
                                <span className="flex gap-1">
                                    {[0, 1, 2].map(i => (
                                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                    ))}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-white truncate">
                                {liveMissions.length === 1
                                    ? `${liveMissions[0].mission_name} — ${liveMissions[0].site}`
                                    : `${liveMissions.length} missions currently in progress`}
                            </p>
                        </div>
                        <button onClick={() => navigate('/client/missions')}
                            className="z-10 shrink-0 flex items-center gap-1.5 px-4 py-2 bg-sky-500/20 border border-sky-500/40 rounded-xl text-sky-400 text-xs font-black uppercase tracking-wider hover:bg-sky-500/30 transition-colors">
                            View Live <ChevronRight size={12} />
                        </button>
                    </div>
                )}

                {/* ── KPI Strip ──────────────────────────────────────────── */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 animate-pulse h-24" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {kpis.map((k, i) => (
                            <div key={i} className={`bg-slate-800/40 border rounded-2xl p-5 transition-all hover:border-slate-600/60 hover:bg-slate-800/60`}>
                                <div className={`inline-flex p-2.5 rounded-xl border mb-3 ${k.bg}`}>
                                    <k.icon size={16} className={k.color} />
                                </div>
                                <div className={`text-3xl font-black tabular-nums mb-1 ${k.color}`}>{k.value}</div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{k.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Main Grid ──────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT — Projects */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <LayoutDashboard size={13} className="text-emerald-400" /> Your Projects
                        </h2>

                        {loading ? (
                            [...Array(2)].map((_, i) => (
                                <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 h-32 animate-pulse" />
                            ))
                        ) : projects.length === 0 ? (
                            <div className="border border-slate-800 rounded-2xl p-12 text-center">
                                <LayoutDashboard size={28} className="text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm font-semibold">No projects assigned yet</p>
                                <p className="text-slate-700 text-xs mt-1">Contact your account manager to get started</p>
                            </div>
                        ) : (
                            projects.map(p => {
                                const total = p.mission_count ?? 0;
                                const done  = p.completed_missions ?? 0;
                                const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                                return (
                                    <div key={p.id}
                                        onClick={() => navigate('/client/missions')}
                                        className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 cursor-pointer hover:border-emerald-500/30 hover:bg-slate-800/60 transition-all duration-200 group">
                                        <div className="flex items-start gap-4">
                                            {/* Progress ring */}
                                            <div className="relative shrink-0">
                                                <ProgressRing pct={pct} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-[10px] font-black text-white">{pct}%</span>
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                                    <div className="min-w-0">
                                                        <h3 className="font-black text-white text-base leading-tight truncate group-hover:text-emerald-400 transition-colors">
                                                            {p.name}
                                                        </h3>
                                                        {p.site_name && (
                                                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <MapPin size={9} /> {p.site_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                        {(p.open_critical ?? 0) > 0 && (
                                                            <span className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg">
                                                                <Flame size={8} /> {p.open_critical} critical
                                                            </span>
                                                        )}
                                                        <span className="px-2.5 py-1 text-[9px] font-black uppercase bg-slate-700/60 border border-slate-600/40 text-slate-400 rounded-lg">
                                                            {done}/{total} missions
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Progress bar */}
                                                <div className="mt-3 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-700"
                                                        style={{ width: `${pct}%` }} />
                                                </div>

                                                {/* Dates */}
                                                <div className="flex items-center gap-4 mt-2 flex-wrap">
                                                    {p.last_flight_date && (
                                                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                                            <Clock size={9} /> Last flight: {fmtDate(p.last_flight_date)}
                                                        </span>
                                                    )}
                                                    {p.next_flight_date && (
                                                        <span className="text-[10px] text-sky-400/70 flex items-center gap-1">
                                                            <Calendar size={9} /> Next: {fmtDate(p.next_flight_date)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 shrink-0 mt-1 transition-colors" />
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Quick Access */}
                        <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-700/40">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick Access</p>
                            </div>
                            {[
                                { label: 'AI Inspection Reports', icon: BrainCircuit, path: '/client/reports',      accent: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
                                { label: 'Track Defects',         icon: AlertTriangle, path: '/client/lbd',         accent: 'text-amber-400',   bg: 'bg-amber-500/10' },
                                { label: 'Download Deliverables', icon: Download,      path: '/client/deliverables', accent: 'text-violet-400',  bg: 'bg-violet-500/10' },
                                { label: 'Drone Imagery',         icon: Activity,      path: '/client/media',       accent: 'text-sky-400',     bg: 'bg-sky-500/10' },
                            ].map(item => (
                                <button key={item.path} onClick={() => navigate(item.path)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-700/30 last:border-0 hover:bg-slate-800/40 transition-colors group text-left">
                                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                                        <item.icon size={14} className={item.accent} />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors flex-1">{item.label}</span>
                                    <ChevronRight size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT — Status + Activity */}
                    <div className="space-y-4">

                        {/* LBD Defect Status */}
                        <div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                                <Zap size={13} className="text-emerald-400" /> Defect Status
                            </h2>
                            <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl overflow-hidden">
                                {[
                                    { label: 'Identified',   value: lbd.identified,  color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' },
                                    { label: 'In Progress',  value: lbd.inProgress,  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
                                    { label: 'Resolved',     value: lbd.resolved,    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                                ].map(row => (
                                    <div key={row.label}
                                        className={`flex items-center justify-between px-4 py-3.5 border-b border-slate-700/30 last:border-0 ${row.bg} border-l-0 border-r-0 border-t-0`}>
                                        <span className={`text-xs font-black uppercase tracking-wider ${row.color}`}>{row.label}</span>
                                        <span className={`text-2xl font-black tabular-nums ${row.color}`}>{loading ? '—' : row.value}</span>
                                    </div>
                                ))}
                                <button onClick={() => navigate('/client/lbd')}
                                    className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-colors">
                                    View All Defects <ChevronRight size={11} />
                                </button>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                                <Clock size={13} className="text-slate-500" /> Recent Activity
                            </h2>
                            <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl overflow-hidden">
                                {loading ? (
                                    <div className="p-6 flex justify-center"><Loader2 size={20} className="text-slate-600 animate-spin" /></div>
                                ) : activity.length === 0 ? (
                                    <div className="p-8 text-center text-slate-600 text-xs">No recent activity</div>
                                ) : (
                                    activity.map((ev, i) => {
                                        const cfg = EVENT_CONFIG[ev.event_type] ?? EVENT_CONFIG.mission;
                                        const Icon = cfg.icon;
                                        return (
                                            <div key={ev.event_id}
                                                className={`flex items-start gap-3 p-3.5 ${i < activity.length - 1 ? 'border-b border-slate-800/60' : ''} hover:bg-slate-800/20 transition-colors`}>
                                                <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                                    <Icon size={12} className={cfg.color} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-200 leading-tight truncate">{ev.title}</p>
                                                    {ev.subtitle && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{ev.subtitle}</p>}
                                                    <p className="text-[10px] text-slate-700 mt-0.5">
                                                        {new Date(ev.event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Resolution meter */}
                        {lbd.total > 0 && (
                            <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolution Rate</span>
                                    <span className="text-lg font-black text-emerald-400 tabular-nums">
                                        {Math.round((lbd.resolved / lbd.total) * 100)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-700"
                                        style={{ width: `${Math.round((lbd.resolved / lbd.total) * 100)}%` }} />
                                </div>
                                <p className="text-[10px] text-slate-600 mt-2">{lbd.resolved} of {lbd.total} defects resolved</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientOverview;
