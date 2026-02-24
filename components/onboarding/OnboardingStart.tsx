import React from 'react';
import { Star, Zap, Building2, Shield, HardHat, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../src/services/apiClient';

const TEMPLATES = [
    {
        id: 'solar_minimal',
        name: 'Solar — Minimal',
        industry: 'solar',
        icon: Zap,
        description: 'Basic info + core deliverables. Fast setup.',
        config: {
            sections: {
                operations: { enabled: true, fields: { work_structure: { enabled: true, required: true } } },
                deliverables: { enabled: true, fields: { deliverable_formats: { enabled: true, required: true } } },
                billing: { enabled: false, fields: {} }
            }
        }
    },
    {
        id: 'solar_full',
        name: 'Solar — Full',
        industry: 'solar',
        icon: Star,
        description: 'Complete operational, billing, and solar setup.',
        recommended: true,
        config: {
            sections: {
                operations: { enabled: true, fields: { work_structure: { enabled: true, required: true }, default_sla_hours: { enabled: true, required: false } } },
                deliverables: { enabled: true, fields: { deliverable_formats: { enabled: true, required: true } } },
                billing: { enabled: true, fields: { billing_contact_email: { enabled: true, required: true } } }
            }
        }
    },
    {
        id: 'insurance_standard',
        name: 'Insurance — Standard',
        industry: 'insurance',
        icon: Shield,
        description: 'Standard deliverables for claims & inspections.',
        config: {
            sections: {
                operations: { enabled: true, fields: {} },
                deliverables: { enabled: true, fields: {} },
                billing: { enabled: true, fields: {} }
            }
        }
    }
];

const OnboardingStart: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectTemplate = async (template: typeof TEMPLATES[0]) => {
        try {
            const response = await apiClient.post('/onboarding/configs', {
                templateName: template.name,
                industry: template.industry,
                config: template.config
            });
            if (response.data.success) {
                navigate(`/clients/new/step-1?configId=${response.data.data.id}`);
            }
        } catch (err) {
            console.error('Failed to create onboarding config:', err);
        }
    };

    return (
        <div className="max-w-5xl mx-auto py-12 px-6">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Start New Client Onboarding</h1>
                <p className="text-slate-600 font-medium tracking-tight">Select a template to begin, or customize your own workflow.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TEMPLATES.map((tpl) => (
                    <button
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`
                            relative group p-6 rounded-2xl border-2 text-left transition-all duration-300
                            ${tpl.recommended ? 'bg-blue-600/10 border-blue-500/50 hover:border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]' :
                                'bg-slate-900 border-slate-800 hover:border-slate-700'}
                        `}
                    >
                        {tpl.recommended && (
                            <span className="absolute -top-3 left-6 px-2 py-1 bg-blue-600 text-[10px] font-bold text-white rounded uppercase tracking-wider">
                                Recommended
                            </span>
                        )}
                        <tpl.icon className={`w-8 h-8 mb-4 ${tpl.recommended ? 'text-blue-600' : 'text-slate-500'}`} />
                        <h3 className={`text-lg font-bold mb-2 transition-colors ${tpl.recommended ? 'text-slate-900' : 'text-slate-800'}`}>{tpl.name}</h3>
                        <p className={`text-sm mb-6 flex-grow font-medium ${tpl.recommended ? 'text-slate-700' : 'text-slate-600'}`}>{tpl.description}</p>
                        <div className="flex items-center gap-2 text-sm font-semibold text-blue-500 group-hover:gap-3 transition-all">
                            Continue <ChevronRight className="w-4 h-4" />
                        </div>
                    </button>
                ))}
            </div>

            <div className="mt-12 p-6 rounded-xl border border-dashed border-slate-800 text-center">
                <p className="text-slate-500 mb-4 italic">Need more control? Customize every field before you start.</p>
                <button
                    onClick={() => navigate('/clients/new/setup')}
                    className="px-6 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                >
                    Customize fields
                </button>
            </div>
        </div>
    );
};

export default OnboardingStart;
