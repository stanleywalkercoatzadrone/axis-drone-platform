import React, { useState, useEffect } from 'react';
import {
    TrendingUp, CheckCircle, AlertTriangle, Calendar,
    Percent, MapPin, Loader2, Plane, Package, BarChart3,
    ChevronRight, Clock, Zap
} from 'lucide-react';
import apiClient from '../../../../src/services/apiClient';

interface ProjectSummary {
    id: string; project_name: string; site_location: string; status: string;
    total_missions: number; completed_missions: number; last_flight_date: string | null;
    total_lbd: number; resolved_lbd: number;
}
interface ActivityEvent {
    event_type: 'mission' | 'lbd_resolved' | 'deliverable';
    event_id: string; title: string; subtitle: string; event_at: string;
}

const MOCK_PROJECTS: ProjectSummary[] = [
    { id:'1', project_name:'Riverstart Solar Phase I', site_location:'Indiana, USA', status:'active',
      total_missions:8, completed_missions:5, last_flight_date:'2026-03-05', total_lbd:142, resolved_lbd:98 },
    { id:'2', project_name:'Desert Ridge Solar Farm', site_location:'Arizona, USA', status:'active',
      total_missions:12, completed_missions:9, last_flight_date:'2026-03-07', total_lbd:87, resolved_lbd:72 },
];
const MOCK_ACTIVITY: ActivityEvent[] = [
    { event_type:'mission', event_id:'a1', title:'Block A Thermal Scan completed', subtitle:'Riverstart Solar Phase I', event_at:'2026-03-05T14:00:00Z' },
    { event_type:'lbd_resolved', event_id:'a2', title:'Block 3 — Hotspot resolved', subtitle:'Desert Ridge Solar Farm', event_at:'2026-03-04T10:00:00Z' },
    { event_type:'deliverable', event_id:'a3', title:'New deliverable available', subtitle:'Desert Ridge Solar Farm', event_at:'2026-03-03T08:00:00Z' },
];

const STATUS_COLOR: Record<string,string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    on_hold: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const EVENT_CONFIG = {
    mission:     { icon: Plane,         color: 'text-sky-400',     bg: 'bg-sky-500/10',     label: 'Mission completed' },
    lbd_resolved:{ icon: CheckCircle,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'LBD resolved' },
    deliverable: { icon: Package,       color: 'text-violet-400',  bg: 'bg-violet-500/10',  label: 'Deliverable ready' },
};

function KPICard({ label, value, sub, icon, border }: { label:string; value:string|number; sub?:string; icon:React.ReactNode; border:string }) {
    return (
        <div className={`bg-slate-800/60 border ${border} rounded-2xl p-5 hover:brightness-110 transition-all duration-300`}>
            <div className="mb-3">{icon}</div>
            <div className="text-3xl font-black text-white tabular-nums mb-0.5">{value}</div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{label}</div>
            {sub && <div className="text-xs text-slate-600">{sub}</div>}
        </div>
    );
}

function ProgressBar({ value, max, color='bg-emerald-500' }: { value:number; max:number; color?:string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-700/40 rounded-full h-1.5">
                <div className={`${color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-black text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
        </div>
    );
}

const ClientOverview: React.FC = () => {
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiClient.get('/client/projects').then(r => r.data.data ?? []).catch(() => MOCK_PROJECTS),
            apiClient.get('/client/activity').then(r => r.data.data ?? []).catch(() => MOCK_ACTIVITY),
        ]).then(([p, a]) => { setProjects(p); setActivity(a); setLoading(false); });
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="text-emerald-400 animate-spin" size={32} />
        </div>
    );

    const totals = projects.reduce(
        (acc, p) => ({
            missions: acc.missions + p.total_missions,
            done: acc.done + p.completed_missions,
            lbd: acc.lbd + p.total_lbd,
            resolved: acc.resolved + p.resolved_lbd,
        }),
        { missions: 0, done: 0, lbd: 0, resolved: 0 }
    );
    const completion = totals.missions > 0 ? Math.round((totals.done / totals.missions) * 100) : 0;
    const lastFlight = projects.map(p => p.last_flight_date).filter(Boolean).sort().pop();

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <Zap size={24} className="text-emerald-400" /> Project Overview
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                    Live dashboard — {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                </p>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="Overall Completion" value={`${completion}%`}
                    sub={`${totals.done} of ${totals.missions} missions`}
                    icon={<Percent size={20} className="text-emerald-400" />} border="border-emerald-500/20" />
                <KPICard label="Last Flight" value={lastFlight ? new Date(lastFlight).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—'}
                    sub={lastFlight ?? 'No flights yet'}
                    icon={<Calendar size={20} className="text-sky-400" />} border="border-sky-500/20" />
                <KPICard label="Total LBD Found" value={totals.lbd} sub="Across all projects"
                    icon={<AlertTriangle size={20} className="text-amber-400" />} border="border-amber-500/20" />
                <KPICard label="LBD Resolved" value={totals.resolved}
                    sub={`${totals.lbd > 0 ? Math.round((totals.resolved / totals.lbd) * 100) : 0}% resolution rate`}
                    icon={<CheckCircle size={20} className="text-rose-400" />} border="border-rose-500/20" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Project Cards */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" /> Active Projects
                    </h2>
                    {projects.map(p => {
                        const lbdPct = p.total_lbd > 0 ? Math.round((p.resolved_lbd / p.total_lbd) * 100) : 0;
                        return (
                            <div key={p.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/60 transition-all duration-300 group">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="font-black text-white text-sm mb-1">{p.project_name}</h3>
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                            <MapPin size={11} />{p.site_location}
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border rounded-md ${STATUS_COLOR[p.status] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                        {p.status.replace('_', ' ')}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                                            <span>Mission Progress</span>
                                            <span>{p.completed_missions}/{p.total_missions}</span>
                                        </div>
                                        <ProgressBar value={p.completed_missions} max={p.total_missions} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                                            <span>LBD Resolution</span>
                                            <span>{p.resolved_lbd}/{p.total_lbd} ({lbdPct}%)</span>
                                        </div>
                                        <ProgressBar value={p.resolved_lbd} max={p.total_lbd} color="bg-amber-500" />
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                        <Clock size={10} />
                                        Last flight: {p.last_flight_date ? new Date(p.last_flight_date).toLocaleDateString() : 'None yet'}
                                    </span>
                                    <ChevronRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
                                </div>
                            </div>
                        );
                    })}
                    {projects.length === 0 && (
                        <div className="text-center py-16 text-slate-600 text-sm">No projects assigned yet.</div>
                    )}
                </div>

                {/* Activity Feed */}
                <div className="space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <BarChart3 size={14} className="text-emerald-400" /> Recent Activity
                    </h2>
                    <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl overflow-hidden">
                        {activity.length === 0 && (
                            <div className="p-8 text-center text-slate-600 text-sm">No recent activity</div>
                        )}
                        {activity.map((ev, i) => {
                            const cfg = EVENT_CONFIG[ev.event_type] ?? EVENT_CONFIG.mission;
                            const Icon = cfg.icon;
                            return (
                                <div key={ev.event_id} className={`flex items-start gap-3 p-4 ${i < activity.length - 1 ? 'border-b border-slate-800/60' : ''} hover:bg-slate-800/20 transition-colors`}>
                                    <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                        <Icon size={13} className={cfg.color} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-200 leading-tight truncate">{ev.title}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{ev.subtitle}</p>
                                        <p className="text-[10px] text-slate-700 mt-1">
                                            {new Date(ev.event_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientOverview;
