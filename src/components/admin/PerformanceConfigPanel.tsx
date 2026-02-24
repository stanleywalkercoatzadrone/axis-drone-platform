import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Star, ClipboardCheck, BarChart3, Navigation2, Zap, AlertTriangle, Save, RefreshCcw } from 'lucide-react';
import apiClient from '../../services/apiClient';

interface PerformanceMetric {
    id: string;
    label: string;
    description: string;
    icon: any;
    enabledKey: string;
    weightKey: string;
    color: string;
}

const METRICS: PerformanceMetric[] = [
    { id: 'acceptance', label: 'Acceptance Rate', description: 'Percentage of offered jobs accepted by pilot.', icon: BarChart3, enabledKey: 'acceptance_enabled', weightKey: 'acceptance_weight', color: 'blue' },
    { id: 'completion', label: 'Completion Rate', description: 'Percentage of accepted jobs successfully completed.', icon: ClipboardCheck, enabledKey: 'completion_enabled', weightKey: 'completion_weight', color: 'emerald' },
    { id: 'qa', label: 'QA Quality', description: 'Average score from internal quality reviews.', icon: ShieldCheck, enabledKey: 'qa_enabled', weightKey: 'qa_weight', color: 'purple' },
    { id: 'rating', label: 'Client Rating', description: 'Average rating provided by end-clients.', icon: Star, enabledKey: 'rating_enabled', weightKey: 'rating_weight', color: 'amber' },
    { id: 'reliability', label: 'Reliability Index', description: 'Penalty-based score for no-shows and lapses.', icon: AlertTriangle, enabledKey: 'reliability_enabled', weightKey: 'reliability_weight', color: 'rose' },
    { id: 'travel', label: 'Travel Efficiency (V2)', description: 'Score based on distance travel vs regional average.', icon: Navigation2, enabledKey: 'travel_enabled', weightKey: 'travel_weight', color: 'indigo' },
    { id: 'speed', label: 'Speed Score (V2)', description: 'Response time and deliverable upload speed.', icon: Zap, enabledKey: 'speed_enabled', weightKey: 'speed_weight', color: 'cyan' }
];

const SAMPLE_PILOT = {
    acceptance: 95,
    completion: 90,
    qa: 85,
    rating: 92,
    reliability: 100,
    travel: 70,
    speed: 80
};

export const PerformanceConfigPanel: React.FC = () => {
    const [config, setConfig] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewScore, setPreviewScore] = useState(0);

    useEffect(() => {
        fetchConfig();
    }, []);

    useEffect(() => {
        calculatePreview();
    }, [config]);

    const fetchConfig = async () => {
        try {
            const res = await apiClient.get('/personnel/performance/config');
            setConfig(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch performance config', err);
        }
    };

    const calculatePreview = () => {
        if (!config) return;
        let totalWeightedScore = 0;
        let totalWeight = 0;

        METRICS.forEach(m => {
            if (config[m.enabledKey]) {
                const weight = parseInt(config[m.weightKey]) || 0;
                const pilotScore = (SAMPLE_PILOT as any)[m.id] || 0;
                totalWeightedScore += (pilotScore * weight);
                totalWeight += weight;
            }
        });

        const final = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
        setPreviewScore(final);
    };

    const handleSave = async () => {
        const totalWeight = METRICS.reduce((sum, m) => sum + (config[m.enabledKey] ? (parseInt(config[m.weightKey]) || 0) : 0), 0);

        if (totalWeight !== 100) {
            alert(`Total weight must equal 100. Current total: ${totalWeight}`);
            return;
        }

        setSaving(true);
        try {
            await apiClient.put('/personnel/performance/config', config);
            alert('Performance configuration saved successfully');
        } catch (err) {
            console.error('Failed to save config', err);
            alert('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const updateWeight = (key: string, val: number) => {
        setConfig({ ...config, [key]: val });
    };

    const toggleMetric = (key: string) => {
        setConfig({ ...config, [key]: !config[key] });
    };

    if (loading) return <div className="p-8 flex justify-center"><RefreshCcw className="w-6 h-6 animate-spin text-slate-400" /></div>;

    const totalWeight = METRICS.reduce((sum, m) => sum + (config[m.enabledKey] ? (parseInt(config[m.weightKey]) || 0) : 0), 0);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-slate-400" /> Axis Performance Index (API Score)
                        </h3>
                        <p className="text-slate-500 text-sm">Tune the weighting engine used for pilot auto-assignment and tier leveling.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${totalWeight === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            Total Weight: {totalWeight}/100
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-slate-950 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Rules
                        </button>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        {METRICS.map(metric => {
                            const isEnabled = config[metric.enabledKey];
                            const weight = config[metric.weightKey] || 0;

                            return (
                                <div key={metric.id} className={`p-4 rounded-xl border transition-all ${isEnabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${metric.color}-50 text-${metric.color}-600`}>
                                                <metric.icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-sm">{metric.label}</h4>
                                                <p className="text-[11px] text-slate-500">{metric.description}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleMetric(metric.enabledKey)}
                                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {isEnabled && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                <span>Weight Influence</span>
                                                <span className="text-slate-900">{weight}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={weight}
                                                onChange={(e) => updateWeight(metric.weightKey, parseInt(e.target.value))}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-950 rounded-2xl p-8 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <BarChart3 className="w-32 h-32" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                                    <Zap className="w-3 h-3 text-amber-400" /> Score Preview Engine
                                </div>
                                <h4 className="text-xl font-bold mb-1">Live Simulation</h4>
                                <p className="text-slate-400 text-sm mb-8">How these weights affect a veteran pilot with 90+ across all metrics.</p>

                                <div className="flex items-end gap-4 mb-2">
                                    <span className="text-7xl font-black">{previewScore}</span>
                                    <span className="text-2xl text-slate-500 font-bold mb-3">/ 100</span>
                                </div>

                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-8">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700 ease-out"
                                        style={{ width: `${previewScore}%` }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Assigned Tier</div>
                                        <div className={`text-lg font-black ${previewScore >= 90 ? 'text-amber-400' : previewScore >= 80 ? 'text-slate-300' : 'text-orange-500'}`}>
                                            {previewScore >= 90 ? 'Gold' : previewScore >= 80 ? 'Silver' : 'Bronze'} Pilot
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Fit Calculation</div>
                                        <div className="text-lg font-black text-blue-400">
                                            {previewScore >= 70 ? 'Eligible' : 'At Risk'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
                            <h5 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4" /> Global Selection Policy
                            </h5>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                    </div>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        Pilots with a <strong>Reliability Index</strong> below 70 are automatically removed from the auto-assignment pool regardless of other metrics.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                    </div>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        Weights must sum to exactly 100 to ensure a normalized platform-wide scoring standard.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
