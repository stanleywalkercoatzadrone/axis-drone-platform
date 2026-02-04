import React, { useState } from 'react';
import { KPIBar } from '../widgets/KPIBar';
import { NeedsAttentionWidget } from '../widgets/NeedsAttentionWidget';
import { UploadBatchesWidget } from '../widgets/UploadBatchesWidget';
import { DetailsDrawer } from '../layout/DetailsDrawer';
import { ArrowRight, AlertTriangle } from 'lucide-react';

export const MissionControl: React.FC = () => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerContent, setDrawerContent] = useState<string>('');

    const handleItemClick = (title: string) => {
        setDrawerContent(title);
        setIsDrawerOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* 1. KPI Strip */}
            <KPIBar />

            {/* 2. Main Widget Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                {/* Needs Attention (2/3 width) - Wrapped to capture clicks for demo */}
                <div className="lg:col-span-2 h-full" onClick={() => handleItemClick('Needs Attention Details')}>
                    <NeedsAttentionWidget />
                </div>

                {/* Upload Batches (1/3 width) */}
                <div className="lg:col-span-1 h-full">
                    <UploadBatchesWidget />
                </div>
            </div>

            {/* 3. Site Progress Table (Placeholder for now) */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-semibold text-slate-100">Site Progress</h3>
                    <button className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                        View Full Registry <ArrowRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="p-12 text-center text-slate-500">
                    <p>Truth Table & Site Drill-down coming in Phase 2.1</p>
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
                                    The ingestion engine encountered a timeout during the "Orthomosaic Generation" step.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300">Recommended Actions</h4>
                        <div className="grid gap-2">
                            <button className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
                                Retry Ingestion Step
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
