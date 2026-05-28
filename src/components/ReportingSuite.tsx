
import React, { useState, useEffect, lazy, Suspense } from 'react';
import apiClient from '../services/apiClient';
import { InspectionReport } from '../types';
import { useMediaDeliverable } from '../context/MediaDeliverableContext';
const ReportViewer = lazy(() => import('./viewers/ReportViewer'));
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
    Users,
    FileText,
    Eye,
    Loader2
} from 'lucide-react';
import { Industry, Severity } from '../types';



type ReportLevel = 'Executive' | 'Operational' | 'Asset';

const ReportingSuite: React.FC = () => {
    const [activeLevel, setActiveLevel] = useState<ReportLevel>('Executive');
    const [reports, setReports] = useState<InspectionReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeReport, setActiveReport] = useState<InspectionReport | null>(null);
    const { navigateToTab } = useMediaDeliverable();

    const openReport = async (reportId: string) => {
        try {
            const r = await apiClient.get(`/reports/${reportId}`);
            setActiveReport(r.data?.data || r.data || null);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        apiClient.get('/reports').then(res => {
            if (res.data.success) {
                setReports(res.data.data);
            }
        }).catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    // Derived aggregations from GET /api/reports
    const hasReports = reports.length > 0;

    // Portfolio health: bucketed by approval status from real data.
    const liveOptimal = reports.filter(r => r.approvalStatus === 'Approved' || r.approvalStatus === 'Released').length;
    const liveWarning = reports.filter(r => r.approvalStatus === 'Pending Review' || r.approvalStatus === 'Draft').length;
    const assetHealthData = [
        { name: 'Optimal', value: liveOptimal, color: '#10b981' },
        { name: 'Warning', value: liveWarning, color: '#f59e0b' },
        { name: 'Critical', value: 0, color: '#ef4444' }
    ];

    // Sector cost: derived from strategicAssessment.grandTotalEstimate per report.
    const sectorCostData = Object.values(Industry).map(ind => ({
        name: ind,
        cost: reports
            .filter(r => r.industry === ind)
            .reduce((acc, curr) => acc + (curr.strategicAssessment?.grandTotalEstimate || 0), 0)
    })).filter(d => d.cost > 0);

    // Inspection trends: grouped by calendar month from real report dates.
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const inspectionTrends = monthNames.map((month, idx) => {
        const monthReports = reports.filter(r => new Date(r.date).getMonth() === idx);
        return {
            month,
            completed: monthReports.length,
            issues: monthReports.reduce(
                (acc, curr) => acc + curr.images.reduce((imgAcc, img) => imgAcc + img.annotations.length, 0),
                0
            )
        };
    }).filter(d => d.completed > 0 || d.issues > 0);

    const displayCostData = sectorCostData;
    const displayTrends   = inspectionTrends;

    // Operational KPIs derived from real report data
    const pendingReviewCount = reports.filter(r => r.approvalStatus === 'Pending Review').length;

    const renderExecutiveView = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Portfolio Health</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assetHealthData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {assetHealthData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4">
                        {assetHealthData.map(item => (
                            <div key={item.name} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                {item.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Projected Repair Costs by Sector</h3>
                        {displayCostData.length > 0 && (
                            <button className="text-xs text-blue-600 font-medium hover:underline">Download Report</button>
                        )}
                    </div>
                    {displayCostData.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={displayCostData} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                            <p className="text-xs font-semibold text-slate-500">Cost data will appear once reports are submitted</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 mb-6 uppercase tracking-wider">Inspection Activity vs. Issue Discovery</h3>
                {displayTrends.length > 0 ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={displayTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="completed" name="Missions Completed" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="issues" name="Issues Found" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-72 flex flex-col items-center justify-center gap-3 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <p className="text-xs font-semibold text-slate-500">Trend data will appear as missions are completed</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderOperationalView = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Approved Reports', value: String(liveOptimal), sub: liveOptimal > 0 ? 'Delivered to client' : 'None yet', icon: CheckCircle2, color: 'emerald' },
                    { label: 'Pending Reviews', value: String(pendingReviewCount), sub: pendingReviewCount > 0 ? 'Action required' : 'All clear', icon: AlertCircle, color: 'amber' },
                    { label: 'Total Missions', value: String(reports.length), sub: 'All time', icon: Calendar, color: 'blue' },
                    { label: 'In Progress', value: String(liveWarning), sub: 'Draft or under review', icon: Users, color: 'indigo' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg bg-${stat.color}-50 text-${stat.color}-600`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-2">
                            <h4 className="text-2xl font-bold text-slate-900">{stat.value}</h4>
                            <p className="text-xs text-slate-700 font-bold uppercase tracking-wider">{stat.label}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-medium">{stat.sub}</p>
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
            {/* ── Inline Report Viewer ── */}
            {activeReport && (
                <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#020817' }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: '#38bdf8' }} /></div>}>
                    <ReportViewer
                        report={activeReport as Parameters<typeof ReportViewer>[0]['report']}
                        onClose={() => setActiveReport(null)}
                    />
                </Suspense>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Analytics Suite</h2>
                    <p className="text-sm text-slate-500">Multi-level intelligence and reporting dashboard.</p>
                </div>
                {/* Cross-module shortcuts */}
                <div className="flex gap-2 flex-wrap self-start">
                    <button
                        onClick={() => navigateToTab('media')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs font-bold transition-all"
                    >
                        <Download className="w-3 h-3" /> Media Gallery
                    </button>
                    <button
                        onClick={() => navigateToTab('orthomosaic')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-xs font-bold transition-all"
                    >
                        <TrendingUp className="w-3 h-3" /> Orthomosaic
                    </button>
                    <button
                        onClick={() => navigateToTab('solar-intelligence')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all"
                    >
                        <Building2 className="w-3 h-3" /> Solar Sites
                    </button>
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
                            {level} {level === 'Asset' ? 'Reports' : 'Override'}
                        </button>
                    ))}
                </div>
            </div>

            {activeLevel === 'Executive' && renderExecutiveView()}
            {activeLevel === 'Operational' && renderOperationalView()}
            {activeLevel === 'Asset' && (
                <div>
                    {loading ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                    ) : reports.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                            <Building2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No Reports Yet</h3>
                            <p className="text-slate-500 max-w-md mx-auto mt-2">
                                Create your first inspection report using the Report Wizard on the Reports tab.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reports.map(r => (
                                <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{r.title}</p>
                                            {r.client && <p className="text-xs text-slate-500 mt-0.5">{r.client}</p>}
                                        </div>
                                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            r.approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700'
                                            : r.approvalStatus === 'Pending Review' ? 'bg-amber-50 text-amber-700'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {r.approvalStatus || r.status || 'Draft'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                        {r.industry && <span>{r.industry}</span>}
                                        {r.date && <span>{new Date(r.date).toLocaleDateString()}</span>}
                                        {r.images?.length > 0 && <span>{r.images.length} photos</span>}
                                    </div>
                                    {r.summary && (
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{r.summary}</p>
                                    )}
                                    <button
                                        onClick={() => openReport(r.id)}
                                        className="mt-auto flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-xs font-bold transition-all hover:bg-blue-700"
                                        style={{ background: '#2563eb', color: 'white' }}
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Open Report
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportingSuite;
