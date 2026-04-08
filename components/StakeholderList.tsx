import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import StakeholderForm from './StakeholderForm';
import { Mail, Phone, User, Plus, UserCheck } from 'lucide-react';

interface Stakeholder {
    id: string;
    full_name: string;
    email: string;
    title: string;
    type: string;
    phone: string;
}

const StakeholderList: React.FC<{ clientId: string }> = ({ clientId }) => {
    const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    const fetchStakeholders = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get(`/clients/${clientId}/stakeholders`);
            if (response.data.success) setStakeholders(response.data.data);
        } catch (error) {
            console.error('Error fetching POCs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchStakeholders(); }, [clientId]);

    if (isLoading) return (
        <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
            Loading contacts…
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-white">Point of Contact</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Key contacts assigned to this client account.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/20 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add POC
                </button>
            </div>

            {/* List */}
            {stakeholders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 rounded-2xl border border-dashed border-white/10 text-slate-600">
                    <UserCheck className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm font-semibold text-slate-500">No POCs added yet</p>
                    <p className="text-xs text-slate-600 mt-1">Add a point of contact for this client.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stakeholders.map(person => {
                        const initials = person.full_name
                            ? person.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                            : '?';
                        return (
                            <div
                                key={person.id}
                                className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 hover:border-blue-500/25 hover:bg-slate-900/90 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-sm font-black text-blue-300 flex-shrink-0">
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{person.full_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {person.title && (
                                                <span className="text-[10px] text-slate-400 font-semibold">{person.title}</span>
                                            )}
                                            {person.type && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 uppercase tracking-wider">
                                                    {person.type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Contact details */}
                                {(person.email || person.phone) && (
                                    <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                                        {person.email && (
                                            <a
                                                href={`mailto:${person.email}`}
                                                className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-300 transition-colors"
                                            >
                                                <Mail className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{person.email}</span>
                                            </a>
                                        )}
                                        {person.phone && (
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <Phone className="w-3 h-3 flex-shrink-0" />
                                                <span>{person.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {isCreating && (
                <StakeholderForm
                    clientId={clientId}
                    onClose={() => setIsCreating(false)}
                    onSuccess={() => {
                        setIsCreating(false);
                        fetchStakeholders();
                    }}
                />
            )}
        </div>
    );
};

export default StakeholderList;
