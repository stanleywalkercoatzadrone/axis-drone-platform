/**
 * IndustryReportsHub — Industry-specific AI Reports hub embedded inside a Mission.
 * Renders inside the Mission detail modal as the "AI Reports" tab.
 * Insurance tab routes to the existing EnterpriseAIReporting (ClaimsReportWizard).
 */
import React, { useState } from 'react';
import { ArrowLeft, Sparkles, ChevronRight, FileText } from 'lucide-react';
import { INDUSTRY_REPORT_CONFIGS, IndustryId, IndustryReportConfig, ReportSection } from './config/industryReportSections';
import { useIndustry } from '../../src/context/IndustryContext';
import { useAuth } from '../../src/context/AuthContext';

// Generators
import EnterpriseAIReporting from './EnterpriseAIReporting';
import SolarReportGenerator from './generators/SolarReportGenerator';
import ConstructionReportGenerator from './generators/ConstructionReportGenerator';
import UtilitiesReportGenerator from './generators/UtilitiesReportGenerator';
import TelecomReportGenerator from './generators/TelecomReportGenerator';
import AIReportArchive from './components/AIReportArchive';

type HubView = 'hub' | 'generator' | 'archive';

interface IndustryReportsHubProps {
    missionId?: string;
    missionTitle?: string;
    missionSiteName?: string;
    missionClientName?: string;
    defaultIndustry?: IndustryId;
    /** When true (launched from sidebar industry row), hides the tab strip so only that industry is shown */
    singleIndustry?: boolean;
}

