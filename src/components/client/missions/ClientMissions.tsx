import React, { useState, useEffect } from 'react';
import {
    Plane, Calendar, MapPin, CheckCircle, Clock, XCircle,
    Loader2, ChevronDown, Filter
} from 'lucide-react';
import apiClient from '../../../../src/services/apiClient';

interface Mission {
    id: string; mission_name: string; site: string;
    flight_date: string | null;
    status: 'scheduled' | 'in_flight' | 'completed' | 'cancelled';
    project_name: string;
}

const MOCK: Mission[] = [
    { id:'1', mission_name:'Block A North Thermal Scan', site:'Riverstart Solar — Indiana', flight_date:'2026-03-05', status:'completed',  project_name:'Riverstart Solar Phase I' },
    { id:'2', mission_name:'Block B RGB Survey',         site:'Riverstart Solar — Indiana', flight_date:'2026-03-07', status:'completed',  project_name:'Riverstart Solar Phase I' },
    { id:'3', mission_name:'Block C Thermal Scan',       site:'Riverstart Solar — Indiana', flight_date:'2026-03-14', status:'scheduled',  project_name:'Riverstart Solar Phase I' },
    { id:'4', mission_name:'Section 1 Full Survey',      site:'Desert Ridge — Arizona',     flight_date:'2026-03-07', status:'completed',  project_name:'Desert Ridge Solar Farm' },
    { id:'5', mission_name:'Section 2 Thermal',          site:'Desert Ridge — Arizona',     flight_date:'2026-03-10', status:'in_flight',  project_name:'Desert Ridge Solar Farm' },
];

const STATUS_CFG = {
    completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Completed' },
    in_flight:  { icon: Plane,       color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/30',         label: 'In Flight' },
    scheduled:  { icon: Clock,       color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     label: 'Scheduled' },
    cancelled:  { icon: XCircle,     color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',       label: 'Cancelled' },
};

const ClientMissions: React.FC = () => {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [filter, setFilter] = useState<'all' | Mission['status']>('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/client/missions')
            .then(r  => setMissions(r.data.data ?? []))
            .catch(() => setMissions(MOCK))
            .finally(() => setLoading(false));
    }, []);

    const filtered = missions.filter(m => {
        if (filter !== 'all' && m.status !== filter) return false;
        if (search && !m.mission_name.toLowerCase().includes(search.toLowerCase()) &&
            !m.project_name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });
    const counts = missions.reduce((acc, m) => { acc[m.status] = (acc[m.status] ?? 0) + 1; return acc; }, {} as Record<string,number>);
    const totalDone = counts['completed'] ?? 0;
    const overallPct = missions.length > 0 ? Math.round((totalDone / missions.length) * 100) : 0;

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="text-emerald-400 animate-spin" size={32} /></div>;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <Plane size={24} className="text-sky-400" /> Flight Missions
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Mission history for your projects</p>
            </div>

            {/* Overall timeline bar */}
            {missions.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                        <span>Overall Mission Progress</span>
                        <span>{totalDone} of {missions.length} completed</span>
                    </div>
                    <div className="w-full bg-slate-700/40 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 h-3 rounded-full transition-all duration-700 relative"
                            style={{ width: `${overallPct}%` }}>
                            <div className="absolute inset-0 bg-white/10 animate-pulse rounded-full" />
                        </div>
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-slate-600 font-bold">
                        <span>0%</span><span className="text-emerald-400 font-black">{overallPct}%</span><span>100%</span>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <Filter size={12} className="text-slate-500" />
                {(['all', 'completed', 'scheduled', 'in_flight', 'cancelled'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border
                            ${filter === f
                                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                                : 'text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'}`}>
                        {f === 'all' ? `All (${missions.length})` : `${f.replace('_', ' ')} (${counts[f] ?? 0})`}
                    </button>
                ))}
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search missions…"
                    className="ml-auto px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 w-44" />
            </div>

            {/* Mission cards */}
            <div className="grid gap-3">
                {filtered.map(m => {
                    const cfg = STATUS_CFG[m.status] ?? STATUS_CFG.scheduled;
                    const Icon = cfg.icon;
                    return (
                        <div key={m.id} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-600/60 transition-all duration-300">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                <Icon size={18} className={cfg.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-white text-sm truncate">{m.mission_name}</h3>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <MapPin size={9} />{m.site}
                                    </span>
                                    <span className="text-[10px] text-slate-600">·</span>
                                    <span className="text-[10px] text-slate-500">{m.project_name}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border rounded-lg ${cfg.bg} ${cfg.color}`}>
                                    <Icon size={9} />{cfg.label}
                                </span>
                                <div className="text-[10px] text-slate-600 mt-1.5 flex items-center gap-1 justify-end">
                                    <Calendar size={9} />
                                    {m.flight_date ? new Date(m.flight_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'TBD'}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="py-20 text-center text-slate-600 text-sm">No missions found for this filter</div>
                )}
            </div>
        </div>
    );
};

export default ClientMissions;
