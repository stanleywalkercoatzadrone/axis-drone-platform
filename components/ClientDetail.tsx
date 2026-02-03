import React, { useState, useEffect } from 'react';
import apiClient from '../src/services/apiClient';
import { useIndustry } from '../src/context/IndustryContext';
import { ArrowLeft, Building2, MapPin, Globe, Mail, Phone, Users, LayoutGrid } from 'lucide-react';
import StakeholderList from './StakeholderList';

// Placeholder for Project List (since we are using existing logic mostly)
const ProjectListPlaceholder: React.FC<{ client: any }> = ({ client }) => (
    <div className="py-8 text-center text-slate-500">
        <p>Project list for {client.name} will go here.</p>
        <p className="text-xs mt-2">Uses existing Sites/Assets logic filtered by client_id.</p>
    </div>
);

interface ClientDetailProps {
    clientId: string;
    onBack: () => void;
}

const ClientDetail: React.FC<ClientDetailProps> = ({ clientId, onBack }) => {
    const { tLabel } = useIndustry();
    const [client, setClient] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'projects' | 'stakeholders' | 'settings'>('projects');

    useEffect(() => {
        const fetchClient = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.get(`/clients/${clientId}`);
                if (response.data.success) {
                    setClient(response.data.data);
                }
            } catch (error) {
                console.error('Error fetching client:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClient();
    }, [clientId]);

    if (isLoading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    if (!client) return <div className="p-10 text-center">Client not found</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to {tLabel('client')}s
                </button>

                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                {client.address?.city && (
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {client.address.city}, {client.address.state}
                                    </span>
                                )}
                                {client.industry_name && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-xs font-medium">
                                        <Globe className="w-3 h-3 text-slate-400" />
                                        {client.industry_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 mt-8 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'projects' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        {tLabel('project')}s
                    </button>
                    <button
                        onClick={() => setActiveTab('stakeholders')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'stakeholders' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
                    >
                        <Users className="w-4 h-4" />
                        {tLabel('stakeholder')}s
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
                    >
                        Settings
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'projects' && (
                        <ProjectListPlaceholder client={client} />
                    )}
                    {activeTab === 'stakeholders' && (
                        <StakeholderList clientId={client.id} />
                    )}
                    {activeTab === 'settings' && (
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <h3 className="text-lg font-medium text-slate-900 mb-4">Client Settings</h3>
                            {/* JSON Dump for now */}
                            <pre className="text-xs bg-slate-50 p-4 rounded overflow-auto">
                                {JSON.stringify(client, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientDetail;
