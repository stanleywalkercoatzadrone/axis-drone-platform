import React, { useState, useEffect } from 'react';
import {
    AlertTriangle, CheckCircle, Clock, Search, Loader2, BarChart3, Filter
} from 'lucide-react';
import apiClient from '../../../../src/services/apiClient';

interface LBDIssue {
    id: string; block: string | null; row: string | null;
    issue_type: string; status: 'identified' | 'in_progress' | 'resolved';
    resolved_date: string | null; created_at: string;
    mission_name: string; project_name: string;
}
interface LBDStats { total:number; resolved:number; inProgress:number; identified:number; }

const MOCK: LBDIssue[] = [
    { id:'1', block:'A', row:'3', issue_type:'Hotspot', status:'resolved', resolved_date:'2026-03-04', created_at:'2026-03-01', mission_name:'Block A Thermal', project_name:'Riverstart Phase I' },
    { id:'2', block:'B', row:'7', issue_type:'Diode failure', status:'in_progress', resolved_date:null, created_at:'2026-03-02', mission_name:'Block B Survey', project_name:'Riverstart Phase I' },
    { id:'3', block:'C', row:'1', issue_type:'Soiling', status:'identified', resolved_date:null, created_at:'2026-03-03', mission_name:'Block C Thermal', project_name:'Riverstart Phase I' },
    { id:'4', block:'1', row:'2', issue_type:'Hotspot', status:'resolved', resolved_date:'2026-03-06', created_at:'2026-03-04', mission_name:'Section 1 Survey', project_name:'Desert Ridge' },
];
const STATUS_CFG = {
    resolved:    { label:'Resolved',    color:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
    in_progress: { label:'In Progress', color:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/30',   icon: Clock },
    identified:  { label:'Identified',  color:'text-rose-400',    bg:'bg-rose-500/10 border-rose-500/30',     icon: AlertTriangle },
};

function DonutRing({ pct, size=80, stroke=8, color='#10b981' }: { pct:number; size?:number; stroke?:number; color?:string }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
        <svg width={size} height={size} className="-rotate-90">
            <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} stroke="#1e293b" />
            <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} stroke={color}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.7s ease' }} />
        </svg>
    );
}

const ClientLBD: React.FC = () => {
    const [issues, setIssues] = useState<LBDIssue[]>([]);
    const [stats, setStats] = useState<LBDStats>({ total:0, resolved:0, inProgress:0, identified:0 });
    const [filter, setFilter] = useState<'all'|'identified'|'in_progress'|'resolved'>('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/client/lbd')
            .then(r => { setIssues(r.data.data ?? []); setStats(r.data.stats ?? { total:0, resolved:0, inProgress:0, identified:0 }); })
            .catch(() => {
                setIssues(MOCK);
                const t=MOCK.length, res=MOCK.filter(x=>x.status==='resolved').length;
                setStats({ total:t, resolved:res, inProgress:MOCK.filter(x=>x.status==='in_progress').length, identified:MOCK.filter(x=>x.status==='identified').length });
            })
            .finally(() => setLoading(false));
    }, []);

    const filtered = issues.filter(i => {
        if (filter !== 'all' && i.status !== filter) return false;
        const q = search.toLowerCase();
        if (q && !i.issue_type.toLowerCase().includes(q) && !(i.block||'').toLowerCase().includes(q) && !i.project_name.toLowerCase().includes(q)) return false;
        return true;
    });
    const resPct = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="text-emerald-400 animate-spin" size={32} /></div>;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <BarChart3 size={24} className="text-amber-400" /> LBD Progress
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Low-Bidder Deficiency tracking across all projects</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Donut */}
                <div className="md:col-span-1 bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5 flex flex-col items-center justify-center gap-2">
                    <div className="relative">
                        <DonutRing pct={resPct} size={90} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xl font-black text-white">{resPct}%</span>
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resolution Rate</span>
                </div>
                {/* Stat cards */}
                {[
                    { label:'Total Found',  value:stats.total,       color:'text-white',         border:'border-slate-700/50' },
                    { label:'Resolved',     value:stats.resolved,    color:'text-emerald-400',   border:'border-emerald-500/20' },
                    { label:'In Progress',  value:stats.inProgress,  color:'text-amber-400',     border:'border-amber-500/20' },
                    // { label:'Identified', value:stats.identified, color:'text-rose-400', border:'border-rose-500/20' },
                ].map(s => (
                    <div key={s.label} className={`bg-slate-800/40 border ${s.border} rounded-2xl p-5 flex flex-col justify-center`}>
                        <div className={`text-3xl font-black tabular-nums ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{s.label}</div>
                    </div>
                ))}
                <div className="bg-slate-800/40 border border-rose-500/20 rounded-2xl p-5 flex flex-col justify-center">
                    <div className="text-3xl font-black tabular-nums text-rose-400">{stats.identified}</div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Identified</div>
                </div>
            </div>

            {/* Filters + table */}
            <div className="flex flex-wrap gap-2 items-center">
                <Filter size={12} className="text-slate-500" />
                {(['all','identified','in_progress','resolved'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border
                            ${filter===f ? 'bg-amber-600/20 text-amber-400 border-amber-500/40' : 'text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'}`}>
                        {f.replace('_',' ')}
                    </button>
                ))}
                <div className="relative ml-auto">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search issues…"
                        className="pl-7 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 w-40" />
                </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                {['Status','Issue Type','Block','Project','Mission','Found','Resolved'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((issue, i) => {
                                const cfg = STATUS_CFG[issue.status] ?? STATUS_CFG.identified;
                                const Icon = cfg.icon;
                                return (
                                    <tr key={issue.id} className={`border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors ${i%2===0?'':'bg-slate-900/20'}`}>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border rounded-md ${cfg.bg} ${cfg.color}`}>
                                                <Icon size={9} />{cfg.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-bold text-white">{issue.issue_type}</td>
                                        <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{issue.block ?? '—'}{issue.row ? `-${issue.row}` : ''}</td>
                                        <td className="px-5 py-3.5 text-xs text-slate-400">{issue.project_name}</td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[160px] truncate">{issue.mission_name}</td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(issue.created_at).toLocaleDateString()}</td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500">{issue.resolved_date ? new Date(issue.resolved_date).toLocaleDateString() : '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <div className="py-16 text-center text-slate-600 text-sm">No issues found</div>}
                </div>
            </div>
        </div>
    );
};

export default ClientLBD;
