import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, ChevronRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import OnboardingStepper from './OnboardingStepper';
import StakeholderList from '../StakeholderList';
import apiClient from '../../src/services/apiClient';

const OnboardingStep3: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clientId = searchParams.get('clientId');

    const [isLoading, setIsLoading] = useState(false);
    const [client, setClient] = useState<any>(null);

    useEffect(() => {
        if (!clientId) return;
        const fetchClient = async () => {
            try {
                const response = await apiClient.get(`/clients/${clientId}`);
                if (response.data.success) {
                    setClient(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching client:', error);
            }
        };
        fetchClient();
    }, [clientId]);

    const handleFinish = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            // Mark onboarding as complete
            await apiClient.put(`/onboarding/${clientId}/step`, {
                step: 3,
                status: 'COMPLETED'
            });
            // Redirect to client detail page
            navigate('/clients');
        } catch (err) {
            console.error('Failed to finish onboarding:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!clientId) return <div className="p-20 text-center text-red-500 font-bold text-2xl">Error: No Client ID provided.</div>;

    return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            <OnboardingStepper
                currentStep={3}
                steps={[
                    { id: 1, title: 'Company', description: 'Identity' },
                    { id: 2, title: 'Operations', description: 'Logistics' },
                    { id: 3, title: 'Access', description: 'Permissions' }
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Stakeholders & Access</h1>
                                <p className="text-slate-500">Configure who has access to the platform and individual projects.</p>
                            </div>
                        </div>

                        {/* Existing StakeholderList component does the heavy lifting */}
                        <div className="min-h-[300px]">
                            <StakeholderList clientId={clientId} />
                        </div>
                    </div>

                    {/* Navigation Actions */}
                    <div className="flex items-center justify-between pt-8 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-slate-600 font-bold hover:text-slate-900 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Operations
                        </button>

                        <button
                            onClick={handleFinish}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 px-10 py-4 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center gap-3 disabled:opacity-50"
                        >
                            {isLoading ? 'Completing...' : (
                                <>
                                    <span>Finish Onboarding</span>
                                    <CheckCircle2 className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Info Panel */}
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sticky top-24 shadow-2xl">
                        <h3 className="font-bold text-white mb-6 text-lg">Platform Access</h3>
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-white font-bold text-sm">Secure Invites</p>
                                    <p className="text-slate-400 text-xs leading-relaxed">Stakeholders will receive an encrypted link to set their own secure passwords.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle2 className="w-5 h-5 text-purple-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-white font-bold text-sm">Scoped RBAC</p>
                                    <p className="text-slate-400 text-xs leading-relaxed">Users are restricted to their own organization's data and specifically assigned projects.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
                            <p className="text-xs text-slate-400 font-medium italic underline decoration-slate-600 underline-offset-4">
                                Tip: You can always add more stakeholders later from the Client Detail page.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingStep3;
