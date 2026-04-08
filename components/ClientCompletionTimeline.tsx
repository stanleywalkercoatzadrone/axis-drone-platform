/**
 * ClientCompletionTimeline.tsx
 * Mission Forecasting Engine — Client View Enhancement (Phase 6)
 * 
 * Shows clients their projected completion window, confidence rating,
 * and weather impact notice. NO internal performance diagnostics.
 * Non-destructive addition only.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CloudRain, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface Props {
    missionId: string;
    missionTitle?: string;
}

const ClientCompletionTimeline: React.FC<Props> = ({ missionId, missionTitle }) => {
    const [windows, setWindows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/forecast/${missionId}/windows`);
            if (res.data.success) setWindows(res.data.windows || []);
        } catch { /* no forecast yet */ }
        finally { setLoading(false); }
    }, [missionId]);

    useEffect(() => { load(); }, [load]);

    const bestWindow = windows.find(w => w.recommended) || windows[0];
    const fmtDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-US', {
        month: 'long', day: 'numeric'
    });

    if (loading) return (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Loading completion forecast…</span>
        </div>
    );

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-4">
                <div className="flex items-center gap-2 text-white">
                    <Calendar className="w-4 h-4" />
                    <h3 className="text-sm font-bold">Projected Completion Timeline</h3>
                </div>
                {missionTitle && (
                    <p className="text-blue-100 text-xs mt-0.5 truncate">{missionTitle}</p>
                )}
            </div>

            <div className="p-5 space-y-4">
                {bestWindow ? (
                    <>
                        {/* Estimated completion window */}
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Estimated Work Window</div>
                                <div className="text-base font-bold text-slate-800">
                                    {fmtDate(bestWindow.forecast_start_date)} – {fmtDate(bestWindow.forecast_end_date)}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {bestWindow.consecutive_days} projected operational days
                                </div>
                            </div>
                        </div>

                        {/* Confidence + completion */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence Rating</div>
                                <div className={`text-2xl font-black ${(bestWindow.confidence_score || 0) >= 75 ? 'text-emerald-600' : (bestWindow.confidence_score || 0) >= 55 ? 'text-amber-500' : 'text-slate-500'}`}>
                                    {bestWindow.confidence_score}%
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completion Probability</div>
                                <div className="text-2xl font-black text-blue-600">{bestWindow.predicted_completion_rate}%</div>
                            </div>
                        </div>

                        {/* Weather notice */}
                        <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm ${(bestWindow.weather_score || 0) >= 75 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                            {(bestWindow.weather_score || 0) >= 75
                                ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            }
                            <div>
                                <div className={`font-semibold text-xs ${(bestWindow.weather_score || 0) >= 75 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {(bestWindow.weather_score || 0) >= 75 ? 'Favorable Weather Window' : 'Weather Monitoring Active'}
                                </div>
                                <div className={`text-xs mt-0.5 ${(bestWindow.weather_score || 0) >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {(bestWindow.weather_score || 0) >= 75
                                        ? `Weather conditions look positive for aerial operations (score: ${bestWindow.weather_score}/100)`
                                        : `Weather conditions may affect operations. Our team monitors daily and adjusts scheduling as needed.`}
                                </div>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 text-center">
                            This is a forecast estimate. Actual completion may vary based on site conditions and weather.
                        </p>
                    </>
                ) : (
                    <div className="text-center py-6">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm text-slate-500 font-medium">Completion forecast not yet available</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Your project team is reviewing conditions. Check back soon.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientCompletionTimeline;
