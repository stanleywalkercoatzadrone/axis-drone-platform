import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import ClientForm from './ClientForm';
import { useIndustry } from '../context/IndustryContext';
import { Plus, Search, Building2, MapPin, ChevronRight, LayoutGrid, Trash2, Briefcase, Globe, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../src/utils/roleUtils';

interface Client {
    id: string;
    name: string;
    industry_name?: string;
    project_count: string;
    address: any;
    email?: string;
    phone?: string;
}

const INDUSTRY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'Solar':        { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/20'   },
    'Insurance':    { bg: 'bg-blue-500/10',    text: 'text-blue-300',    border: 'border-blue-500/20'    },
    'Utilities':    { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' },
    'Telecom':      { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-500/20'  },
    'Construction': { bg: 'bg-orange-500/10',  text: 'text-orange-300',  border: 'border-orange-500/20'  },
    'General':      { bg: 'bg-slate-500/10',   text: 'text-slate-300',   border: 'border-slate-500/20'   },
};

function industryColor(name?: string) {
    return INDUSTRY_COLORS[name || ''] || INDUSTRY_COLORS['General'];
}

const ClientList: React.FC<{ onSelectClient: (id: string) => void }> = ({ onSelectClient }) => {
    const { currentIndustry, tLabel } = useIndustry();
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => { fetchClients(); }, [currentIndustry]);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (currentIndustry && currentIndustry !== 'default') params.industryId = currentIndustry;
            const response = await apiClient.get('/clients', { params });
            if (response.data.success) setClients(response.data.data);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteClient = async (e: React.MouseEvent, clientId: string, clientName: string) => {
        e.stopPropagation();
        if (!window.confirm(`Delete ${clientName}? This cannot be undone.`)) return;
        try {
            await apiClient.delete(`/clients/${clientId}`);
            fetchClients();
        } catch {
            alert('Failed to delete client');
        }
    };

    const totalProjects = clients.reduce((sum, c) => sum + (parseInt(c.project_count as string) || 0), 0);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Client Management
                    </div>
                    <h1 className="text-2xl font-bold text-white">{tLabel('client')}s</h1>
                    <p className="text-sm text-slate-400">Manage your client accounts and project assignments.</p>
                </div>
                {isAdmin(user) && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        New {tLabel('client')}
                    </button>
                )}
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Clients', value: clients.length, icon: Building2, color: 'text-blue-400' },
                    { label: 'Total Projects', value: totalProjects, icon: Briefcase, color: 'text-emerald-400' },
                    { label: 'Industries', value: new Set(clients.map(c => c.industry_name).filter(Boolean)).size, icon: Globe, color: 'text-violet-400' },
                ].map(stat => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4 flex items-center gap-4 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder={`Search ${tLabel('client')}s…`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition"
                />
            </div>

            {/* Client grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
                    Loading clients…
                </div>
            ) : filteredClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-white/10 text-slate-500">
                    <Building2 className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-semibold text-slate-400">No {tLabel('client')}s found</p>
                    <p className="text-sm mt-1 text-slate-600">
                        {searchTerm ? 'Try a different search term' : `Add your first ${tLabel('client').toLowerCase()} to get started`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredClients.map(client => {
                        const ic = industryColor(client.industry_name);
                        const projectCount = parseInt(client.project_count as string) || 0;
                        const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                        return (
                            <div
                                key={client.id}
                                onClick={() => onSelectClient(client.id)}
                                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm cursor-pointer transition-all hover:border-blue-500/30 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-black/30"
                            >
                                {/* Top accent line */}
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-6 space-y-4">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-sm font-black text-blue-300">
                                                {initials}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm leading-tight group-hover:text-blue-300 transition-colors">
                                                    {client.name}
                                                </h3>
                                                {client.address?.city && (
                                                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3" />
                                                        {client.address.city}{client.address.state ? `, ${client.address.state}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {isAdmin(user) && (
                                                <button
                                                    onClick={e => handleDeleteClient(e, client.id, client.name)}
                                                    className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Delete Client"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-white/5" />

                                    {/* Footer row */}
                                    <div className="flex items-center justify-between">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ic.bg} ${ic.text} ${ic.border}`}>
                                            {client.industry_name || 'General'}
                                        </span>

                                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                                            <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
                                            {projectCount} {tLabel('project')}{projectCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isCreating && (
                <ClientForm
                    onClose={() => setIsCreating(false)}
                    onSuccess={() => { setIsCreating(false); fetchClients(); }}
                />
            )}
        </div>
    );
};

export default ClientList;
