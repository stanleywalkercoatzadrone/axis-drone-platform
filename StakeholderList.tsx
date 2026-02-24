import React, { useState, useEffect } from 'react';
import apiClient from '../src/services/apiClient';
import { useIndustry } from '../src/context/IndustryContext';
import StakeholderForm from './StakeholderForm';
import { Mail, Phone, User, Plus } from 'lucide-react';

interface Stakeholder {
    id: string;
    full_name: string;
    email: string;
    title: string;
    type: string;
    phone: string;
}

const StakeholderList: React.FC<{ clientId: string }> = ({ clientId }) => {
    const { tLabel } = useIndustry();
    const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchStakeholders = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/clients/${clientId}/stakeholders`);
                if (response.data.success) {
                    setStakeholders(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching stakeholders:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStakeholders();
    }, [clientId]);

    if (isLoading) return <div className="py-10 text-center text-sm text-slate-500">Loading {tLabel('stakeholder').toLowerCase()}s...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">{tLabel('stakeholder')}s</h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add {tLabel('stakeholder')}
                </button>
            </div>

            {stakeholders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200">
                    <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No {tLabel('stakeholder').toLowerCase()}s added yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stakeholders.map((person) => (
                        <div key={person.id} className="bg-white p-4 rounded-lg border border-slate-200 flex items-start gap-4 hover:border-blue-300 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-900">{person.full_name}</h4>
                                <p className="text-xs text-slate-500 font-medium mb-2">{person.title} • {person.type}</p>
                                <div className="space-y-1">
                                    {person.email && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Mail className="w-3 h-3 text-slate-400" />
                                            <a href={`mailto:${person.email}`} className="hover:text-blue-600 truncate">{person.email}</a>
                                        </div>
                                    )}
                                    {person.phone && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Phone className="w-3 h-3 text-slate-400" />
                                            <span>{person.phone}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isCreating && (
                <StakeholderForm
                    clientId={clientId}
                    onClose={() => setIsCreating(false)}
                    onSuccess={() => {
                        setIsCreating(false);
                        // Trigger refresh - simpler to force reload or re-fetch if I exposed refetch
                        window.location.reload(); // Quick dirty refresh or need to lift state
                    }}
                />
            )}
        </div>
    );
};

export default StakeholderList;
