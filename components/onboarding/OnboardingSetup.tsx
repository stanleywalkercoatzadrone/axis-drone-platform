import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Settings2, ShieldCheck, ChevronRight, ToggleLeft, ToggleRight, Lock } from 'lucide-react';
import apiClient from '../../src/services/apiClient';

const SECTIONS = [
    {
        id: 'operations',
        title: 'Operations',
        fields: [
            { id: 'work_structure', name: 'Work Structure', locked: true },
            { id: 'default_sla_hours', name: 'SLA Target' },
            { id: 'preferred_contact_method', name: 'Contact Method' }
        ]
    },
    {
        id: 'deliverables',
        title: 'Deliverables',
        fields: [
            { id: 'deliverable_formats', name: 'File Formats', locked: true },
            { id: 'qa_required', name: 'Internal QA Toggle' }
        ]
    },
    {
        id: 'billing',
        title: 'Billing & Invoicing',
        fields: [
            { id: 'billing_contact_email', name: 'Billing Email' },
            { id: 'po_required', name: 'PO Requirement' },
            { id: 'invoice_delivery_method', name: 'Invoice Method' }
        ]
    }
];

const OnboardingSetup: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const templateId = searchParams.get('templateId') || 'custom';

    const [config, setConfig] = useState<any>({
        sections: {
            operations: { enabled: true, fields: { work_structure: { enabled: true, required: true }, default_sla_hours: { enabled: true, required: false }, preferred_contact_method: { enabled: true, required: false } } },
            deliverables: { enabled: true, fields: { deliverable_formats: { enabled: true, required: true }, qa_required: { enabled: true, required: false } } },
            billing: { enabled: true, fields: { billing_contact_email: { enabled: true, required: true }, po_required: { enabled: true, required: false }, invoice_delivery_method: { enabled: true, required: false } } }
        }
    });

    const toggleSection = (sectionId: string) => {
        if (sectionId === 'operations' || sectionId === 'deliverables') return; // Cannot disable core
        setConfig({
            ...config,
            sections: {
                ...config.sections,
                [sectionId]: { ...config.sections[sectionId], enabled: !config.sections[sectionId].enabled }
            }
        });
    };

    const toggleField = (sectionId: string, fieldId: string) => {
        const field = config.sections[sectionId].fields[fieldId];
        setConfig({
            ...config,
            sections: {
                ...config.sections,
                [sectionId]: {
                    ...config.sections[sectionId],
                    fields: {
                        ...config.sections[sectionId].fields,
                        [fieldId]: { ...field, enabled: !field.enabled }
                    }
                }
            }
        });
    };

    const handleStart = async () => {
        try {
            const response = await apiClient.post('/onboarding/configs', {
                templateName: 'Custom Setup',
                config: config
            });
            navigate(`/clients/new/step-1?configId=${response.data.data.id}`);
        } catch (err) {
            console.error('Failed to create config:', err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="mb-12 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Pre-Wizard Setup</h1>
                    <p className="text-slate-400">Choose which fields to collect now. Hidden fields remain editable later (Option A).</p>
                </div>
                <Settings2 className="w-12 h-12 text-slate-800" />
            </div>

            <div className="space-y-6">
                {SECTIONS.map(section => (
                    <div key={section.id} className={`bg-slate-900/50 border rounded-2xl overflow-hidden transition-all ${config.sections[section.id].enabled ? 'border-slate-800' : 'border-slate-800/50 opacity-50'}`}>
                        <div className="p-4 bg-slate-800/30 flex items-center justify-between">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                {section.title}
                                {section.id === 'operations' && <Lock className="w-3 h-3 text-slate-500" />}
                            </h3>
                            <button onClick={() => toggleSection(section.id)} className="text-blue-500 text-sm font-medium">
                                {config.sections[section.id].enabled ? 'Disable Section' : 'Enable Section'}
                            </button>
                        </div>

                        {config.sections[section.id].enabled && (
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {section.fields.map(field => (
                                    <div key={field.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/50">
                                        <div className="flex items-center gap-3">
                                            {field.locked ? <ShieldCheck className="w-4 h-4 text-slate-500" /> : <div className="w-4" />}
                                            <span className="text-sm text-slate-300">{field.name}</span>
                                        </div>
                                        {!field.locked && (
                                            <button onClick={() => toggleField(section.id, field.id)}>
                                                {config.sections[section.id].fields[field.id].enabled ?
                                                    <ToggleRight className="w-8 h-8 text-blue-500" /> :
                                                    <ToggleLeft className="w-8 h-8 text-slate-700" />
                                                }
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-12 flex justify-end">
                <button
                    onClick={handleStart}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-10 py-4 text-white font-bold rounded-2xl transition-all shadow-[0_10px_30px_rgba(37,99,235,0.3)]"
                >
                    Initialize Wizard <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default OnboardingSetup;
