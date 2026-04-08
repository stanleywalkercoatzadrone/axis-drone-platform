import React from 'react';
import { Star, Zap, Shield, ChevronRight, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../src/services/apiClient';

const TEMPLATES = [
    {
        id: 'solar_minimal',
        name: 'Solar — Minimal',
        industry: 'solar',
        icon: Zap,
        description: 'Basic info + core deliverables. Fast setup, ideal for quick client additions.',
        accentColor: 'from-amber-500/20 to-transparent',
        borderColor: 'border-amber-500/20 hover:border-amber-400/40',
        iconColor: 'text-amber-400',
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
        description: 'Complete operational, billing, and solar configuration. Recommended for enterprise clients.',
        recommended: true,
        accentColor: 'from-blue-500/20 to-transparent',
        borderColor: 'border-blue-500/40 hover:border-blue-400/60',
        iconColor: 'text-blue-400',
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
        description: 'Standard deliverables for claims processing and aerial inspections.',
        accentColor: 'from-violet-500/20 to-transparent',
        borderColor: 'border-violet-500/20 hover:border-violet-400/40',
        iconColor: 'text-violet-400',
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
            } else {
                navigate('/clients/new/step-1');
            }
        } catch (err) {
            console.error('Failed to create onboarding config:', err);
            navigate('/clients/new/step-1');
        }
    };

    return (
        <div className="min-h-full bg-slate-900 px-8 py-10">
            <div className="max-w-4xl mx-auto space-y-10">

                {/* Back link */}
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Clients
                </button>

                {/* Header */}
                <div className="space-y-2">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Client Onboarding
                    </div>
                    <h1 className="text-2xl font-bold text-white">Onboard a New Client</h1>
                    <p className="text-sm text-slate-400">Choose a template to get started, or customize your own workflow below.</p>
                </div>

                {/* Template cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {TEMPLATES.map(tpl => (
                        <button
                            key={tpl.id}
                            onClick={() => handleSelectTemplate(tpl)}
                            className={`relative group text-left rounded-2xl border bg-slate-900/60 backdrop-blur-sm p-6 transition-all hover:shadow-xl hover:shadow-black/30 ${tpl.borderColor}`}
                        >
                            {/* Gradient top */}
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${tpl.accentColor} opacity-40 pointer-events-none`} />

                            {tpl.recommended && (
                                <span className="absolute -top-3 left-5 px-2.5 py-0.5 bg-blue-600 text-[9px] font-bold text-white rounded-full uppercase tracking-wider shadow-lg">
                                    Recommended
                                </span>
                            )}

                            <div className="relative space-y-3">
                                <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${tpl.iconColor}`}>
                                    <tpl.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">{tpl.name}</h3>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tpl.description}</p>
                                </div>
                                <div className={`inline-flex items-center gap-1 text-xs font-bold group-hover:gap-2 transition-all ${tpl.iconColor}`}>
                                    Select Template <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Custom option */}
                <div className="rounded-2xl border border-dashed border-white/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <SlidersHorizontal className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">Custom Workflow</p>
                            <p className="text-xs text-slate-500 mt-0.5">Need more control? Configure every field from scratch.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/clients/new/setup')}
                        className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
                    >
                        Customize Fields
                    </button>
                </div>

            </div>
        </div>
    );
};

export default OnboardingStart;
