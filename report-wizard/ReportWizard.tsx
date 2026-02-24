import React from 'react';
import { ReportProvider, useReport } from './ReportContext';
import ReportConfiguration from './steps/ReportConfiguration';
import DataIngest from './steps/DataIngest';
import AIAnalysis from './steps/AIAnalysis';
import ReportReview from './steps/ReportReview';
import { Check, ChevronRight, LayoutTemplate, X } from 'lucide-react';

interface ReportWizardProps {
    onBack: () => void;
}

const WizardContent: React.FC<ReportWizardProps> = ({ onBack }) => {
    const { step, setStep, title } = useReport();

    const steps = [
        { num: 1, label: 'Configuration', component: <ReportConfiguration /> },
        { num: 2, label: 'Data Ingest', component: <DataIngest /> },
        { num: 3, label: 'AI Analysis', component: <AIAnalysis /> },
        { num: 4, label: 'Review & Finalize', component: <ReportReview onBack={onBack} /> }
    ];

    const currentStep = steps.find(s => s.num === step);

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500 font-sans">
            {/* Wizard Header */}
            <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4 pt-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{title || 'New Inspection Report'}</h1>
                    <p className="text-slate-500 text-sm">Step {step} of {steps.length}: {currentStep?.label}</p>
                </div>

                <div className="flex items-center gap-8">
                    {/* Progress Indicators */}
                    <div className="flex items-center gap-4">
                        {steps.map(s => (
                            <div key={s.num} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border transition-all 
                    ${step === s.num ? 'border-blue-600 bg-blue-50 text-blue-600' :
                                        step > s.num ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-400'}`}>
                                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                                </div>
                                <span className={`text-sm font-medium ${step === s.num ? 'text-blue-700' : 'text-slate-500'}`}>{s.label}</span>
                                {s.num < steps.length && <div className="w-8 h-px bg-slate-200" />}
                            </div>
                        ))}
                    </div>

                    <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Step Content */}
            <div className="min-h-[600px]">
                {currentStep?.component}
            </div>
        </div>
    );
};

const ReportWizard: React.FC<ReportWizardProps> = (props) => {
    return (
        <ReportProvider>
            <WizardContent {...props} />
        </ReportProvider>
    );
};

export default ReportWizard;
