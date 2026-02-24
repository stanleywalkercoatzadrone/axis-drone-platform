import React, { useState, useEffect } from 'react';
import apiClient from '../src/services/apiClient';
import ClientForm from './ClientForm';
import { useIndustry } from '../src/context/IndustryContext';
import { Plus, Search, Building2, MapPin, ChevronRight, LayoutGrid, List as ListIcon, Trash2 } from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';
import { isAdmin } from '../src/utils/roleUtils';

interface Client {
    id: string;
    name: string;
    industry_name?: string;
    project_count: string;
    address: any;
}

const ClientList: React.FC<{ onSelectClient: (id: string) => void }> = ({ onSelectClient }) => {
    const { currentIndustry, tLabel } = useIndustry();
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchClients();
    }, [currentIndustry]);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (currentIndustry && currentIndustry !== 'default') {
                params.industryId = currentIndustry; // Backend supports key in industryId param if length < 30
            }
            const response = await apiClient.get('/clients', { params });
            if (response.data.success) {
                setClients(response.data.data);
            }
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
        if (!window.confirm(`Are you sure you want to delete ${clientName}?`)) return;

        try {
            await apiClient.delete(`/clients/${clientId}`);
            fetchClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            alert('Failed to delete client');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{tLabel('client')}s</h1>
                    <p className="text-slate-700 font-medium text-sm mt-1">Manage your {tLabel('client').toLowerCase()} portfolio and organizational details</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={`Search ${tLabel('client')}s...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 w-64"
                        />
                    </div>
                    {isAdmin(user) && (
                        <a
                            href="/clients/new/start"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            New {tLabel('client')}
                        </a>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredClients.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No {tLabel('client')}s found</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
                        {searchTerm ? 'Try adjusting your search terms' : `Get started by adding your first ${tLabel('client').toLowerCase()}.`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map((client) => (
                        <div
                            key={client.id}
                            onClick={() => onSelectClient(client.id)}
                            className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                                    {client.industry_name || 'General'}
                                </div>
                                {isAdmin(user) && (
                                    <button
                                        onClick={(e) => handleDeleteClient(e, client.id, client.name)}
                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all ml-2"
                                        title="Delete Client"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{client.name}</h3>

                            <div className="space-y-2 mt-4">
                                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                    <LayoutGrid className="w-4 h-4 text-slate-500" />
                                    <span>{client.project_count || 0} {tLabel('project')}s</span>
                                </div>
                                {client.address?.city && (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        <span>{client.address.city}, {client.address.state}</span>
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-5 right-5 opacity-0 transform translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                <ChevronRight className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Creation Modal */}
            {isCreating && (
                <ClientForm
                    onClose={() => setIsCreating(false)}
                    onSuccess={() => {
                        setIsCreating(false);
                        fetchClients();
                    }}
                />
            )}
        </div>
    );
};

export default ClientList;
