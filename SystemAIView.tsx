import React, { useState, useEffect } from 'react';
import {
    BrainCircuit,
    Zap,
    Activity,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    FileText,
    TrendingUp,
    ShieldCheck
} from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface SystemAIViewProps {
    aiSensitivity: number;
    onSensitivityChange: (value: number) => void;
}

const SystemAIView: React.FC<SystemAIViewProps> = ({ aiSensitivity, onSensitivityChange }) => {
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [health, setHealth] = useState<any>(null);

    useEffect(() => {
        fetchHealth();
        fetchDailySummary();
    }, []);

    const fetchHealth = async () => {
        try {
            const res = await apiClient.get('/v1/health');
            if (res.data.success) setHealth(res.data.data);
        } catch (err) {
            console.error('Failed to fetch AI health', err);
        }
    };

    const fetchDailySummary = async () => {
        setIsLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await apiClient.get(`/v1/analyze/daily-summary?date=${today}`);
            if (res.data.success) {
                setSummary(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch AI summary', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* AI Status Header */}
            <div className="bg-slate-900 rounded-xl p-8 text-white relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <BrainCircuit className="w-6 h-6 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold">AI Intelligence Engine</h2>
                        </div>
                        <p className="text-slate-400 text-sm max-w-md">
                            Advanced reasoning for daily operations, anomaly detection, and mission forensics.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-center backdrop-blur-sm">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Status</p>
                            <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {health?.aiAvailable ? 'ONLINE' : 'ACTIVE'}
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-center backdrop-blur-sm">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Model</p>
                            <p className="text-sm font-bold">Gemini 1.5 Pro</p>
                        </div>
                    </div>
                </div>

                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-32 -mt-32" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Daily Operational Summary (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-500" />
                                <h3 className="font-bold text-slate-800">Operational Daily Summary</h3>
                            </div>
                            <button
                                onClick={fetchDailySummary}
                                disabled={isLoading}
                                className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="p-6">
                            {isLoading ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-4 text-slate-400">
                                    <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin" />
                                    <p className="text-sm font-medium">Synthesizing operation logs...</p>
                                </div>
                            ) : summary ? (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <ShieldCheck className="w-3.5 h-3.5" /> Work Completed
                                        </h4>
                                        <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            {summary.workCompleted}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <TrendingUp className="w-3.5 h-3.5" /> Overrun Alerts
                                            </h4>
                                            <div className={`p-4 rounded-lg border text-sm ${summary.overrunAlerts?.toLowerCase().includes('none') ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                                {summary.overrunAlerts}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Activity className="w-3.5 h-3.5" /> Next Steps
                                            </h4>
                                            <p className="text-slate-700 text-sm italic">
                                                {summary.recommendations}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <BrainCircuit className="w-8 h-8 text-slate-200" />
                                    </div>
                                    <h3 className="text-slate-400 font-medium">No operational data found for today.</h3>
                                    <p className="text-xs text-slate-400 mt-1">Complete a mission day to generate analysis.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* AI Configuration Side (1/3 width) */}
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" /> Sensitivity Calibration
                        </h3>

                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-black text-slate-900">{aiSensitivity}%</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detection Precision</p>
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${aiSensitivity > 80 ? 'bg-red-50 text-red-700' : aiSensitivity > 40 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {aiSensitivity > 80 ? 'High Recall' : aiSensitivity > 40 ? 'Balanced' : 'Low Noise'}
                                </div>
                            </div>

                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={aiSensitivity}
                                onChange={(e) => onSensitivityChange(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />

                            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                <p className="text-[11px] text-blue-800 leading-relaxed">
                                    <span className="font-bold">Note:</span> Increasing sensitivity improves detection of subtle anomalies but may generate more "Review Required" flags on low-contrast imagery.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                            <Activity className="w-4 h-4 text-slate-400" /> Recent Activity
                        </h3>
                        <div className="space-y-3">
                            {[
                                { action: 'Inspection Analysis', result: '94% Confidence', time: '2h ago' },
                                { action: 'Mission Readiness', result: 'Pass (3 Flags)', time: '5h ago' },
                                { action: 'Daily Summary', result: 'Generated', time: '8h ago' }
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-xs py-2 border-b border-slate-100 last:border-0">
                                    <div>
                                        <p className="font-bold text-slate-700">{item.action}</p>
                                        <p className="text-slate-500">{item.result}</p>
                                    </div>
                                    <span className="text-slate-400 font-mono italic">{item.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemAIView;
