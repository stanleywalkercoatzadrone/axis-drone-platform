import React from 'react';
import {
    BrainCircuit, AlertTriangle, Flame, ShieldAlert,
    Eye, Calendar, MapPin, ChevronRight
} from 'lucide-react';
import { AIReportData } from '@components/AIReportPage';

export interface AIReportRow {
    id: string;
    deployment_id: string;
    mission_title: string;
    site_name: string;
    report_data: AIReportData;
    created_at: string;
}

export const RISK_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
    low:      { badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', bar: 'bg-emerald-500', label: 'Low Risk' },
    medium:   { badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',       bar: 'bg-amber-500',   label: 'Medium Risk' },
    high:     { badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400',    bar: 'bg-orange-500',  label: 'High Risk' },
    critical: { badge: 'bg-red-500/10 border-red-500/30 text-red-400',             bar: 'bg-red-500',     label: 'Critical' },
};

export function fmt(dt: string) {
    try { return new Date(dt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return dt; }
}

const ReportCard = ({ row, onView }: { row: AIReportRow; onView: (r: AIReportRow) => void }) => {
    const d = row.report_data;
    const risk = d?.riskLevel ?? 'low';
    const rs = RISK_STYLES[risk] ?? RISK_STYLES.low;
    const RiskIcon = risk === 'critical' ? Flame : risk === 'high' ? AlertTriangle : ShieldAlert;

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgba(99,102,241,0.1)] hover:border-indigo-500/30 transition-all duration-300 group">
            {/* Color accent bar */}
            <div className={`h-1 w-full ${rs.bar} opacity-80`} />

            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                            <BrainCircuit size={16} className="text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-white text-sm leading-tight truncate group-hover:text-indigo-50 transition-colors">
                                {row.site_name || row.mission_title}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate font-medium">
                                <MapPin size={10} className="text-slate-600" />{row.mission_title}
                            </p>
                        </div>
                    </div>
                    <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider ${rs.badge} shadow-sm`}>
                        <RiskIcon size={10} />{rs.label}
                    </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/40 rounded-xl p-3 text-center border border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1.5">Issues</p>
                        <p className={`text-2xl font-black tabular-nums drop-shadow-sm ${(d?.totalIssues ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {d?.totalIssues ?? 0}
                        </p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-3 text-center border border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1.5">Risk Score</p>
                        <p className="text-2xl font-black tabular-nums text-white drop-shadow-sm">
                            {d?.riskScore ?? 0}<span className="text-slate-600 text-xs font-bold">/100</span>
                        </p>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-3 text-center border border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-1.5">Max ΔT</p>
                        <p className="text-2xl font-black tabular-nums text-orange-400 drop-shadow-sm">
                            {d?.maxTempDelta != null ? `${d.maxTempDelta}°` : '—'}
                        </p>
                    </div>
                </div>

                {/* Summary snippet */}
                {d?.summary && (
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed font-medium">
                        {d.summary}
                    </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold">
                        <Calendar size={10} className="text-slate-600" /> {fmt(row.created_at)}
                    </span>
                    <button
                        onClick={() => onView(row)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/20 hover:border-indigo-400/40 transition-all shadow-sm group/btn"
                    >
                        <Eye size={12} /> View Report <ChevronRight size={12} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ReportCard;
