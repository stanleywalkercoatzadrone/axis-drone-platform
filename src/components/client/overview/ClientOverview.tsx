import React, { useState, useEffect } from 'react';
import {
    TrendingUp, CheckCircle, AlertTriangle, Calendar,
    Percent, MapPin, Loader2, Plane, Package, BarChart3,
    ChevronRight, Clock, Zap, BrainCircuit, FileText,
    ArrowRight, Flame, ShieldCheck, Info,
} from 'lucide-react';
import apiClient from '../../../../src/services/apiClient';
import { useNavigate } from 'react-router-dom';

import { WeatherWidget } from '../../widgets/WeatherWidget';

interface ProjectSummary {
    id: string; project_name: string; site_location: string; status: string;
    total_missions: number; completed_missions: number; last_flight_date: string | null;
    next_flight_date?: string | null;
    total_lbd: number; resolved_lbd: number;
    open_critical?: number;
}
interface ActivityEvent {
    event_type: 'mission' | 'lbd_resolved' | 'deliverable' | 'report';
    event_id: string; title: string; subtitle: string; event_at: string;
}

const STATUS_COLOR: Record<string,string> = {
    active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    on_hold:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const EVENT_CONFIG = {
    mission:     { icon: Plane,        color: 'text-sky-400',     bg: 'bg-sky-500/10',     label: 'Mission' },
    lbd_resolved:{ icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Resolved' },
    deliverable: { icon: FileText,     color: 'text-violet-400',  bg: 'bg-violet-500/10',  label: 'Deliverable' },
    report:      { icon: BrainCircuit, color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  label: 'Report' },
};

function ProgressBar({ value, max, color='bg-emerald-500' }: { value:number; max:number; color?:string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-700/40 rounded-full h-2 overflow-hidden">
                <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-black text-slate-400 tabular-nums w-10 text-right">{pct}%</span>
        </div>
    );
}

const ClientOverview: React.FC = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiClient.get('/client/projects').then(r => r.data.data ?? []).catch(() => []),
            apiClient.get('/client/activity').then(r => r.data.data ?? []).catch(() => []),
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
            critical: acc.critical + (p.open_critical ?? 0),
        }),
        { missions: 0, done: 0, lbd: 0, resolved: 0, critical: 0 }
    );
    const completion = totals.missions > 0 ? Math.round((totals.done / totals.missions) * 100) : 0;
    const nextFlight = projects.map(p => p.next_flight_date).filter(Boolean).sort()[0];
    const allLBDClear = totals.lbd > 0 && totals.resolved === totals.lbd;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <Zap size={24} className="text-emerald-400" /> Project Overview
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                    {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                </p>
            </div>

            {/* Status Banner — shows most actionable info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Next flight */}
                {nextFlight ? (
                    <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                            <Plane size={22} className="text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Next Scheduled Flight</p>
                            <p className="text-lg font-black text-white mt-0.5">
                                {new Date(nextFlight).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {(() => {
                                    const days = Math.ceil((new Date(nextFlight).getTime() - Date.now()) / 86400000);
                                    return days > 0 ? `${days} day${days !== 1 ? 's' : ''} from today` : 'Today';
                                })()}
                            </p>
                        </div>
                        <button onClick={() => navigate('/client/missions')} className="shrink-0 p-2 rounded-xl text-sky-400 hover:bg-sky-500/10 transition-colors">
                            <ArrowRight size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-700/40 border border-slate-700 flex items-center justify-center shrink-0">
                            <Plane size={22} className="text-slate-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Next Flight</p>
                            <p className="text-sm font-bold text-slate-400 mt-0.5">No flights scheduled yet</p>
                            <p className="text-xs text-slate-600 mt-0.5">Your operations team will schedule the next mission</p>
                        </div>
                    </div>
                )}

                {/* Open issues or all clear */}
                {totals.critical > 0 ? (
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                            <Flame size={22} className="text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Open Critical Issues</p>
                            <p className="text-lg font-black text-white mt-0.5">{totals.critical} issue{totals.critical !== 1 ? 's' : ''} need attention</p>
                            <p className="text-xs text-slate-500 mt-0.5">Review in Defect Tracking</p>
                        </div>
                        <button onClick={() => navigate('/client/lbd')} className="shrink-0 p-2 rounded-xl text-orange-400 hover:bg-orange-500/10 transition-colors">
                            <ArrowRight size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                            <ShieldCheck size={22} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                {allLBDClear ? 'All Clear' : 'Defect Status'}
                            </p>
                            <p className="text-lg font-black text-white mt-0.5">
                                {allLBDClear ? 'No open issues' : `${totals.lbd - totals.resolved} issues in progress`}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {totals.resolved} of {totals.lbd} defects resolved
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Overall Completion', value: `${completion}%`, sub: `${totals.done} of ${totals.missions} missions`, icon: <Percent size={18} className="text-emerald-400" />, border: 'border-emerald-500/20' },
                    { label: 'Active Projects', value: projects.filter(p=>p.status==='active').length, sub: `${projects.length} total`, icon: <TrendingUp size={18} className="text-sky-400" />, border: 'border-sky-500/20' },
                    { label: 'Defects Found', value: totals.lbd, sub: 'Across all sites', icon: <AlertTriangle size={18} className="text-amber-400" />, border: 'border-amber-500/20' },
                    { label: 'Defects Resolved', value: totals.resolved, sub: `${totals.lbd > 0 ? Math.round((totals.resolved/totals.lbd)*100) : 0}% resolution rate`, icon: <CheckCircle size={18} className="text-rose-400" />, border: 'border-rose-500/20' },
                ].map(k => (
                    <div key={k.label} className={`bg-slate-800/60 border ${k.border} rounded-2xl p-5 hover:brightness-110 transition-all duration-300`}>
                        <div className="mb-3">{k.icon}</div>
                        <div className="text-3xl font-black text-white tabular-nums mb-0.5">{k.value}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{k.label}</div>
                        <div className="text-xs text-slate-600">{k.sub}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Project Cards */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" /> Your Projects
                    </h2>
                    {projects.map(p => {
                        const lbdPct = p.total_lbd > 0 ? Math.round((p.resolved_lbd / p.total_lbd) * 100) : 0;
                        const missionPct = p.total_missions > 0 ? Math.round((p.completed_missions / p.total_missions) * 100) : 0;
                        return (
                            <div key={p.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/60 transition-all duration-300 group space-y-4">
                                {/* Title row */}
                                <div className="flex items-start justify-between">
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

                                {/* Progress bars */}
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                                            <span className="flex items-center gap-1"><Plane size={9} /> Mission Progress</span>
                                            <span>{p.completed_missions}/{p.total_missions} flights</span>
                                        </div>
                                        <ProgressBar value={p.completed_missions} max={p.total_missions} />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                                            <span className="flex items-center gap-1"><CheckCircle size={9} /> Defect Resolution</span>
                                            <span>{p.resolved_lbd}/{p.total_lbd} resolved</span>
                                        </div>
                                        <ProgressBar value={p.resolved_lbd} max={p.total_lbd} color="bg-amber-500" />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="pt-3 border-t border-slate-700/40 flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-4 text-[10px] text-slate-600">
                                        {p.last_flight_date && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={9} /> Last flight: {new Date(p.last_flight_date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                                            </span>
                                        )}
                                        {p.next_flight_date && (
                                            <span className="flex items-center gap-1 text-sky-400/70">
                                                <Calendar size={9} /> Next: {new Date(p.next_flight_date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                    {(p.open_critical ?? 0) > 0 && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-md">
                                            <Flame size={8} />{p.open_critical} critical open
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {projects.length === 0 && (
                        <div className="text-center py-16 text-slate-600 text-sm border border-slate-800 rounded-2xl">
                            No projects assigned yet. Contact your account manager.
                        </div>
                    )}
                </div>

                {/* Right Column: Weather & LBD Summary */}
                <div className="space-y-4">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Zap size={14} className="text-emerald-400" /> Site Conditions & Tracking
                    </h2>
                    
                    {/* Weather Widget */}
                    <div className="h-64 mb-6">
                        <WeatherWidget />
                    </div>

                    {/* Detailed LBD Summary */}
                    <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl overflow-hidden mt-6">
                        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
                            <AlertTriangle size={14} className="text-amber-400" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">LBD Defect Status</p>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                <span className="text-xs font-black uppercase tracking-widest text-rose-400">Identified</span>
                                <span className="text-lg font-black tabular-nums text-rose-400">{totals.lbd - totals.resolved}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <span className="text-xs font-black uppercase tracking-widest text-amber-400">In Progress</span>
                                <span className="text-lg font-black tabular-nums text-amber-400">{totals.critical}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Resolved</span>
                                <span className="text-lg font-black tabular-nums text-emerald-400">{totals.resolved}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick links */}
                    <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700/40">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick Access</p>
                        </div>
                        {[
                            { label: 'View Inspection Reports', icon: BrainCircuit, path: '/client/reports', accent: 'text-indigo-400' },
                            { label: 'Track Defects', icon: AlertTriangle, path: '/client/lbd', accent: 'text-amber-400' },
                            { label: 'Download Deliverables', icon: Package, path: '/client/deliverables', accent: 'text-violet-400' },
                        ].map(item => (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-slate-700/30 last:border-0 hover:bg-slate-800/40 transition-colors group"
                            >
                                <item.icon size={14} className={item.accent} />
                                <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                                <ChevronRight size={12} className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientOverview;
