import React from 'react';
import { useReport } from '../ReportContext';
import { Industry, INDUSTRY_TEMPLATES, IndustryTemplate } from '../../../types';
import { Sun, Zap, LayoutTemplate, BrainCircuit, FileText, ChevronRight, Check } from 'lucide-react';

import { Card } from '../../../src/stitch/components/Card';
import { Input } from '../../../src/stitch/components/Input';
import { Button } from '../../../src/stitch/components/Button';

const INDUSTRY_ICONS: Record<Industry, React.ReactNode> = {
    [Industry.SOLAR]: <Sun className="w-4 h-4" />,
    [Industry.UTILITIES]: <Zap className="w-4 h-4" />,
    [Industry.TELECOM]: <LayoutTemplate className="w-4 h-4" />,
    [Industry.CONSTRUCTION]: <BrainCircuit className="w-4 h-4" />,
    [Industry.INSURANCE]: <FileText className="w-4 h-4" />,
};

const ReportConfiguration: React.FC = () => {
    const {
        title, setTitle,
        client, setClient,
        industry, setIndustry,
        selectedTemplate, setSelectedTemplate,
        setStep
    } = useReport();

    const handleNext = () => {
        if (title && client) setStep(2);
    };

    const handleTemplateSelect = (t: IndustryTemplate) => {
        setSelectedTemplate(t);
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
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client</label>
                            <Input
                                value={client}
                                onChange={e => setClient(e.target.value)}
                                placeholder="e.g. Acme Energy Corp"
                                className="h-11"
                            />
                        </div>
                    </div>
                </Card>

                {/* Industry Selection */}
                <Card variant="glass" className="p-6 border-slate-200/60 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Industry</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.values(Industry).map(ind => (
                            <button
                                key={ind}
                                onClick={() => setIndustry(ind)}
                                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all
                                    ${industry === ind
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                            >
                                <span className={`shrink-0 ${industry === ind ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {INDUSTRY_ICONS[ind]}
                                </span>
                                <span className="font-medium text-sm">{ind}</span>
                                {industry === ind && <Check className="w-3.5 h-3.5 ml-auto text-blue-600 shrink-0" />}
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Right Column: Templates & Actions */}
            <div className="lg:col-span-5 space-y-6">
                <Card variant="glass" className="p-6 border-slate-200/60 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Report Template</h3>
                    <div className="space-y-2">
                        {INDUSTRY_TEMPLATES[industry].map(t => (
                            <button
                                key={t.id}
                                onClick={() => handleTemplateSelect(t)}
                                className={`w-full text-left p-4 rounded-lg border-2 transition-all
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
