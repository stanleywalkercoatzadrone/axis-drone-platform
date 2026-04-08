/**
 * PilotPerformanceSnapshot.tsx
 * Mission Forecasting Engine — Pilot View Enhancement (Phase 5)
 * 
 * Shows pilot their next recommended work window, daily suitability scores,
 * and personal performance snapshot. NO financial exposure data.
 * Non-destructive addition only.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, TrendingDown, Minus, Calendar, Sun, Wind,
    CloudRain, Activity, Target, AlertTriangle, CheckCircle
} from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface Props {
    missionId: string;
    missionTitle?: string;
}

const PilotPerformanceSnapshot: React.FC<Props> = ({ missionId, missionTitle }) => {
    const [windows, setWindows] = useState<any[]>([]);
    const [perf, setPerf] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [winRes, perfRes] = await Promise.all([
                apiClient.get(`/forecast/${missionId}/windows`),
                apiClient.get(`/forecast/${missionId}/performance`).catch(() => ({ data: { performance: null } })),
            ]);
            if (winRes.data.success) setWindows(winRes.data.windows || []);
            if (perfRes.data.success) setPerf(perfRes.data.performance);
        } catch (e: any) {
            setError(e?.message);
        } finally {
            setLoading(false);
        }
    }, [missionId]);

    useEffect(() => { load(); }, [load]);

    const nextWindow = windows[0];
    const fmtDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    const trendColor = perf?.riskTrend === 'improving' ? 'text-emerald-400'
        : perf?.riskTrend === 'declining' ? 'text-red-400' : 'text-amber-400';
    const TrendIcon = perf?.riskTrend === 'improving' ? TrendingUp
        : perf?.riskTrend === 'declining' ? TrendingDown : Minus;

    if (loading) return (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500">Loading performance data…</span>
        </div>
    );

    return (
        <div className="space-y-3">
            {/* Next recommended window */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-violet-400" />
                    Next Recommended Work Window
                </h4>
                {nextWindow ? (
                    <div className={`rounded-xl p-3 border ${nextWindow.recommended ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-white">
                                    {fmtDate(nextWindow.forecast_start_date)} – {fmtDate(nextWindow.forecast_end_date)}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                    {nextWindow.consecutive_days} consecutive days
                                    {nextWindow.recommended && (
                                        <span className="ml-2 text-emerald-400 font-semibold">Recommended</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-xl font-black ${(nextWindow.confidence_score || 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {nextWindow.confidence_score}%
                                </div>
                                <div className="text-[9px] text-slate-500">confidence</div>
                            </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <Sun className="w-3 h-3 text-amber-400" />
                                Weather: {nextWindow.weather_score}/100
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <Target className="w-3 h-3 text-violet-400" />
                                Est. completion: {nextWindow.predicted_completion_rate}%
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-slate-500">
                        No forecast windows available. Ask your admin to generate a forecast.
                    </p>
                )}
            </div>

            {/* Performance snapshot */}
            {perf && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-violet-400" />
                        Performance Snapshot
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-800/60 rounded-xl p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Avg Daily Output</div>
                            <div className="text-base font-black text-white mt-0.5">{perf.avgVelocity} <span className="text-xs font-normal text-slate-400">units/day</span></div>
                        </div>
                        <div className="bg-slate-800/60 rounded-xl p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Completion Rate</div>
                            <div className="text-base font-black text-white mt-0.5">{perf.avgCompletionRate}%</div>
                        </div>
                        <div className="bg-slate-800/60 rounded-xl p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Productivity Trend</div>
                            <div className={`text-base font-black mt-0.5 capitalize flex items-center gap-1 ${trendColor}`}>
                                <TrendIcon className="w-3.5 h-3.5" />{perf.riskTrend}
                            </div>
                        </div>
                        <div className="bg-slate-800/60 rounded-xl p-2.5">
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Projected Capacity</div>
                            <div className="text-base font-black text-white mt-0.5">{perf.projectedDailyCapacity} <span className="text-xs font-normal text-slate-400">units/day</span></div>
                        </div>
                    </div>
                    {perf.delayPatterns?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800">
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Top Delay Factors</div>
                            <div className="flex flex-wrap gap-1.5">
                                {perf.delayPatterns.slice(0, 3).map((d: any, i: number) => (
                                    <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        {d.factor} ({d.percentage}%)
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PilotPerformanceSnapshot;
