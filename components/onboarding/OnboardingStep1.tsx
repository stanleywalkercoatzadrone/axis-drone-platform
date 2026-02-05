import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, ChevronRight, Building2, Mail, Globe, MapPin } from 'lucide-react';
import OnboardingStepper from './OnboardingStepper';
import apiClient from '../../src/services/apiClient';

const OnboardingStep1: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const configId = searchParams.get('configId');

    const [form, setForm] = useState({
        name: '',
        industryKey: 'solar',
        email: '',
        phone: '',
        address: { street: '', city: '', state: '', zip: '' }
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // 1. Create the Client
            const clientRes = await apiClient.post('/clients', form);
            const client = clientRes.data.data;

            // 2. Attach configId if exists
            if (configId) {
                await apiClient.put(`/onboarding/configs/${configId}`, { clientId: client.id });
                await apiClient.put(`/onboarding/${client.id}/step`, { step: 1, status: 'IN_PROGRESS' });
            }

            // 3. Navigate to Step 2
            navigate(`/clients/new/step-2?clientId=${client.id}&configId=${configId || ''}`);
        } catch (err) {
            console.error('Failed to save Step 1:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto py-12 px-6">
            <OnboardingStepper
                currentStep={1}
                steps={[
                    { id: 1, title: 'Company', description: 'Identity' },
                    { id: 2, title: 'Operations', description: 'Logistics' },
                    { id: 3, title: 'Access', description: 'Permissions' }
                ]}
            />

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                <div className="p-8 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <Building2 className="w-6 h-6 text-blue-500" />
                        Client Identity
                    </h2>
                    <p className="text-slate-400 mt-1">Basic company and contact information.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name *</label>
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="Acme Solar Inc."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Industry</label>
                            <select
                                value={form.industryKey}
                                onChange={e => setForm({ ...form, industryKey: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="solar">Solar</option>
                                <option value="telecom">Telecom</option>
                                <option value="construction">Construction</option>
                                <option value="insurance">Insurance</option>
                                <option value="utilities">Utilities</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Email *</label>
                            <input
                                type="email"
                                required
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="contact@acmesolar.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                            <input
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>
                    </div>

                    <div className="pt-8 flex items-center justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/clients/new/start')}
                            className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                        >
                            Back
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-501 px-8 py-3 text-white font-bold rounded-xl transition-all active:scale-95 shadow-[0_10px_30px_rgba(37,99,235,0.3)] disabled:opacity-50"
                        >
                            {isLoading ? 'Creating...' : (
                                <>
                                    Save & Continue <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OnboardingStep1;
