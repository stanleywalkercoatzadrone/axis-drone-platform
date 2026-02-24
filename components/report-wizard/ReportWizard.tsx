import React from 'react';
import { ReportProvider, useReport } from './ReportContext';
import ReportConfiguration from './steps/ReportConfiguration';
import DataIngest from './steps/DataIngest';
import AIAnalysis from './steps/AIAnalysis';
import ReportReview from './steps/ReportReview';
import { Industry, InspectionReport } from '../../types';
import { Check, ChevronRight, LayoutTemplate, X } from 'lucide-react';

import { Heading, Text } from '../../src/stitch/components/Typography';
import { Button } from '../../src/stitch/components/Button';

interface ReportWizardProps {
    onBack: () => void;
    initialIndustry?: Industry | null;
    viewingReport?: InspectionReport | null;
}

const WizardContent: React.FC<ReportWizardProps> = ({ onBack }) => {
    const { step, setStep, title } = useReport();

    const steps = [
        { num: 1, label: 'Configuration', component: <ReportConfiguration /> },
        { num: 2, label: 'Images', component: <DataIngest /> },
        { num: 3, label: 'AI Analysis', component: <AIAnalysis /> },
        { num: 4, label: 'Edit & Finalize', component: <ReportReview onBack={onBack} /> }
    ];


    const currentStep = steps.find(s => s.num === step);

    return (
        <div className="max-w-7xl mx-auto pb-16">
            {/* Wizard Header */}
            <div className="flex items-center justify-between mb-8 pt-6 border-b border-slate-100 pb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">{title || 'New Inspection Report'}</h2>
                    <p className="text-sm text-slate-400 mt-0.5">Step {step} of {steps.length} — {currentStep?.label}</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Step indicators */}
                    <div className="hidden md:flex items-center gap-1">
                        {steps.map((s, idx) => (
                            <React.Fragment key={s.num}>
                                <button
                                    onClick={() => step > s.num && setStep(s.num)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                                        ${step === s.num ? 'bg-slate-900 text-white' :
                                            step > s.num ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer' :
                                                'text-slate-400 cursor-default'}`}
                                >
                                    {step > s.num ? <Check className="w-3 h-3" /> : <span>{s.num}</span>}
                                    {s.label}
                                </button>
                                {idx < steps.length - 1 && (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    <button onClick={onBack} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Step Content */}
            <div className="min-h-[500px]">
                {currentStep?.component}
            </div>
        </div>
    );
};

const ReportWizard: React.FC<ReportWizardProps> = (props) => {
    return (
        <ReportProvider initialReport={props.viewingReport} initialIndustry={props.initialIndustry}>
            <WizardContent {...props} />
        </ReportProvider>
    );
};

export default ReportWizard;
