import React, { useState, useEffect } from 'react';
import {
    BrainCircuit, X, AlertTriangle, Flame, ShieldAlert,
    Shield, MapPin, Calendar, Loader2, Eye, ChevronRight,
} from 'lucide-react';
import apiClient from '../../../../services/apiClient';
import { AIReportViewer, AIReportData } from '../../../components/AIReportPage';
import { useAuth } from '../../../../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AIReportRow {
    id: string;
    deployment_id: string;
    mission_title: string;
    site_name: string;
    report_data: AIReportData;
    created_at: string;
}

// ── Config ─────────────────────────────────────────────────────────────────────
const RISK_STYLES: Record<string, { badge: string; bar: string; label: string; glow: string }> = {
    low:      { badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', bar: 'bg-emerald-500',  label: 'Low Risk',  glow: 'hover:border-emerald-500/30' },
    medium:   { badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',       bar: 'bg-amber-500',    label: 'Med Risk',  glow: 'hover:border-amber-500/30' },
    high:     { badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400',    bar: 'bg-orange-500',   label: 'High Risk', glow: 'hover:border-orange-500/30' },
    critical: { badge: 'bg-red-500/10 border-red-500/30 text-red-400',             bar: 'bg-red-500',      label: 'Critical',  glow: 'hover:border-red-500/40' },
};

function riskIcon(risk: string) {
    if (risk === 'critical') return Flame;
    if (risk === 'high')     return AlertTriangle;
    if (risk === 'medium')   return ShieldAlert;
    return Shield;
}

function fmt(d: string) {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
}

// ── Report Card ────────────────────────────────────────────────────────────────
const ReportCard: React.FC<{ row: AIReportRow; onView: (r: AIReportRow) => void }> = ({ row, onView }) => {
    const d    = row.report_data;
    const risk = d?.riskLevel ?? 'low';
    const rs   = RISK_STYLES[risk] ?? RISK_STYLES.low;
    const RiskIcon = riskIcon(risk);
    const summary = d?.summary?.slice(0, 120);
    const issueCount = d?.issues?.length ?? 0;

    return (
        <div
            onClick={() => onView(row)}
            className={`bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden cursor-pointer
                        transition-all duration-300 group ${rs.glow} hover:bg-slate-800/60 hover:-translate-y-0.5`}
        >
            {/* Risk color bar */}
            <div className={`h-1 w-full ${rs.bar} opacity-70`} />

            <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                            <BrainCircuit size={16} className="text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-white text-sm leading-tight truncate group-hover:text-indigo-300 transition-colors">
                                {row.site_name || row.mission_title}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={9} /> {row.mission_title}
                            </p>
                        </div>
                    </div>
                    <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase ${rs.badge}`}>
                        <RiskIcon size={10} /> {rs.label}
                    </span>
                </div>

                {/* Summary excerpt */}
                {summary && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{summary}…</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-700/40">
                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                        <span className="flex items-center gap-1">
                            <Calendar size={9} /> {fmt(row.created_at)}
                        </span>
                        {issueCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-500/80">
                                <AlertTriangle size={9} /> {issueCount} finding{issueCount !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-black text-indigo-400 group-hover:text-indigo-300 uppercase tracking-widest transition-colors">
                        View Report <ChevronRight size={10} />
                    </span>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ClientReports: React.FC = () => {
    const { user } = useAuth();
    const [reports, setReports]     = useState<AIReportRow[]>([]);
    const [loading, setLoading]     = useState(true);
    const [selected, setSelected]   = useState<AIReportRow | null>(null);
    const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

    useEffect(() => {
        apiClient.get('/client/ai-reports')
            .then(r => setReports(r.data.data ?? []))
            .catch(() => setReports([]))
            .finally(() => setLoading(false));
    }, []);

    // Close on Escape
    useEffect(() => {
        if (!selected) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selected]);

    const filtered = riskFilter === 'all'
        ? reports
        : reports.filter(r => (r.report_data?.riskLevel ?? 'low') === riskFilter);

    const counts = {
        critical: reports.filter(r => r.report_data?.riskLevel === 'critical').length,
        high:     reports.filter(r => r.report_data?.riskLevel === 'high').length,
        medium:   reports.filter(r => r.report_data?.riskLevel === 'medium').length,
        low:      reports.filter(r => r.report_data?.riskLevel === 'low').length,
    };

    const companyName = user?.companyName || '';

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="text-indigo-400 animate-spin" size={32} />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="p-5 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <BrainCircuit size={24} className="text-indigo-400" /> AI Inspection Reports
                    </h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
                        {companyName ? `${companyName} — ` : ''}AI-generated drone inspection analysis
                    </p>
                </div>

                {/* ── Stats Strip ─────────────────────────────────────────── */}
                {reports.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {([
                            { key: 'critical', label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
                            { key: 'high',     label: 'High Risk', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                            { key: 'medium',   label: 'Med Risk',  color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
                            { key: 'low',      label: 'Low Risk',  color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
                        ] as const).map(s => (
                            <div key={s.key} className={`border rounded-2xl p-4 ${s.bg} cursor-pointer transition-all hover:opacity-80`}
                                onClick={() => setRiskFilter(riskFilter === s.key ? 'all' : s.key)}>
                                <div className={`text-2xl font-black tabular-nums ${s.color}`}>{counts[s.key]}</div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Filter Tabs ─────────────────────────────────────────── */}
                {reports.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {([
                            { key: 'all',      label: `All Reports (${reports.length})` },
                            { key: 'critical', label: `Critical (${counts.critical})` },
                            { key: 'high',     label: `High (${counts.high})` },
                            { key: 'medium',   label: `Medium (${counts.medium})` },
                            { key: 'low',      label: `Low (${counts.low})` },
                        ] as const).map(f => (
                            <button key={f.key} onClick={() => setRiskFilter(f.key)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all
                                    ${riskFilter === f.key
                                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                                        : 'text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Report Grid ──────────────────────────────────────────── */}
                {reports.length === 0 ? (
                    <div className="py-24 text-center border border-slate-800 rounded-2xl flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center">
                            <BrainCircuit size={28} className="text-slate-600" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-base">No reports yet</p>
                            <p className="text-slate-600 text-sm mt-1 max-w-sm mx-auto">
                                AI inspection reports will appear here after each drone survey is processed
                            </p>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center border border-slate-800 rounded-2xl">
                        <p className="text-slate-500 font-semibold text-sm">No reports match this filter</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(row => (
                            <ReportCard key={row.id} row={row} onView={setSelected} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Report Modal ──────────────────────────────────────────────── */}
            {selected && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
                    {/* Modal header bar */}
                    <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <BrainCircuit size={18} className="text-indigo-400 shrink-0" />
                            <div className="min-w-0">
                                <p className="font-black text-white text-sm truncate">{selected.site_name || selected.mission_title}</p>
                                <p className="text-[10px] text-slate-500">{fmt(selected.created_at)}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelected(null)}
                            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0">
                            <X size={16} />
                        </button>
                    </div>
                    {/* Scrollable report content */}
                    <div className="flex-1 overflow-y-auto">
                        <AIReportViewer report={selected.report_data} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientReports;
