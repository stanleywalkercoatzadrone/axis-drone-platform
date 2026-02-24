import React, { useState } from 'react';
import { useCountry } from '../../context/CountryContext';
import { KPIBar } from '../widgets/KPIBar';
import { NeedsAttentionWidget } from '../widgets/NeedsAttentionWidget';
import { UploadBatchesWidget } from '../widgets/UploadBatchesWidget';
import { DetailsDrawer } from '../layout/DetailsDrawer';
import { ArrowRight, AlertTriangle, Activity, Clock } from 'lucide-react';
import GeographicCoverage from '../../../components/GeographicCoverage';
import { WeatherWidget } from '../widgets/WeatherWidget';

const SITES_DATA = [
    { name: 'West Field Solar Array', status: 'Active', health: 98, progress: 85, issues: 2, pilots: 3 },
    { name: 'North Tower Cluster', status: 'Active', health: 92, progress: 40, issues: 5, pilots: 2 },
    { name: 'Downtown Commercial', status: 'Active', health: 100, progress: 95, issues: 0, pilots: 4 },
    { name: 'Grid Station Alpha', status: 'Planned', health: 100, progress: 0, issues: 0, pilots: 1 },
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
            {/* 1. KPI Strip */}
            <KPIBar countryId={activeCountryId} />

            {/* 2. Site Health & Performance */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SITES_DATA.map((site, idx) => (
                            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3">
                                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${site.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                                        }`}>
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
                                            <div
                                                className="h-full bg-cyan-500 transition-all duration-1000"
                                                style={{ width: `${site.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

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
                </div>

                <div className="xl:col-span-1 space-y-6">
                    <WeatherWidget />
                    <UploadBatchesWidget countryId={activeCountryId} />
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">Urgent Actions</h4>
                        <div className="space-y-3">
                            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg flex gap-3 cursor-pointer hover:bg-red-500/10 transition-colors" onClick={() => handleItemClick('SLA Alert: FL-204')}>
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <div>
                                    <p className="text-[11px] font-bold text-slate-200">SLA Breach: FL-204</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Processing delay &gt; 4h detected.</p>
                                </div>
                            </div>
                            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex gap-3">
                                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                <div>
                                    <p className="text-[11px] font-bold text-slate-200">Pending Review</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">3 flight logs awaiting ops sign-off.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Details Drawer Demo */}
            <DetailsDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={drawerContent || "Item Details"}
            >
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
                            <button className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                                Retry Upload Step
                            </button>
                            <button className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                                View Logs
                            </button>
                            <button className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                                Escalate to Support
                            </button>
                        </div>
                    </div>
                </div>
            </DetailsDrawer>
        </div>
    );
};
