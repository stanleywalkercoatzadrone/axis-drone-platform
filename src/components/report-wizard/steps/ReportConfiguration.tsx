import React from 'react';
import { useReport } from '../ReportContext';
import { Industry, ReportTheme, ReportConfig, INDUSTRY_TEMPLATES, IndustryTemplate } from '../../../types';
import { Sun, Zap, LayoutTemplate, BrainCircuit, FileText, ChevronRight, Check, Palette } from 'lucide-react';

import { Card } from '../../../stitch/components/Card';
import { Input } from '../../../stitch/components/Input';
import { Button } from '../../../stitch/components/Button';

const INDUSTRY_ICONS: Record<Industry, React.ReactNode> = {
    [Industry.SOLAR]: <Sun className="w-4 h-4" />,
    [Industry.UTILITIES]: <Zap className="w-4 h-4" />,
    [Industry.TELECOM]: <LayoutTemplate className="w-4 h-4" />,
    [Industry.CONSTRUCTION]: <BrainCircuit className="w-4 h-4" />,
    [Industry.INSURANCE]: <FileText className="w-4 h-4" />,
};

const THEMES = [
    { id: ReportTheme.TECHNICAL, name: 'Technical', desc: 'Sleek dark theme, operational details.' },
    { id: ReportTheme.EXECUTIVE, name: 'Executive', desc: 'Premium light layout, bold branding.' },
    { id: ReportTheme.MINIMAL, name: 'Minimal', desc: 'Monochrome structure, compact view.' }
];

const PRESET_COLORS = [
    { hex: '#0f172a', name: 'Navy' },
    { hex: '#4f46e5', name: 'Indigo' },
    { hex: '#0d9488', name: 'Teal' },
    { hex: '#16a34a', name: 'Emerald' },
    { hex: '#f59e0b', name: 'Amber' },
    { hex: '#dc2626', name: 'Crimson' }
];

const TOGGLES = [
    { key: 'showExecutiveSummary', label: 'Executive Summary', desc: 'Main report summary narrative' },
    { key: 'showSiteIntelligence', label: 'Site Context & Weather', desc: 'Metadata, mapping, and weather details' },
    { key: 'showStrategicAssessment', label: 'Strategic Assessment', desc: 'Risk mitigation and remediation strategies' },
    { key: 'showCostAnalysis', label: 'Cost Analysis & Estimates', desc: 'Repair estimates, damage subtotals, and pricing' },
    { key: 'showDetailedImagery', label: 'Detailed Imagery Gallery', desc: 'High-res annotated inspection imagery' },
    { key: 'showAuditTrail', label: 'Audit & Version Trail', desc: 'Modification history log of the document' }
] as const;

