import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, AlertTriangle, CheckCircle, Clock, Loader2, RefreshCw, Database } from 'lucide-react';
import apiClient from '../../../services/apiClient';

interface AnalyticsData {
    statusCounts: { status: string; count: number }[];
    blockCounts: { block: string; total: number; resolved: number }[];
    recentEntries: any[];
    flywheel?: { total: number; verified: number; unverified: number; lbd: number; };
}

const EMPTY_DATA: AnalyticsData = {
    statusCounts: [],
    blockCounts: [],
    recentEntries: [],
    flywheel: { total: 0, verified: 0, unverified: 0, lbd: 0 },
};

const STATUS_COLORS: Record<string, string> = {
    identified: '#f59e0b', in_progress: '#3b82f6', resolved: '#10b981',
};

const LBDAnalytics: React.FC = () => {
    const [data, setData] = useState<AnalyticsData>(EMPTY_DATA);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            apiClient.get('/lbd/analytics').catch(() => ({ data: { data: EMPTY_DATA } })),
            apiClient.get('/v1/training/flywheel/stats').catch(() => ({ data: { data: EMPTY_DATA.flywheel } }))
        ]).then(([lbdRes, flyRes]) => {
            const fd = flyRes.data.data;
            setData({ ...lbdRes.data.data, flywheel: fd });
        }).finally(() => { setLoading(false); setLastRefresh(new Date()); });
    };

    useEffect(() => { fetchData(); }, []);

    const total = data.statusCounts.reduce((s, r) => s + Number(r.count), 0);
    const resolved = data.statusCounts.find(r => r.status === 'resolved');

    return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-end justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase">LBD Analytics</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Admin — Defect Intelligence</p>
                </div>
                <button onClick={fetchData} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700
                               text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest
                               rounded-xl transition-all hover:border-slate-600">
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total LBD', value: total, Icon: BarChart3, color: 'text-slate-300' },
                    { label: 'Identified', value: data.statusCounts.find(r => r.status === 'identified')?.count ?? 0, Icon: AlertTriangle, color: 'text-amber-400' },
                    { label: 'In Progress', value: data.statusCounts.find(r => r.status === 'in_progress')?.count ?? 0, Icon: Clock, color: 'text-blue-400' },
                    { label: 'Resolved', value: resolved?.count ?? 0, Icon: CheckCircle, color: 'text-emerald-400' },
                ].map((c, i) => (
                    <div key={c.label} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                        <c.Icon size={18} className={`${c.color} mb-3`} />
                        <div className={`text-3xl font-black tabular-nums mb-1 ${c.color}`}>{c.value}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{c.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Status Distribution</h3>
                    {loading ? (
                        <div className="h-48 flex items-center justify-center"><Loader2 className="text-blue-400 animate-spin" /></div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={data.statusCounts.map(s => ({ name: s.status.replace('_', ' '), value: s.count }))}
                                    cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                                    {data.statusCounts.map((s, i) => (
                                        <Cell key={i} fill={STATUS_COLORS[s.status] ?? '#64748b'} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Issues by Block (Total vs Resolved)</h3>
                    {loading ? (
                        <div className="h-48 flex items-center justify-center"><Loader2 className="text-blue-400 animate-spin" /></div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={data.blockCounts}>
                                <XAxis dataKey="block" tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Total" />
                                <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} name="Resolved" />
                                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {data.flywheel && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-500/20 rounded-xl">
                            <Database size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Training Data Flywheel</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Proprietary AI Model Ingestion Status</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <div className="text-2xl font-black text-indigo-400 mb-1">{data.flywheel.total}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Total Samples</div>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <div className="text-2xl font-black text-emerald-400 mb-1">{data.flywheel.verified}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Human Verified</div>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <div className="text-2xl font-black text-amber-400 mb-1">{data.flywheel.unverified}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Pending Verification</div>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <div className="text-2xl font-black text-violet-400 mb-1">{data.flywheel.lbd}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">LBD Specific Scans</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="text-[10px] text-slate-700 text-right">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
            </div>
        </div>
    );
};

export default LBDAnalytics;
