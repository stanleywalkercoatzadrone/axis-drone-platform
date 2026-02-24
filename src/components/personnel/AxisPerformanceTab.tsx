import React, { useState, useEffect } from 'react';
import { BarChart3, Star, ShieldCheck, ClipboardCheck, AlertTriangle, LightbulbIcon, Zap, Loader2, Award, TrendingUp, TrendingDown } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { Heading, Text } from '../../stitch/components/Typography';

interface PerformanceData {
    lifetimeScore: number;
    rollingScore: number;
    tierLevel: string;
    reliabilityFlag: boolean;
    breakdown: any;
    rollingBreakdown: any;
    insights: string[];
}

export const AxisPerformanceTab: React.FC<{ pilotId: string }> = ({ pilotId }) => {
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.get(`/personnel/${pilotId}/performance`);
                setData(res.data);
            } catch (err) {
                console.error('Failed to fetch performance data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [pilotId]);

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-amber-500';
        if (score >= 80) return 'text-slate-400';
        if (score >= 70) return 'text-orange-500';
        return 'text-red-500';
    };

    const getMetricIcon = (metric: string) => {
        switch (metric) {
            case 'acceptance': return <BarChart3 className="w-4 h-4" />;
            case 'completion': return <ClipboardCheck className="w-4 h-4" />;
            case 'qa': return <ShieldCheck className="w-4 h-4" />;
            case 'rating': return <Star className="w-4 h-4" />;
            case 'reliability': return <AlertTriangle className="w-4 h-4" />;
            default: return <Zap className="w-4 h-4" />;
        }
    };

    if (loading) return (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <Text className="text-slate-400 font-medium italic">Calculating Axis Performance Index...</Text>
        </div>
    );

    if (!data) return <div className="p-8 text-center text-slate-500 italic">No performance data available.</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Award className="w-20 h-20" />
                    </div>
                    <div className="relative z-10">
                        <Text variant="small" className="text-slate-400 font-bold uppercase tracking-wider mb-4 block">Axis Performance Index</Text>
                        <div className="flex items-end gap-2">
                            <span className="text-5xl font-black">{data.lifetimeScore}</span>
                            <span className="text-xl text-slate-500 font-bold mb-1">/ 100</span>
                        </div>
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 backdrop-blur-sm">
                            <span className={`w-2 h-2 rounded-full ${data.lifetimeScore >= 70 ? 'bg-emerald-400' : 'bg-red-400 animation-pulse'}`} />
                            <span className="text-xs font-bold">{data.tierLevel.toUpperCase()} TIER</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <Text variant="small" className="text-slate-500 font-bold uppercase tracking-wider mb-4 block">Rolling 30-Day Index</Text>
                    <div className="flex items-end gap-2">
                        <span className="text-5xl font-black text-slate-900">{data.rollingScore}</span>
                        <div className="flex flex-col mb-1">
                            {data.rollingScore > data.lifetimeScore ? (
                                <span className="flex items-center text-xs font-bold text-emerald-600">
                                    <TrendingUp className="w-3 h-3 mr-0.5" /> +{data.rollingScore - data.lifetimeScore}
                                </span>
                            ) : (
                                <span className="flex items-center text-xs font-bold text-red-600">
                                    <TrendingDown className="w-3 h-3 mr-0.5" /> -{data.lifetimeScore - data.rollingScore}
                                </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-bold">vs Lifetime</span>
                        </div>
                    </div>
                    <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${data.rollingScore}%` }} />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <Text variant="small" className="text-slate-500 font-bold uppercase tracking-wider mb-4 block">Reliability Status</Text>
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${data.reliabilityFlag ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {data.reliabilityFlag ? <ShieldCheck className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                        </div>
                        <div>
                            <span className={`text-xl font-black ${data.reliabilityFlag ? 'text-emerald-700' : 'text-red-700'}`}>
                                {data.reliabilityFlag ? 'Qualified' : 'Restricted'}
                            </span>
                            <p className="text-xs text-slate-500 font-medium">Auto-assignment status.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <Heading level={4} className="text-sm font-bold text-slate-900 uppercase tracking-widest">Score Breakdown</Heading>
                    <div className="bg-white border border-slate-200 rounded-xl divide-y">
                        {Object.entries(data.breakdown).map(([key, value]: [string, any]) => (
                            <div key={key} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                                        {getMetricIcon(key)}
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 capitalize">{key.replace('_', ' ')}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-900" style={{ width: `${value}%` }} />
                                    </div>
                                    <span className="text-sm font-black text-slate-900 w-8 text-right">{value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <Heading level={4} className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <LightbulbIcon className="w-4 h-4 text-amber-500" /> AI Performance Insights
                    </Heading>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Zap className="w-24 h-24" />
                        </div>
                        {data.insights && data.insights.length > 0 ? (
                            <ul className="space-y-3">
                                {data.insights.map((insight, idx) => (
                                    <li key={idx} className="flex gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{insight}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-8">
                                <Text className="text-slate-400 italic text-sm">Awaiting more mission data for pattern analysis.</Text>
                            </div>
                        )}
                        <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 group cursor-help">
                                <ShieldCheck className="w-3 h-3" /> VERIFIED AI ANALYSIS
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">60-DAY WINDOW</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
