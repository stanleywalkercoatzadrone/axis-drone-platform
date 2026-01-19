
import React, { useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from 'recharts';
import {
    LayoutDashboard,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Calendar,
    Filter,
    Download,
    Building2,
    Users
} from 'lucide-react';
import { Industry, Severity } from '../types';

// Mock Data
const ASSET_HEALTH_DATA = [
    { name: 'Optimal', value: 65, color: '#10b981' },
    { name: 'Warning', value: 24, color: '#f59e0b' },
    { name: 'Critical', value: 11, color: '#ef4444' }
];

const INSPECTION_TRENDS = [
    { month: 'Jan', completed: 12, issues: 45 },
    { month: 'Feb', completed: 19, issues: 52 },
    { month: 'Mar', completed: 15, issues: 38 },
    { month: 'Apr', completed: 22, issues: 65 },
    { month: 'May', completed: 28, issues: 48 },
    { month: 'Jun', completed: 34, issues: 55 }
];

const COST_BY_TYPE = [
    { name: 'Solar', cost: 45000 },
    { name: 'Utilities', cost: 82000 },
    { name: 'Telecom', cost: 35000 },
    { name: 'Insurance', cost: 28000 }
];

type ReportLevel = 'Executive' | 'Operational' | 'Asset';

const ReportingSuite: React.FC = () => {
    const [activeLevel, setActiveLevel] = useState<ReportLevel>('Executive');

    const renderExecutiveView = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-500 mb-4">Portfolio Health</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={ASSET_HEALTH_DATA}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {ASSET_HEALTH_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4">
                        {ASSET_HEALTH_DATA.map(item => (
                            <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                {item.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-semibold text-slate-500">Projected Repair Costs by Sector</h3>
                        <button className="text-xs text-blue-600 font-medium hover:underline">Download Report</button>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={COST_BY_TYPE} barSize={40}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `$${value}`} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} />
                                <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-500 mb-6">Inspection Activity vs. Issue Discovery</h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={INSPECTION_TRENDS}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="completed" name="Missions Completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="issues" name="Issues Found" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );

    const renderOperationalView = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Pilot Utilization', value: '84%', sub: '+12% vs last week', icon: Users, color: 'blue' },
                    { label: 'Avg Mission Time', value: '42m', sub: '-3m efficiency gain', icon: Calendar, color: 'emerald' },
                    { label: 'Pending Reviews', value: '14', sub: 'Action required', icon: AlertCircle, color: 'amber' },
                    { label: 'Report Turnaround', value: '1.2d', sub: 'Within SLA', icon: CheckCircle2, color: 'indigo' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg bg-${stat.color}-50 text-${stat.color}-600`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-2">
                            <h4 className="text-2xl font-bold text-slate-900">{stat.value}</h4>
                            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{stat.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Placeholder for detailed operational table */}
            <div className="bg-slate-100 rounded-xl border border-slate-200 border-dashed p-12 text-center text-slate-400">
                <LayoutDashboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Operational Detail Grid Component</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Analytics Suite</h2>
                    <p className="text-sm text-slate-500">Multi-level intelligence and reporting dashboard.</p>
                </div>
                <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start">
                    {(['Executive', 'Operational', 'Asset'] as ReportLevel[]).map((level) => (
                        <button
                            key={level}
                            onClick={() => setActiveLevel(level)}
                            className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${activeLevel === level
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {level} Override
                        </button>
                    ))}
                </div>
            </div>

            {activeLevel === 'Executive' && renderExecutiveView()}
            {activeLevel === 'Operational' && renderOperationalView()}
            {activeLevel === 'Asset' && (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <Building2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">Asset Level Deep-Dive</h3>
                    <p className="text-slate-500 max-w-md mx-auto mt-2">
                        Select a specific asset from the Asset Tracker to view its comprehensive historical analysis and predictive maintenance model.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ReportingSuite;
