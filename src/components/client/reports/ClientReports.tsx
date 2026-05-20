import React, { useState, useEffect, useCallback } from 'react';
import {
    BrainCircuit, RefreshCw, Loader2, AlertTriangle, Flame,
    ShieldAlert, Eye, Calendar, MapPin, Download, FileText,
    ChevronRight, Zap, CheckCircle, Clock,
} from 'lucide-react';
import apiClient from '../../../../services/apiClient';
import { AIReportViewer, AIReportData } from '../../../components/AIReportPage';

interface AIReportRow {
    id: string;
    deployment_id: string;
    mission_title: string;
    site_name: string;
    report_data: AIReportData;
    created_at: string;
}

const RISK_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
    low:      { badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', bar: 'bg-emerald-500', label: 'Low Risk' },
    medium:   { badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',       bar: 'bg-amber-500',   label: 'Medium Risk' },
    high:     { badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400',    bar: 'bg-orange-500',  label: 'High Risk' },
    critical: { badge: 'bg-red-500/10 border-red-500/30 text-red-400',             bar: 'bg-red-500',     label: 'Critical' },
};

function fmt(dt: string) {
    try { return new Date(dt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return dt; }
}

function ReportCard({ row, onView }: { row: AIReportRow; onView: (r: AIReportRow) => void }) {
    const d = row.report_data;
    const risk = d?.riskLevel ?? 'low';
    const rs = RISK_STYLES[risk] ?? RISK_STYLES.low;
    const RiskIcon = risk === 'critical' ? Flame : risk === 'high' ? AlertTriangle : ShieldAlert;

    return (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-300 group">
            {/* Color accent bar */}
            <div className={`h-1 w-full ${rs.bar} opacity-60`} />

            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                            <BrainCircuit size={16} className="text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-white text-sm leading-tight truncate">
                                {row.site_name || row.mission_title}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={9} />{row.mission_title}
                            </p>
                        </div>
                    </div>
                    <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase ${rs.badge}`}>
                        <RiskIcon size={10} />{rs.label}
                    </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                        <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wider mb-1">Issues</p>
                        <p className={`text-2xl font-black tabular-nums ${(d?.totalIssues ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {d?.totalIssues ?? 0}
                        </p>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                        <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wider mb-1">Risk Score</p>
                        <p className="text-2xl font-black tabular-nums text-white">
                            {d?.riskScore ?? 0}<span className="text-slate-600 text-sm">/100</span>
                        </p>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
                        <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wider mb-1">Max ΔT</p>
                        <p className="text-2xl font-black tabular-nums text-orange-400">
                            {d?.maxTempDelta != null ? `${d.maxTempDelta}°` : '—'}
                        </p>
                    </div>
                </div>

                {/* Summary snippet */}
                {d?.summary && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {d.summary}
                    </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
                    <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Calendar size={9} /> {fmt(row.created_at)}
                    </span>
                    <button
                        onClick={() => onView(row)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 transition-colors group-hover:border-indigo-400/40"
                    >
                        <Eye size={11} /> View Report <ChevronRight size={10} />
                    </button>
                </div>
            </div>
        </div>
    );
}

const ClientReports: React.FC = () => {
    const [reports, setReports] = useState<AIReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewing, setViewing] = useState<AIReportRow | null>(null);
    const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/client/ai-reports');
            setReports(r.data?.data ?? []);
        } catch {
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (viewing) {
        return (
            <AIReportViewer
                report={viewing.report_data}
                onBack={() => setViewing(null)}
            />
        );
    }

    const filtered = reports.filter(r =>
        filter === 'all' || (r.report_data?.riskLevel ?? 'low') === filter
    );

    const counts = {
        all: reports.length,
        critical: reports.filter(r => r.report_data?.riskLevel === 'critical').length,
        high: reports.filter(r => r.report_data?.riskLevel === 'high').length,
        medium: reports.filter(r => r.report_data?.riskLevel === 'medium').length,
        low: reports.filter(r => r.report_data?.riskLevel === 'low').length,
    };

    const totalIssues = reports.reduce((n, r) => n + (r.report_data?.totalIssues ?? 0), 0);
    const criticalCount = counts.critical + counts.high;
    const latestReport = reports[0];

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">

            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <BrainCircuit size={24} className="text-indigo-400" /> Inspection Reports
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                        AI-generated · auto-updated after each mission
                    </p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition-colors font-bold"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Summary strip — only show when data exists */}
            {reports.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                        <div className="text-3xl font-black text-white tabular-nums">{reports.length}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Reports</div>
                    </div>
                    <div className="bg-slate-800/40 border border-amber-500/20 rounded-2xl p-5">
                        <div className="text-3xl font-black text-amber-400 tabular-nums">{totalIssues}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Issues Found</div>
                    </div>
                    <div className={`bg-slate-800/40 border rounded-2xl p-5 ${criticalCount > 0 ? 'border-red-500/30' : 'border-slate-700/40'}`}>
                        <div className={`text-3xl font-black tabular-nums ${criticalCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{criticalCount}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">High/Critical</div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
                        <div className="text-3xl font-black text-slate-300 tabular-nums">
                            {latestReport ? new Date(latestReport.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Latest Report</div>
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            {reports.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'critical', 'high', 'medium', 'low'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border
                                ${filter === f
                                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                                    : 'text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'}`}>
                            {f === 'all' ? `All (${counts.all})` : `${f} (${counts[f]})`}
                        </button>
                    ))}
                </div>
            )}

            {/* Reports grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-64 bg-slate-800/30 border border-slate-700/30 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : filtered.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(r => (
                        <ReportCard key={r.id} row={r} onView={setViewing} />
                    ))}
                </div>
            ) : (
                <div className="py-24 text-center border border-slate-800/50 rounded-2xl bg-slate-900/20 space-y-3">
                    <BrainCircuit size={32} className="text-slate-700 mx-auto" />
                    <p className="text-sm text-slate-500 font-bold">
                        {filter !== 'all' ? `No ${filter} risk reports` : 'No reports yet'}
                    </p>
                    <p className="text-xs text-slate-700 max-w-xs mx-auto">
                        Reports are generated automatically after each drone mission is processed. Check back after your next flight.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ClientReports;
