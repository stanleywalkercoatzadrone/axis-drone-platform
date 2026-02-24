import React from 'react';
import {
    BarChart3, TrendingUp, AlertTriangle, CheckCircle2,
    FileText, DollarSign, Clock, Zap, Shield, Activity,
    ArrowUpRight, Plus, ChevronRight
} from 'lucide-react';
import { ClaimsReport } from '../EnterpriseAIReporting';

interface Props {
    data: any;
    loading: boolean;
    reports: ClaimsReport[];
    onNewReport: () => void;
    onSelectReport: (r: ClaimsReport) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
    Severe: 'text-red-400 bg-red-500/10 border-red-500/20',
    High: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    Moderate: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    Low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    FINALIZED: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    APPROVED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const ClaimsPortfolioDashboard: React.FC<Props> = ({ data, loading, reports, onNewReport, onSelectReport }) => {
    if (loading) {
        return (
            <div className="grid grid-cols-4 gap-6 animate-pulse">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className={`${i < 4 ? 'col-span-1' : 'col-span-2'} h-40 rounded-2xl bg-slate-800/50`} />
                ))}
            </div>
        );
    }

    const stats = data?.stats || {};
    const riskDist = data?.riskDistribution || [];
    const recentReports = data?.recentReports || reports.slice(0, 8);

    const totalExposure = parseFloat(stats.total_exposure || 0);
    const avgRisk = parseFloat(stats.avg_risk_score || 0);

    const getRiskColor = (score: number) => {
        if (score >= 75) return 'text-red-400';
        if (score >= 50) return 'text-orange-400';
        if (score >= 25) return 'text-yellow-400';
        return 'text-emerald-400';
    };

    const getRiskBg = (score: number) => {
        if (score >= 75) return 'from-red-500/20 to-red-600/5 border-red-500/20';
        if (score >= 50) return 'from-orange-500/20 to-orange-600/5 border-orange-500/20';
        if (score >= 25) return 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/20';
        return 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20';
    };

    return (
        <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    label="Total Reports"
                    value={stats.total_reports || 0}
                    sub={`${stats.finalized || 0} finalized`}
                    icon={<FileText className="w-5 h-5" />}
                    color="blue"
                />
                <KPICard
                    label="Total Exposure"
                    value={`$${totalExposure >= 1000000
                        ? `${(totalExposure / 1000000).toFixed(1)}M`
                        : totalExposure >= 1000
                            ? `${(totalExposure / 1000).toFixed(0)}K`
                            : totalExposure.toFixed(0)}`}
                    sub="estimated damage"
                    icon={<DollarSign className="w-5 h-5" />}
                    color="orange"
                />
                <KPICard
                    label="High Risk Claims"
                    value={stats.high_risk || 0}
                    sub="risk score ≥ 75"
                    icon={<AlertTriangle className="w-5 h-5" />}
                    color="red"
                />
                <KPICard
                    label="Approved"
                    value={stats.approved || 0}
                    sub={`${stats.drafts || 0} pending`}
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    color="emerald"
                />
            </div>

            {/* Risk Score Gauge + Distribution */}
            <div className="grid grid-cols-3 gap-6">
                {/* Portfolio Risk Gauge */}
                <div className={`col-span-1 rounded-2xl bg-gradient-to-br ${getRiskBg(avgRisk)} border p-6 flex flex-col items-center justify-center`}>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Portfolio Risk Score</p>
                    <div className="relative w-32 h-32">
                        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                            <circle
                                cx="60" cy="60" r="50" fill="none"
                                stroke={avgRisk >= 75 ? '#ef4444' : avgRisk >= 50 ? '#f97316' : avgRisk >= 25 ? '#eab308' : '#10b981'}
                                strokeWidth="12"
                                strokeDasharray={`${(avgRisk / 100) * 314} 314`}
                                strokeLinecap="round"
                                className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-3xl font-black ${getRiskColor(avgRisk)}`}>{Math.round(avgRisk)}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">/ 100</span>
                        </div>
                    </div>
                    <p className={`mt-3 text-sm font-bold ${getRiskColor(avgRisk)}`}>
                        {avgRisk >= 75 ? 'SEVERE RISK' : avgRisk >= 50 ? 'HIGH RISK' : avgRisk >= 25 ? 'MODERATE' : 'LOW RISK'}
                    </p>
                </div>

                {/* Risk Distribution */}
                <div className="col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800/60 p-6">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Risk Distribution</p>
                    <div className="space-y-3">
                        {['Severe', 'High', 'Moderate', 'Low'].map(level => {
                            const item = riskDist.find((r: any) => r.risk_level === level);
                            const count = parseInt(item?.count || 0);
                            const total = parseInt(stats.total_reports || 1);
                            const pct = total > 0 ? (count / total) * 100 : 0;
                            return (
                                <div key={level} className="flex items-center gap-4">
                                    <span className={`text-xs font-bold w-16 ${SEVERITY_COLORS[level]?.split(' ')[0]}`}>{level}</span>
                                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${level === 'Severe' ? 'bg-red-500' :
                                                    level === 'High' ? 'bg-orange-500' :
                                                        level === 'Moderate' ? 'bg-yellow-500' : 'bg-emerald-500'
                                                }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-slate-400 font-bold w-8 text-right">{count}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Inspection type breakdown */}
                    <div className="mt-6 pt-5 border-t border-slate-800/60 grid grid-cols-3 gap-3">
                        {[
                            { label: 'Post-Loss', color: 'bg-red-500' },
                            { label: 'Pre-Loss', color: 'bg-blue-500' },
                            { label: 'Underwriting', color: 'bg-purple-500' },
                        ].map(t => (
                            <div key={t.label} className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${t.color}`} />
                                <span className="text-xs text-slate-500 font-medium">{t.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Reports */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent Claims</p>
                    <button
                        onClick={onNewReport}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider transition-all border border-orange-500/20"
                    >
                        <Plus className="w-3 h-3" /> New Claim
                    </button>
                </div>

                {recentReports.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-4 text-slate-600">
                        <Shield className="w-12 h-12 opacity-30" />
                        <p className="text-sm font-semibold">No claims reports yet</p>
                        <button
                            onClick={onNewReport}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-black uppercase tracking-wider"
                        >
                            Create First Report
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800/40">
                        {recentReports.slice(0, 8).map((r: any) => (
                            <button
                                key={r.id}
                                onClick={() => onSelectReport(r)}
                                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-all text-left group"
                            >
                                {/* Risk indicator */}
                                <div className={`w-2 h-10 rounded-full shrink-0 ${r.risk_score >= 75 ? 'bg-red-500' :
                                        r.risk_score >= 50 ? 'bg-orange-500' :
                                            r.risk_score >= 25 ? 'bg-yellow-500' : 'bg-emerald-500'
                                    }`} />

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{r.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                        {r.property_address || r.propertyAddress || 'No address'} · {r.claim_number || r.claimNumber || 'No claim #'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${STATUS_COLORS[r.status] || STATUS_COLORS.DRAFT}`}>
                                        {r.status}
                                    </span>
                                    <span className={`text-xs font-black ${getRiskColor(r.risk_score || r.riskScore || 0)}`}>
                                        {r.risk_score || r.riskScore || 0}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const KPICard: React.FC<{
    label: string; value: string | number; sub: string;
    icon: React.ReactNode; color: 'blue' | 'orange' | 'red' | 'emerald';
}> = ({ label, value, sub, icon, color }) => {
    const colors = {
        blue: 'from-blue-500/15 to-blue-600/5 border-blue-500/20 text-blue-400',
        orange: 'from-orange-500/15 to-orange-600/5 border-orange-500/20 text-orange-400',
        red: 'from-red-500/15 to-red-600/5 border-red-500/20 text-red-400',
        emerald: 'from-emerald-500/15 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    };
    return (
        <div className={`rounded-2xl bg-gradient-to-br ${colors[color]} border p-5`}>
            <div className={`w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center mb-4 ${colors[color].split(' ').pop()}`}>
                {icon}
            </div>
            <p className="text-2xl font-black text-white mb-1">{value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-xs text-slate-600 mt-1">{sub}</p>
        </div>
    );
};

export default ClaimsPortfolioDashboard;
