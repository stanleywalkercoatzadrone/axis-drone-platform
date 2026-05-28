import React, { useState, useEffect } from 'react';
import {
    AlertTriangle, CheckCircle, Clock, Search, Loader2,
    BarChart3, Filter, ArrowUpDown, Calendar, Tag, Layers,
} from 'lucide-react';
import apiClient from '../../../../services/apiClient';
import { useAuth } from '../../../../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LBDIssue {
    id: string;
    block: string | null;
    row: string | null;
    issue_type: string;
    status: 'identified' | 'in_progress' | 'resolved';
    confidence: number;
    resolved_date: string | null;
    created_at: string;
    mission_name: string;
    project_name: string;
}

interface LBDStats {
    total: number;
    resolved: number;
    inProgress: number;
    identified: number;
}

// ── Config ─────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
    resolved:    { label: 'Resolved',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
    in_progress: { label: 'In Progress', color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/30',         icon: Clock },
    identified:  { label: 'Identified',  color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',       icon: AlertTriangle },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(d: string) {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
}

// ── Confidence Bar ─────────────────────────────────────────────────────────────
function ConfBar({ pct }: { pct: number }) {
    const color = pct >= 85 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500';
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[48px]">
                <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-black tabular-nums text-slate-400 shrink-0">{pct}%</span>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const ClientLBD: React.FC = () => {
    const { user } = useAuth();
    const [issues, setIssues] = useState<LBDIssue[]>([]);
    const [stats, setStats]   = useState<LBDStats>({ total: 0, resolved: 0, inProgress: 0, identified: 0 });
    const [filter, setFilter] = useState<'all' | 'identified' | 'in_progress' | 'resolved'>('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [sortField, setSortField] = useState<'created_at' | 'confidence' | 'status'>('created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        apiClient.get('/client/lbd')
            .then(r => {
                setIssues(r.data.data ?? []);
                setStats(r.data.stats ?? { total: 0, resolved: 0, inProgress: 0, identified: 0 });
            })
            .catch(() => {
                setIssues([]);
                setStats({ total: 0, resolved: 0, inProgress: 0, identified: 0 });
            })
            .finally(() => setLoading(false));
    }, []);

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const filtered = issues
        .filter(i => {
            if (filter !== 'all' && i.status !== filter) return false;
            const q = search.toLowerCase();
            if (!q) return true;
            return (
                i.issue_type.toLowerCase().includes(q) ||
                (i.block || '').toLowerCase().includes(q) ||
                i.project_name.toLowerCase().includes(q) ||
                i.mission_name.toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            const mul = sortDir === 'asc' ? 1 : -1;
            if (sortField === 'confidence') return mul * (a.confidence - b.confidence);
            if (sortField === 'status') return mul * a.status.localeCompare(b.status);
            return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

    const resPct = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
    const companyName = user?.companyName || '';

    // ── KPI Cards data ─────────────────────────────────────────────────────────
    const kpis = [
        { label: 'Total Defects',  value: stats.total,      color: 'text-slate-200',   bg: 'bg-slate-800/60 border-slate-700/40', icon: BarChart3 },
        { label: 'Identified',     value: stats.identified, color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20',   icon: AlertTriangle },
        { label: 'In Progress',    value: stats.inProgress, color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20',     icon: Clock },
        { label: 'Resolved',       value: stats.resolved,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
    ];

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="text-amber-400 animate-spin" size={32} />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="p-5 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <BarChart3 size={24} className="text-amber-400" /> Defect Tracking
                    </h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                        {companyName ? `${companyName} — ` : ''}LBD issue tracking across all projects
                    </p>
                </div>

                {/* ── KPI Strip ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {kpis.map((k, i) => (
                        <div key={i} className={`border rounded-2xl p-5 ${k.bg}`}>
                            <div className="flex items-center justify-between mb-3">
                                <k.icon size={16} className={k.color} />
                            </div>
                            <div className={`text-3xl font-black tabular-nums mb-1 ${k.color}`}>{k.value}</div>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{k.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Resolution Progress Bar ─────────────────────────────── */}
                {stats.total > 0 && (
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <CheckCircle size={13} className="text-emerald-400" /> Resolution Progress
                            </span>
                            <span className="text-2xl font-black tabular-nums text-emerald-400">{resPct}%</span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-700 relative"
                                style={{ width: `${resPct}%` }}
                            >
                                {resPct > 5 && resPct < 100 && (
                                    <div className="absolute right-0 top-0 h-full w-4 bg-white/20 animate-pulse rounded-full" />
                                )}
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-2">{stats.resolved} of {stats.total} defects resolved</p>
                    </div>
                )}

                {/* ── Filter Bar ─────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search defects, blocks, projects…"
                            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {([
                            { key: 'all',         label: `All (${stats.total})` },
                            { key: 'identified',  label: `Identified (${stats.identified})` },
                            { key: 'in_progress', label: `In Progress (${stats.inProgress})` },
                            { key: 'resolved',    label: `Resolved (${stats.resolved})` },
                        ] as const).map(f => (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap
                                    ${filter === f.key
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                        : 'text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Sort Bar (desktop) ──────────────────────────────────── */}
                {filtered.length > 0 && (
                    <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-600">
                        <Filter size={11} /> Sort by:
                        {([
                            { field: 'created_at' as const,  label: 'Date' },
                            { field: 'confidence' as const,  label: 'Confidence' },
                            { field: 'status' as const,      label: 'Status' },
                        ]).map(s => (
                            <button key={s.field} onClick={() => toggleSort(s.field)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all
                                    ${sortField === s.field
                                        ? 'bg-slate-700 border-slate-600 text-slate-300'
                                        : 'border-slate-800 text-slate-600 hover:text-slate-400 hover:border-slate-700'}`}>
                                {s.label}
                                {sortField === s.field && <ArrowUpDown size={9} className={sortDir === 'asc' ? 'rotate-180' : ''} />}
                            </button>
                        ))}
                        <span className="ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                    </div>
                )}

                {/* ── Issue List ──────────────────────────────────────────── */}
                {filtered.length === 0 ? (
                    <div className="py-20 text-center border border-slate-800 rounded-2xl">
                        <CheckCircle size={32} className="text-emerald-600 mx-auto mb-3" />
                        <p className="text-white font-bold text-sm">
                            {search || filter !== 'all' ? 'No defects match your filter' : 'No defects found'}
                        </p>
                        <p className="text-slate-600 text-xs mt-1">
                            {search || filter !== 'all'
                                ? 'Try adjusting your search or filter'
                                : 'All clear — no LBD issues have been recorded for your projects'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700/60">
                                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Issue</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Location</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Project</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Confidence</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((issue, i) => {
                                        const cfg = STATUS_CFG[issue.status] ?? STATUS_CFG.identified;
                                        const StatusIcon = cfg.icon;
                                        return (
                                            <tr key={issue.id}
                                                className={`border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <Tag size={12} className="text-slate-600 shrink-0" />
                                                        <span className="font-semibold text-white capitalize">{issue.issue_type.replace(/_/g, ' ')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {issue.block || issue.row ? (
                                                        <span className="text-slate-400 text-xs">
                                                            {issue.block ? `Block ${issue.block}` : ''}
                                                            {issue.block && issue.row ? ' · ' : ''}
                                                            {issue.row ? `Row ${issue.row}` : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-700 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="min-w-0">
                                                        <p className="text-slate-300 text-xs font-semibold truncate max-w-[160px]">{issue.project_name}</p>
                                                        <p className="text-slate-600 text-[10px] truncate max-w-[160px]">{issue.mission_name}</p>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 min-w-[120px]">
                                                    <ConfBar pct={issue.confidence} />
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border rounded-lg ${cfg.bg} ${cfg.color}`}>
                                                        <StatusIcon size={9} />
                                                        {cfg.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <Calendar size={9} /> {fmt(issue.created_at)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {filtered.map(issue => {
                                const cfg = STATUS_CFG[issue.status] ?? STATUS_CFG.identified;
                                const StatusIcon = cfg.icon;
                                return (
                                    <div key={issue.id} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-white capitalize leading-tight">{issue.issue_type.replace(/_/g, ' ')}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                    <Layers size={9} />
                                                    {issue.block ? `Block ${issue.block}` : ''}{issue.block && issue.row ? ' · ' : ''}{issue.row ? `Row ${issue.row}` : ''}
                                                    {!issue.block && !issue.row && 'No location'}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-black uppercase tracking-widest border rounded-lg ${cfg.bg} ${cfg.color}`}>
                                                <StatusIcon size={8} />
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <ConfBar pct={issue.confidence} />
                                        <div className="flex items-center justify-between text-[10px] text-slate-600">
                                            <span className="truncate max-w-[200px]">{issue.project_name}</span>
                                            <span className="flex items-center gap-1 shrink-0 ml-2">
                                                <Calendar size={9} /> {fmt(issue.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ClientLBD;
