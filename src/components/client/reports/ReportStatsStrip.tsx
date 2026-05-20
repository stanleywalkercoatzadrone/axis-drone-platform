import React from 'react';

interface ReportStatsStripProps {
    totalReports: number;
    totalIssues: number;
    criticalCount: number;
    latestReportDate: string | null;
}

const ReportStatsStrip: React.FC<ReportStatsStripProps> = ({
    totalReports,
    totalIssues,
    criticalCount,
    latestReportDate
}) => {
    if (totalReports === 0) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-colors">
                <div className="text-4xl font-black text-white tabular-nums drop-shadow-md">{totalReports}</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Total Reports
                </div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-sm hover:border-amber-500/40 transition-colors">
                <div className="text-4xl font-black text-amber-400 tabular-nums drop-shadow-md">{totalIssues}</div>
                <div className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Issues Found
                </div>
            </div>
            <div className={`bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-6 shadow-sm transition-colors ${criticalCount > 0 ? 'border-red-500/30 hover:border-red-500/50' : 'border-emerald-500/30 hover:border-emerald-500/50'}`}>
                <div className={`text-4xl font-black tabular-nums drop-shadow-md ${criticalCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{criticalCount}</div>
                <div className={`text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-1.5 ${criticalCount > 0 ? 'text-red-500/70' : 'text-emerald-500/70'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${criticalCount > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    High/Critical
                </div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-colors">
                <div className="text-3xl font-black text-slate-300 tabular-nums mt-1 drop-shadow-md">
                    {latestReportDate || '—'}
                </div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Latest Report
                </div>
            </div>
        </div>
    );
};

export default ReportStatsStrip;
