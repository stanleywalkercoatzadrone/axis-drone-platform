import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, ChevronRight, Settings, FileBox, Landmark, Sun, AlertCircle, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import OnboardingStepper from './OnboardingStepper';
import apiClient from '../../src/services/apiClient';
import { ClientSettings } from '../../types';

const OnboardingStep2: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clientId = searchParams.get('clientId');
    const configId = searchParams.get('configId');

    const [isLoading, setIsLoading] = useState(false);
    const [client, setClient] = useState<any>(null);
    const [settings, setSettings] = useState<Partial<ClientSettings>>({
        workStructure: 'site',
        defaultSlaHours: 48,
        preferredContactMethod: 'email',
        notificationPreferences: {
            notifyOnUploadComplete: true,
            notifyOnDeliverableReady: true,
            notifyOnOverdue: true
        },
        deliverableFormats: ['pdf'],
        qaRequired: true,
        dataDestinationType: 'google_drive',
        billingCountry: 'US',
        poRequired: false,
        invoiceDeliveryMethod: 'email'
    });

    useEffect(() => {
        if (!clientId) return;
        apiClient.get(`/clients/${clientId}`).then(res => setClient(res.data.data));
    }, [clientId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await apiClient.put(`/onboarding/${clientId}/settings`, settings);
            await apiClient.put(`/onboarding/${clientId}/step`, { step: 2, status: 'IN_PROGRESS' });
            navigate(`/clients/new/step-3?clientId=${clientId}`);
        } catch (err) {
            console.error('Failed to save Step 2:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!clientId) return <div className="p-20 text-center text-red-500">Error: No Client ID provided.</div>;

    return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            <OnboardingStepper
                currentStep={2}
                steps={[
                    { id: 1, title: 'Company', description: 'Identity' },
                    { id: 2, title: 'Operations', description: 'Logistics' },
                    { id: 3, title: 'Access', description: 'Permissions' }
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8 pb-20">

                    {/* Operations */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                            <Settings className="w-5 h-5 text-blue-500" />
                            <h2 className="font-bold text-white">Operations Defaults</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">How do you organize work?</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                                    value={settings.workStructure}
                                    onChange={e => setSettings({ ...settings, workStructure: e.target.value as any })}
                                >
                                    <option value="site">By Site</option>
                                    <option value="project">By Project</option>
                                    <option value="both">Both</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Default Turnaround (Hours)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white"
                                    value={settings.defaultSlaHours}
                                    onChange={e => setSettings({ ...settings, defaultSlaHours: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Deliverables */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                            <FileBox className="w-5 h-5 text-purple-500" />
                            <h2 className="font-bold text-white">Deliverables & QA</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Required Formats</label>
                                <div className="flex flex-wrap gap-2">
                                    {['pdf', 'csv', 'xlsx', 'kml', 'kmz', 'shp'].map(fmt => (
                                        <label key={fmt} className={`
                                            px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all
                                            ${settings.deliverableFormats?.includes(fmt) ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}
                                        `}>
                                            <input
                                                type="checkbox"
                                                hidden
                                                checked={settings.deliverableFormats?.includes(fmt)}
                                                onChange={() => {
                                                    const current = settings.deliverableFormats || [];
                                                    setSettings({ ...settings, deliverableFormats: current.includes(fmt) ? current.filter(f => f !== fmt) : [...current, fmt] });
                                                }}
                                            />
                                            {fmt.toUpperCase()}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Solar Panel - Conditional */}
                    {(client?.industry === 'Solar' || client?.industry_name === 'Solar') && (
                        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl overflow-hidden backdrop-blur-sm">
                            <div className="p-6 border-b border-orange-500/20 flex items-center gap-3">
                                <Sun className="w-5 h-5 text-orange-500" />
                                <h2 className="font-bold text-white">Solar Asset Configuration</h2>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">LBD Template</label>
                                    <select className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white">
                                        <option>SenseHawk</option>
                                        <option>Inflights</option>
                                        <option>Custom</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-8 border-t border-slate-800">
                        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">Back to Identity</button>
                        <div className="flex gap-4">
                            <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 text-white font-bold rounded-xl transition-all shadow-[0_10px_30px_rgba(37,99,235,0.3)]">
                                {isLoading ? 'Saving...' : 'Save & Continue'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Right Summary Panel */}
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-24">
                        <h3 className="font-bold text-white mb-6 underline decoration-blue-500 underline-offset-8">Setup Summary</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Work Unit</span>
                                <span className="text-white capitalize font-medium">{settings.workStructure}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">SLA Target</span>
                                <span className="text-white font-medium">{settings.defaultSlaHours}h</span>
                            </div>
                            <div className="flex justify-between items-start text-sm">
                                <span className="text-slate-500">Deliverables</span>
                                <div className="flex flex-wrap gap-1 justify-end">
                                    {settings.deliverableFormats?.map(f => (
                                        <span key={f} className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{f.toUpperCase()}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
                            <div className="flex gap-3 text-xs text-blue-500 items-start">
                                <AlertCircle className="w-4 h-4 mt-0.5" />
                                <span>Changes are saved instantly when you continue to the next step.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingStep2;
