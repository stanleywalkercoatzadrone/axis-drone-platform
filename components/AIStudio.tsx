/**
 * AIStudio.tsx
 * Unified view: Industry AI (new report creation) + AI Report Archive.
 * Replaces the separate "New Report" and "Report Archives" nav items.
 * Additive — ReportCreator and Dashboard components are unchanged.
 */
import React, { useState } from 'react';
import { BrainCircuit, Archive, Plus, ChevronRight } from 'lucide-react';
import ReportCreator from './ReportCreator';
import Dashboard from './Dashboard';
import { Industry } from '../types';
import { useIndustry } from '../src/context/IndustryContext';

type SubTab = 'new' | 'archive';

interface AIStudioProps {
    initialIndustry: Industry;
}

const AIStudio: React.FC<AIStudioProps> = ({ initialIndustry }) => {
    const [subTab, setSubTab] = useState<SubTab>('new');
    const [selectedIndustry, setSelectedIndustry] = useState<Industry>(initialIndustry);
    const [viewingReport, setViewingReport] = useState<any | null>(null);
    const { currentIndustry } = useIndustry();

    // When user clicks "New Report" from the archive view
    const handleNewReport = (industry: Industry) => {
        setSelectedIndustry(industry);
        setViewingReport(null);
        setSubTab('new');
    };

    // When user clicks a report to view it
    const handleViewReport = (report: any) => {
        setViewingReport(report);
        setSubTab('new'); // ReportCreator handles both create + view
    };

    const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
        { id: 'new', label: 'AI Extraction', icon: <BrainCircuit className="w-4 h-4" /> },
        { id: 'archive', label: 'Report Archive', icon: <Archive className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-0">
            {/* Sub-tab switcher */}
            <div className="flex items-center gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setSubTab(tab.id);
                            if (tab.id === 'new') setViewingReport(null);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-200 ${subTab === tab.id
                                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {subTab === 'new' && (
                <ReportCreator
                    key={currentIndustry || selectedIndustry}
                    initialIndustry={selectedIndustry}
                    viewingReport={viewingReport || undefined}
                    onBack={viewingReport ? () => { setViewingReport(null); setSubTab('archive'); } : undefined}
                />
            )}

            {subTab === 'archive' && (
                <Dashboard
                    onNewReport={handleNewReport}
                    onViewReport={handleViewReport}
                    isArchiveView={true}
                />
            )}
        </div>
    );
};

export default AIStudio;
