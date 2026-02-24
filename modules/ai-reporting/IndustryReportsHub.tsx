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

type HubView = 'hub' | 'generator';

interface IndustryReportsHubProps {
    missionId?: string;
    missionTitle?: string;
    defaultIndustry?: IndustryId;
    /** When true (launched from sidebar industry row), hides the tab strip so only that industry is shown */
    singleIndustry?: boolean;
}

const IndustryReportsHub: React.FC<IndustryReportsHubProps> = ({ missionId, missionTitle, defaultIndustry, singleIndustry }) => {
    const { currentIndustry } = useIndustry();
    const { user } = useAuth();
    const storageKey = `axis_reports_industry_${user?.id ?? 'default'}`;

    // Priority: explicit defaultIndustry prop (from sidebar nav) > user's stored preference > mission industry > fallback
    const resolveDefaultIndustry = (): IndustryId => {
        if (defaultIndustry && INDUSTRY_REPORT_CONFIGS.find(c => c.id === defaultIndustry)) return defaultIndustry;
        const stored = localStorage.getItem(storageKey) as IndustryId | null;
        if (stored && INDUSTRY_REPORT_CONFIGS.find(c => c.id === stored)) return stored;
        if (currentIndustry === 'solar') return 'solar';
        if (currentIndustry === 'construction') return 'construction';
        if (currentIndustry === 'utilities') return 'utilities';
        if (currentIndustry === 'telecom') return 'telecom';
        return 'insurance';
    };

    const [activeIndustry, setActiveIndustry] = useState<IndustryId>(resolveDefaultIndustry);
    const [view, setView] = useState<HubView>('hub');
    const [activeSection, setActiveSection] = useState<ReportSection | null>(null);

    const config = INDUSTRY_REPORT_CONFIGS.find(c => c.id === activeIndustry)!;

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
                <EnterpriseAIReporting />
            </div>
        );
    }

    if (view === 'generator' && activeSection) {
        return (
            <GeneratorShell
                section={activeSection}
                industryConfig={config}
                onBack={handleBack}
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
                </div>

                {/* Industry tab strip — hidden when launched from a single-industry sidebar link */}
                {!singleIndustry && (
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
            <div className="bg-slate-900/60 border-t border-slate-800">
                <div className="px-8 py-6">
                    {/* Panel header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-black text-white">{config.subtitle}</h2>
                            <p className="text-slate-400 text-sm mt-1">
                                Select a report section below to launch the AI generator
                            </p>
                        </div>
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: config.colorHex + '18', color: config.colorHex, border: `1px solid ${config.colorHex}30` }}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            AI-Powered
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
        className="group relative text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer overflow-hidden"
        style={{ borderLeft: `3px solid ${section.accentHex}` }}
    >
        {/* AI badge */}
        <div
            className="absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: section.accentHex + '20', color: section.accentHex, border: `1px solid ${section.accentHex}40` }}
        >
            {section.badge}
        </div>

        {/* Icon */}
        <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 transition-transform group-hover:scale-110"
            style={{ background: section.accentHex + '18', border: `1px solid ${section.accentHex}30` }}
        >
            {section.icon}
        </div>

        {/* Content */}
        <h3 className="text-sm font-bold text-white mb-1.5 pr-16 leading-snug">{section.title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">{section.description}</p>

        {/* CTA row */}
        <div
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
            style={{ color: section.accentHex }}
        >
            <FileText className="w-3.5 h-3.5" />
            Open Generator
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
    </button>
);

// ── Generator Shell ───────────────────────────────────────────────────────────

const GeneratorShell: React.FC<{
    section: ReportSection;
    industryConfig: IndustryReportConfig;
    onBack: () => void;
}> = ({ section, industryConfig, onBack }) => {
    const renderGenerator = () => {
        switch (section.generator) {
            case 'solar':
                return <SolarReportGenerator section={section} />;
            case 'construction':
                return <ConstructionReportGenerator section={section} />;
            case 'utilities':
                return <UtilitiesReportGenerator section={section} />;
            case 'telecom':
                return <TelecomReportGenerator section={section} />;
            default:
                return (
                    <div className="flex items-center justify-center h-64 text-slate-400">
                        Generator coming soon for this section.
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