const ReportConfiguration: React.FC = () => {
    const {
        title, setTitle,
        client, setClient,
        industry,
        selectedTemplate, setSelectedTemplate,
        theme, setTheme,
        branding, setBranding,
        config, setConfig,
        setStep
    } = useReport();

    const handleNext = () => {
        if (title && client) setStep(2);
    };

    const handleTemplateSelect = (t: IndustryTemplate) => {
        setSelectedTemplate(t);
    };

    const toggleConfig = (key: keyof ReportConfig) => {
        setConfig({
            ...config,
            [key]: !config[key]
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">

                {/* Basic Info */}
                <Card variant="glass" className="p-6 border-slate-200/60 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Report Details</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Inspection Title</label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Q1 Solar Array Audit - Sector 7"
                                className="h-11"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client Name</label>
                            <Input
                                value={client}
                                onChange={e => setClient(e.target.value)}
                                placeholder="e.g. Acme Energy Corp"
                                className="h-11"
                            />
                        </div>
                    </div>
                </Card>

                {/* Custom Branding & Styling */}
                <Card variant="glass" className="p-6 border-slate-200/60 shadow-sm space-y-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <Palette className="w-4 h-4 text-blue-600" /> Branding & Styling
                    </h3>

                    {/* Theme Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2.5">Report Theme</label>
                        <div className="grid grid-cols-3 gap-3">
                            {THEMES.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTheme(t.id)}
                                    className={`flex flex-col text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer
                                        ${theme === t.id
                                            ? 'border-blue-500 bg-blue-50/20 shadow-sm'
                                            : 'border-slate-100 bg-white/40 hover:border-slate-200 hover:bg-slate-50/30'}`}
                                >
                                    <span className={`font-bold text-sm ${theme === t.id ? 'text-blue-700' : 'text-slate-700'}`}>{t.name}</span>
                                    <span className="text-[10px] text-slate-400 mt-1 leading-normal font-medium">{t.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Company Name & Logo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branding Company Name</label>
                            <Input
                                value={branding?.companyName || ''}
                                onChange={e => setBranding({ ...branding, companyName: e.target.value })}
                                placeholder="e.g. Coatzdrone USA"
                                className="h-11"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branding Logo URL</label>
                            <Input
                                value={branding?.logo || ''}
                                onChange={e => setBranding({ ...branding, logo: e.target.value })}
                                placeholder="https://example.com/logo.png"
                                className="h-11"
                            />
                        </div>
                    </div>

                    {/* Accent Color Customization */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2.5">Branding Primary Color</label>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex gap-2">
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        onClick={() => setBranding({ ...branding, primaryColor: c.hex })}
                                        className="w-8 h-8 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer hover:scale-105"
                                        style={{
                                            backgroundColor: c.hex,
                                            borderColor: branding?.primaryColor === c.hex ? '#3b82f6' : 'transparent',
                                            boxShadow: branding?.primaryColor === c.hex ? '0 0 0 2px rgba(59,130,246,0.3)' : 'none'
                                        }}
                                        title={c.name}
                                    >
                                        {branding?.primaryColor === c.hex && (
                                            <Check className="w-4 h-4 text-white stroke-[3px]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={branding?.primaryColor || '#0f172a'}
                                    onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                                    className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0 bg-transparent shrink-0"
                                />
                                <span className="text-xs font-mono text-slate-500 font-semibold">{branding?.primaryColor || '#0f172a'}</span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Industry Context (Read-Only) */}
                <Card variant="glass" className="p-6 border-slate-200/60 shadow-sm bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Analysis Target</h3>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            {INDUSTRY_ICONS[industry]}
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 tracking-tight">{industry} Sector</p>
                            <p className="text-xs text-slate-500 font-medium">Neural models optimized for {industry.toLowerCase()} assets.</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Right Column: Templates, Layout & Actions */}
            <div className="lg:col-span-5 space-y-6">

                {/* Layout Toggles */}
                <Card variant="glass" className="p-6 border-slate-200/60 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Layout Sections</h3>
                    <div className="space-y-4">
                        {TOGGLES.map(t => {
                            const isChecked = config[t.key] !== false;
                            return (
                                <label key={t.key} className="flex items-start gap-3 cursor-pointer hover:bg-slate-50/40 p-2 rounded-lg -m-2 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleConfig(t.key)}
                                        className="w-4.5 h-4.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5 shrink-0"
                                    />
                                    <div>
                                        <span className="block text-sm font-semibold text-slate-700">{t.label}</span>
                                        <span className="block text-xs text-slate-400 mt-0.5 leading-normal font-medium">{t.desc}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </Card>

                {/* Templates Selector */}
                <Card variant="glass" className="p-6 border-slate-200/60 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Report Template</h3>
                    <div className="space-y-2">
                        {(INDUSTRY_TEMPLATES[industry] || INDUSTRY_TEMPLATES[Industry.SOLAR]).map(t => (
                            <button
                                key={t.id}
                                onClick={() => handleTemplateSelect(t)}
                                className={`w-full text-left p-4 rounded-lg border-2 transition-all cursor-pointer
                                    ${selectedTemplate.id === t.id
                                        ? 'bg-white border-blue-500 shadow-sm'
                                        : 'bg-white/60 border-transparent hover:bg-white hover:border-slate-200'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-semibold text-sm ${selectedTemplate.id === t.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                        {t.name}
                                    </span>
                                    {selectedTemplate.id === t.id && (
                                        <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                    )}
                                </div>
                                <p className={`text-xs leading-relaxed ${selectedTemplate.id === t.id ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {t.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Action button */}
                <div className="flex justify-end">
                    <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={!title || !client}
                        className="h-11 px-8 rounded-lg gap-2"
                    >
                        Continue <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ReportConfiguration;
