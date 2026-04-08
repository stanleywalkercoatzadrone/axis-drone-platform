import React, { useState, useEffect } from 'react';
import { useCountry } from '../../context/CountryContext';
import { KPIBar } from '../widgets/KPIBar';
import { NeedsAttentionWidget } from '../widgets/NeedsAttentionWidget';
import { UploadBatchesWidget } from '../widgets/UploadBatchesWidget';
import { DetailsDrawer } from '../layout/DetailsDrawer';
import { ArrowRight, AlertTriangle, Activity, Clock, FileText, Plane, Layers, CheckCircle2, Loader2 } from 'lucide-react';
import GeographicCoverage from '../../../components/GeographicCoverage';
import { WeatherWidget } from '../widgets/WeatherWidget';
import apiClient from '../../src/services/apiClient';

/* ── Recent Field Reports Widget ─────────────────────────────────────────── */
const RecentFieldReports: React.FC = () => {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const missionsRes = await apiClient.get('/deployments');
                const missions: any[] = (missionsRes.data.data || []).slice(0, 8);

                const allReports: any[] = [];
                await Promise.allSettled(missions.map(async (m) => {
                    try {
                        const r = await apiClient.get(`/deployments/${m.id}/pilot-reports`);
                        (r.data.data || []).forEach((report: any) => {
                            allReports.push({ ...report, missionTitle: m.title, missionId: m.id });
                        });
                    } catch (_) {}
                }));

                allReports.sort((a, b) =>
                    new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
                );
                setReports(allReports.slice(0, 10));
            } catch (_) {}
            finally { setLoading(false); }
        };
        load();
    }, []);

    const fmt = (d: string) => {
        try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
        catch { return d; }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-400" />
                    Recent Field Reports
                </h3>
                {!loading && (
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {reports.length} report{reports.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading reports...
                </div>
            ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                    <FileText className="w-8 h-8 opacity-30" />
                    <p className="text-sm text-slate-500">No field reports submitted yet</p>
                    <p className="text-xs text-slate-600">Pilots submit reports from their dashboard</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-800/80">
                    {reports.map((r, i) => (
                        <div key={`${r.id}-${i}`} className="px-5 py-4 hover:bg-slate-800/40 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-white">{r.pilotName}</span>
                                        <span className="text-[10px] text-slate-500">·</span>
                                        <span className="text-[10px] text-slate-400 truncate">{r.missionTitle}</span>
                                        {r.isIncident && (
                                            <span className="text-[10px] font-black text-orange-300 bg-orange-900/30 border border-orange-700/40 px-1.5 py-0.5 rounded-full uppercase">
                                                ⚠ {r.incidentSeverity}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Plane className="w-3 h-3 text-blue-400" />{r.missionsFlown ?? 0} flights
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Layers className="w-3 h-3 text-cyan-400" />{r.blocksCompleted ?? 0} blocks
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-indigo-400" />{r.hoursWorked ?? 0}h
                                        </span>
                                    </div>
                                    {r.aiReport && (
                                        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                                            {r.aiReport}
                                        </p>
                                    )}
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-[10px] font-bold text-slate-500">{fmt(r.date)}</p>
                                    {r.isIncident ? (
                                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400 ml-auto mt-1" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/50 ml-auto mt-1" />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ── Static sites data ────────────────────────────────────────────────────── */
const SITES_DATA = [
    { name: 'West Field Solar Array', status: 'Active', health: 98, progress: 85, issues: 2, pilots: 3 },
    { name: 'North Tower Cluster',    status: 'Active', health: 92, progress: 40, issues: 5, pilots: 2 },
    { name: 'Downtown Commercial',    status: 'Active', health: 100, progress: 95, issues: 0, pilots: 4 },
    { name: 'Grid Station Alpha',     status: 'Planned', health: 100, progress: 0, issues: 0, pilots: 1 },
];

export const MissionControl: React.FC = () => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerContent, setDrawerContent] = useState<string>('');
    const { activeCountryId } = useCountry();

    const handleItemClick = (title: string) => {
        setDrawerContent(title);
        setIsDrawerOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* KPI Strip */}
            <KPIBar countryId={activeCountryId} />

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 space-y-6">

                    {/* Site Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SITES_DATA.map((site, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3">
                                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${site.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {site.status}
                                    </div>
                                </div>
                                <div className="flex flex-col h-full justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{site.name}</h4>
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Health</span>
                                                <span className={`text-sm font-black ${site.health < 95 ? 'text-amber-400' : 'text-emerald-400'}`}>{site.health}%</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Issues</span>
                                                <span className={`text-sm font-black ${site.issues > 0 ? 'text-red-400' : 'text-slate-300'}`}>{site.issues}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Pilots</span>
                                                <span className="text-sm font-black text-slate-300">{site.pilots}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Mission Progress</span>
                                            <span className="text-[10px] text-slate-300 font-bold">{site.progress}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${site.progress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Map */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-cyan-400" />
                                Live Deployment Monitoring
                            </h3>
                            <button className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                                Open Mission Terminal <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="p-8">
                            <GeographicCoverage />
                        </div>
                    </div>

                    {/* ── Live Field Reports ── */}
                    <RecentFieldReports />
                </div>

                <div className="xl:col-span-1 space-y-6">
                    <WeatherWidget />
                    <UploadBatchesWidget countryId={activeCountryId} />
                    <NeedsAttentionWidget />
                </div>
            </div>

            <DetailsDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={drawerContent || 'Item Details'}>
                <div className="space-y-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-slate-200">Site FL-204 At Risk</h4>
                                <p className="text-sm text-slate-400 mt-1">
                                    The SLA for this site is at risk due to a 4h delay in processing.
                                    The upload engine encountered a timeout during the "Orthomosaic Generation" step.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300">Recommended Actions</h4>
                        <div className="grid gap-2">
                            <button className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">Retry Upload Step</button>
                            <button className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">View Logs</button>
                            <button className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">Escalate to Support</button>
                        </div>
                    </div>
                </div>
            </DetailsDrawer>
        </div>
    );
};
