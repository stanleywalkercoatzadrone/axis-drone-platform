import React from 'react';
import { useReport } from '../ReportContext';
import { Industry, INDUSTRY_TEMPLATES, ReportTheme } from '../../../types';
import { Sun, Zap, LayoutTemplate, BrainCircuit, FileText, ChevronRight, Sparkles } from 'lucide-react';

const ReportConfiguration: React.FC = () => {
    const {
        title, setTitle,
        client, setClient,
        industry, setIndustry,
        theme, setTheme,
        branding, setBranding,
        selectedTemplate,
        step, setStep
    } = useReport();

    const handleNext = () => {
        if (title && client) setStep(2);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Column: Inputs */}
            <div className="lg:col-span-7 space-y-8">

                {/* Basic Info */}
                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full block"></span>
                        Project Details
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Report Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Q1 Solar Array Audit - Sector 7"
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Client / Stakeholder</label>
                            <input
                                type="text"
                                value={client}
                                onChange={e => setClient(e.target.value)}
                                placeholder="e.g. Acme Energy Corp"
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                            />
                        </div>
                    </div>
                </section>

                {/* Industry Selection */}
                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-purple-600 rounded-full block"></span>
                        Industry Sector
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {Object.values(Industry).map(ind => (
                            <button
                                key={ind}
                                onClick={() => setIndustry(ind)}
                                className={`px-4 py-4 rounded-xl border text-sm font-medium transition-all text-left flex flex-col gap-2 
                  ${industry === ind
                                        ? 'border-purple-500 bg-purple-50 text-purple-900 ring-1 ring-purple-500'
                                        : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50 text-slate-600'}`}
                            >
                                {ind === Industry.SOLAR ? <Sun className="w-5 h-5 mb-1" /> : <Zap className="w-5 h-5 mb-1" />}
                                {ind}
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            {/* Right Column: Templates & Config */}
            <div className="lg:col-span-5 space-y-8">
                <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <LayoutTemplate className="w-5 h-5 text-slate-500" /> Protocol Template
                    </h3>
                    <div className="space-y-3">
                        {INDUSTRY_TEMPLATES[industry].map(t => (
                            <div
                                key={t.id}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedTemplate.id === t.id ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white/50 border-slate-200 hover:bg-white'}`}
                            // onClick={() => setSelectedTemplate(t)} // Context needs to support this if we want specific template selection
                            >
                                <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                                <div className="text-xs text-slate-500 mt-1 leading-relaxed">{t.description}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleNext}
                        disabled={!title || !client}
                        className="group flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200 hover:shadow-2xl hover:-translate-y-1"
                    >
                        Start Ingest <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportConfiguration;