const IndustryReportsHub: React.FC<IndustryReportsHubProps> = ({ missionId, missionTitle, missionSiteName, missionClientName, defaultIndustry, singleIndustry }) => {
    const { currentIndustry } = useIndustry();
    const { user } = useAuth();
    const storageKey = `axis_reports_industry_${user?.id ?? 'default'}`;

    // Auto-detect: if the user is inside a specific industry context (e.g. Solar Missions),
    // lock the hub to that industry and hide the tab strip.
    const industryFromContext = currentIndustry && INDUSTRY_REPORT_CONFIGS.find(c => c.id === currentIndustry)
        ? (currentIndustry as IndustryId)
        : null;

    const effectiveSingleIndustry = singleIndustry || !!industryFromContext;

    // Priority: explicit prop > active industry context > stored preference > fallback
    const resolveDefaultIndustry = (): IndustryId => {
        if (defaultIndustry && INDUSTRY_REPORT_CONFIGS.find(c => c.id === defaultIndustry)) return defaultIndustry;
        if (industryFromContext) return industryFromContext;
        const stored = localStorage.getItem(storageKey) as IndustryId | null;
        if (stored && INDUSTRY_REPORT_CONFIGS.find(c => c.id === stored)) return stored;
        return 'insurance';
    };

    const [activeIndustry, setActiveIndustry] = useState<IndustryId>(resolveDefaultIndustry);
    const [view, setView] = useState<HubView>('hub');
    const [activeSection, setActiveSection] = useState<ReportSection | null>(null);
    const [archiveSearch, setArchiveSearch] = useState('');

    const config = INDUSTRY_REPORT_CONFIGS.find(c => c.id === activeIndustry)!

    const handleSelectIndustry = (id: IndustryId) => {
        setActiveIndustry(id);
        localStorage.setItem(storageKey, id);
        setView('hub');
        setActiveSection(null);
    };

    const handleOpenSection = (section: ReportSection) => {
        setActiveSection(section);
        setView('generator');
    };

    const handleBack = () => {
        setView('hub');
        setActiveSection(null);
        setArchiveSearch(''); // Clear search when returning to hub
    };

    // If we jumped to generator for insurance, render the full existing module
    if (view === 'generator' && activeSection?.generator === 'insurance') {
        return (
            <div>
                <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-700/50 bg-slate-900/80">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to AI Reports Hub
                    </button>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-300 text-sm font-medium">{activeSection?.title}</span>
                </div>
                <EnterpriseAIReporting missionId={missionId} />
            </div>
        );
    }

    if (view === 'archive') {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center gap-3 px-8 py-3 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10 shrink-0">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Hub
                    </button>
                    <span className="text-slate-600">/</span>
                    <span className="text-white text-sm font-semibold">Report Archive</span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <AIReportArchive defaultSearch={archiveSearch} />
                </div>
            </div>
        );
    }

    if (view === 'generator' && activeSection) {
        return (
            <GeneratorShell
                section={activeSection}
                industryConfig={config}
                missionId={missionId}
                missionSiteName={missionSiteName}
                missionClientName={missionClientName}
                onBack={handleBack}
                onShowArchive={(search) => {
                    setArchiveSearch(search || '');
                    setView('archive');
                }}
            />
        );
    }

    // ── Hub view ─────────────────────────────────────────────────────────────
    return (
        <div className="bg-slate-950 text-white">
            {/* Page header */}
            <div className="px-8 pt-8 pb-0">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg"
                                style={{ background: config.colorHex }}
                            >
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white">AI Reports Hub</h1>
                                {missionTitle && (
                                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest mt-0.5">
                                        Mission: {missionTitle}
                                    </p>
                                )}
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm ml-12">Prism Axis Intelligence Platform — industry-specific AI report generators</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <button
                            onClick={() => setView('archive')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700/50 transition-all shadow-lg hover:shadow-indigo-500/10 hover:border-slate-500"
                        >
                            <FileText className="w-4 h-4 text-indigo-400" />
                            View Saved Reports
                        </button>
                    </div>
                </div>

                {/* Industry tab strip — hidden when launched from a single-industry sidebar link or when industry context is active */}
                {!effectiveSingleIndustry && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-0 scrollbar-hide">
                        {INDUSTRY_REPORT_CONFIGS.map(ind => {
                            const isActive = ind.id === activeIndustry;
                            return (
                                <button
                                    key={ind.id}
                                    onClick={() => handleSelectIndustry(ind.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-700
                                        whitespace-nowrap flex-shrink-0 transition-all border-b-2 font-semibold
                                        ${isActive
                                            ? 'bg-slate-800 text-white border-b-2'
                                            : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
                                        }
                                    `}
                                    style={{ borderBottomColor: isActive ? ind.colorHex : 'transparent' }}
                                >
                                    <span>{ind.icon}</span>
                                    <span>{ind.label}</span>
                                    {isActive && (
                                        <span
                                            className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full"
                                            style={{ background: ind.colorHex + '25', color: ind.colorHex }}
                                        >
                                            Active
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Industry panel */}
            <div className="relative border-t border-slate-800 bg-[#0B1121] overflow-hidden">
                {/* Background ambient glow matching the active industry */}
                <div 
                    className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10 pointer-events-none transition-colors duration-1000"
                    style={{ background: config.colorHex }}
                />
                
                <div className="relative px-8 py-8 z-10">
                    {/* Panel header */}
                    <div className="flex items-end justify-between mb-8 pb-6 border-b border-slate-800/60">
                        <div className="max-w-xl">
                            <h2 className="text-[22px] font-black text-white tracking-tight mb-2 drop-shadow-sm">{config.subtitle}</h2>
                            <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                Choose an AI module below. Our deep learning engine will automatically synthesize raw data points, drone telemetry, and computer vision findings into an enterprise-grade PDF deliverable.
                            </p>
                        </div>
                        <div
                            className="flex flex-col items-end gap-2"
                        >
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-black"
                                style={{ background: config.colorHex + '18', color: config.colorHex, border: `1px solid ${config.colorHex}30` }}>
                                <Sparkles className="w-3.5 h-3.5" />
                                Neural Generation Ready
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono tracking-widest">SYS.ID // {config.id.toUpperCase()}-MODULE</div>
                        </div>
                    </div>

                    {/* Section cards grid */}
                    <div className="grid grid-cols-3 gap-4">
                        {config.sections.map(section => (
                            <SectionCard
                                key={section.id}
                                section={section}
                                industryColor={config.colorHex}
                                onClick={() => handleOpenSection(section)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


// ── Section Card ──────────────────────────────────────────────────────────────

const SectionCard: React.FC<{
    section: ReportSection;
    industryColor: string;
    onClick: () => void;
}> = ({ section, industryColor, onClick }) => (
    <button
        onClick={onClick}
        className="group relative text-left bg-[#0B1121]/80 hover:bg-[#111827] border border-slate-700/50 hover:border-slate-500 rounded-xl p-6 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:-translate-y-1 cursor-pointer overflow-hidden isolate"
    >
        {/* Animated Glow Background (Glassmorphic FX) */}
        <div 
            className="absolute -inset-x-0 bottom-0 h-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[40px] pointer-events-none -z-10"
            style={{ background: `linear-gradient(to top, ${section.accentHex}1a, transparent)` }}
        />

        {/* Top Accent Line */}
        <div 
            className="absolute inset-x-0 top-0 h-1 opacity-80 group-hover:opacity-100 transition-opacity duration-300" 
            style={{ background: `linear-gradient(90deg, ${section.accentHex}, transparent)` }} 
        />

        {/* AI badge */}
        <div
            className="absolute top-5 right-5 text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase shadow-sm"
            style={{ background: section.accentHex + '15', color: section.accentHex, border: `1px solid ${section.accentHex}40` }}
        >
            {section.badge}
        </div>

        {/* Icon Container with Nested Glow */}
        <div className="relative mb-5 inline-block">
            <div 
                className="absolute inset-0 blur-md opacity-20 group-hover:opacity-60 transition-opacity"
                style={{ background: section.accentHex }}
            />
            <div
                className="relative w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-transform duration-300 group-hover:scale-110"
                style={{ background: section.accentHex + '11', border: `1px solid ${section.accentHex}30` }}
            >
                {/* Icon removed to satisfy 'remove abbreviations' request */}
            </div>
        </div>

        {/* Content */}
        <h3 className="text-[15px] font-black text-white mb-2 pr-12 leading-tight tracking-tight drop-shadow-md">{section.title}</h3>
        <p className="text-[12px] text-slate-400 leading-relaxed mb-6 font-medium">{section.description}</p>

        {/* Premium CTA row */}
        <div
            className="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase transition-colors"
            style={{ color: section.accentHex }}
        >
            <div className="flex items-center justify-center p-1 rounded-full" style={{ background: section.accentHex + '15' }}>
                <FileText className="w-3.5 h-3.5" />
            </div>
            Generate Report
            <ChevronRight className="w-3.5 h-3.5 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 group-hover:translate-x-1 transition-all duration-300" />
        </div>
    </button>
);

// ── Generator Shell ───────────────────────────────────────────────────────────

const GeneratorShell: React.FC<{
    section: ReportSection;
    industryConfig: IndustryReportConfig;
    missionId?: string;
    missionSiteName?: string;
    missionClientName?: string;
    onBack: () => void;
    onShowArchive?: (search?: string) => void;
}> = ({ section, industryConfig, missionId, missionSiteName, missionClientName, onBack, onShowArchive }) => {
    const renderGenerator = () => {
        switch (section.generator) {
            case 'solar':
                return <SolarReportGenerator missionId={missionId} section={section} initialSiteName={missionSiteName} initialClientName={missionClientName} onShowArchive={onShowArchive} />;
            case 'construction':
                return <ConstructionReportGenerator missionId={missionId} section={section} industryConfig={industryConfig} initialSiteName={missionSiteName} initialClientName={missionClientName} onShowArchive={onShowArchive} />;
            case 'utilities':
                return <UtilitiesReportGenerator missionId={missionId} section={section} industryConfig={industryConfig} initialSiteName={missionSiteName} initialClientName={missionClientName} onShowArchive={onShowArchive} />;
            case 'telecom':
                return <TelecomReportGenerator missionId={missionId} section={section} industryConfig={industryConfig} initialSiteName={missionSiteName} initialClientName={missionClientName} onShowArchive={onShowArchive} />;
            case 'insurance':
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <p className="text-sm font-semibold">Report generator not yet available for this industry</p>
                        <p className="text-xs text-slate-600">Select Solar, Construction, Utilities, or Telecom to generate a report.</p>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Breadcrumb bar */}
            <div className="flex items-center gap-3 px-8 py-3 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    AI Reports Hub
                </button>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className="text-slate-500 text-sm">{industryConfig.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className="text-white text-sm font-semibold">{section.title}</span>
                <div
                    className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: section.accentHex + '20', color: section.accentHex }}
                >
                    {section.badge}
                </div>
            </div>

            {renderGenerator()}
        </div>
    );
};

export default IndustryReportsHub;
