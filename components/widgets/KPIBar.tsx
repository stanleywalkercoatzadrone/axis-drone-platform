import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle2, Clock, Zap, Box, Activity, Brain, Target } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useGlobalContext } from '../../context/GlobalContext';

interface KPIMetric {
    label: string;
    value: string;
    change?: string;
    trend: 'up' | 'down' | 'neutral';
    icon?: React.ReactNode;
    color: 'slate' | 'cyan' | 'red' | 'emerald' | 'blue';
}

interface KPIBarProps {
    countryId?: string;
}

export const KPIBar: React.FC<KPIBarProps> = ({ countryId }) => {
    // const { activeCountryId } = useGlobalContext(); // Using prop instead
    const [assetCount, setAssetCount] = useState<number>(0);

    useEffect(() => {
        const params = countryId ? { countryId } : {};

        // Fetch Assets
        apiClient.get('/assets', { params }).then(res => {
            if (res.data.success && Array.isArray(res.data.data)) {
                setAssetCount(res.data.data.length);
            } else if (res.data.status === 'success' && Array.isArray(res.data.data)) {
                // Handle standard response format
                setAssetCount(res.data.data.length);
            }
        }).catch(err => console.error('Failed to fetch asset count:', err));

        // Fetch Deployments (for blocks planned/coverage if we were calculating it real-time)
        // For now, we only update Asset Count dynamically based on country
    }, [countryId]);

    // Mock Data - In real app, this comes from API based on GlobalContext
    const metrics: KPIMetric[] = [
        { label: 'Active Sites', value: '12', change: '+2', trend: 'up', icon: <Target className="w-4 h-4" />, color: 'cyan' },
        { label: 'Flight Hours', value: '480', change: '+42h', trend: 'up', icon: <Activity className="w-4 h-4" />, color: 'emerald' },
        { label: 'AI Anomalies', value: '128', change: '-12%', trend: 'down', icon: <Brain className="w-4 h-4" />, color: 'blue' },
        { label: 'Compliance Index', value: '98.4%', change: 'Optimal', trend: 'neutral', icon: <CheckCircle2 className="w-4 h-4" />, color: 'blue' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {metrics.map((metric, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm hover:border-slate-700 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{metric.label}</span>
                        <div className={`p-1.5 rounded-md ${metric.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-400' :
                            metric.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
                                metric.color === 'red' ? 'bg-red-500/10 text-red-400' :
                                    metric.color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                                        'bg-slate-800 text-slate-400'
                            }`}>
                            {metric.icon}
                        </div>
                    </div>
                    <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-bold text-white tracking-tight">{metric.value}</span>
                        {metric.change && (
                            <span className={`text-xs font-medium ${metric.trend === 'up' ? 'text-emerald-400' :
                                metric.trend === 'down' ? 'text-slate-500' : 'text-slate-500'
                                }`}>
                                {metric.change}
                            </span>
                        )}
                    </div>

                    {/* Micro Sparkline (Mock) */}
                    <div className="h-8 mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[
                                { v: 10 }, { v: 15 }, { v: 12 }, { v: 20 }, { v: 25 }, { v: 22 }, { v: 30 }
                            ]}>
                                <Area
                                    type="monotone"
                                    dataKey="v"
                                    stroke={metric.color === 'red' ? '#ef4444' : metric.color === 'blue' ? '#3b82f6' : '#0ec5d7'}
                                    fill={metric.color === 'red' ? '#ef4444' : metric.color === 'blue' ? '#3b82f6' : '#0ec5d7'}
                                    fillOpacity={0.1}
                                    strokeWidth={1.5}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ))}
        </div>
    );
};
