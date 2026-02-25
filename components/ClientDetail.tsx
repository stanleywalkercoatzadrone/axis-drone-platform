import React, { useState, useEffect } from 'react';
import apiClient from '../src/services/apiClient';
import { useIndustry } from '../src/context/IndustryContext';
import { useAuth } from '../src/context/AuthContext';
import { ArrowLeft, Building2, MapPin, Globe, Mail, Phone, Users, LayoutGrid, Plane, Calendar, Plus } from 'lucide-react';
import StakeholderList from './StakeholderList';
import { Deployment, DeploymentStatus, DeploymentType } from '../types';

interface ClientDetailProps {
    clientId: string;
    onBack: () => void;
}

const ClientDetail: React.FC<ClientDetailProps> = ({ clientId, onBack }) => {
    const { tLabel } = useIndustry();
    const { user } = useAuth();
    const [client, setClient] = useState<any>(null);
    const [stats, setStats] = useState<any>({
        activeMissions: 0,
        completedMissions: 0,
        totalSpend: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'projects' | 'stakeholders' | 'settings'>('projects');

    // Mission State
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [isMissionsLoading, setIsMissionsLoading] = useState(false);

    // Add Mission Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [clientSites, setClientSites] = useState<any[]>([]);
    const [newDeployment, setNewDeployment] = useState<Partial<Deployment>>({
        title: '',
        type: DeploymentType.ROUTINE,
        status: DeploymentStatus.SCHEDULED,
        date: new Date().toISOString().split('T')[0],
        daysOnSite: 1,
        notes: ''
    });

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

    // Fetch Missions when tab is active
    useEffect(() => {
        if (activeTab === 'projects' && clientId) {
            fetchClientMissions();
            fetchClientSites();
        }
    }, [activeTab, clientId]);

    const fetchClientMissions = async () => {
        setIsMissionsLoading(true);
        try {
            const response = await apiClient.get('/deployments', {
                params: { clientId }
            });
            if (response.data.success) {
                setDeployments(response.data.data);

                // Calculate stats
                const active = response.data.data.filter((d: Deployment) =>
                    [DeploymentStatus.ACTIVE, DeploymentStatus.SCHEDULED, DeploymentStatus.REVIEW].includes(d.status)
                ).length;
                const completed = response.data.data.filter((d: Deployment) =>
                    d.status === DeploymentStatus.COMPLETED
                ).length;

                setStats(prev => ({ ...prev, activeMissions: active, completedMissions: completed }));
            }
        } catch (error) {
            console.error('Error fetching missions:', error);
        } finally {
            setIsMissionsLoading(false);
        }
    };

    const fetchClientSites = async () => {
        try {
            const response = await apiClient.get('/assets/sites', {
                params: { clientId }
            });
            if (response.data.status === 'success') {
                setClientSites(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching sites:', error);
        }
    };

    const handleAddMission = async () => {
        if (!newDeployment.title || !newDeployment.siteId) return;

        try {
            // Find site name for the selected siteId
            const selectedSite = clientSites.find(s => s.id === newDeployment.siteId);
            const payload = {
                ...newDeployment,
                siteName: selectedSite?.name || 'Unknown Site'
            };

            const response = await apiClient.post('/deployments', payload);
            if (response.data.success) {
                setIsAddModalOpen(false);
                fetchClientMissions(); // Refresh list
                // Reset form
                setNewDeployment({
                    title: '',
                    type: DeploymentType.ROUTINE,
                    status: DeploymentStatus.SCHEDULED,
                    date: new Date().toISOString().split('T')[0],
                    daysOnSite: 1,
                    notes: ''
                });
            }
        } catch (error) {
            console.error('Error creating mission:', error);
            alert('Failed to create mission');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-green-100 text-green-700';
            case 'Scheduled': return 'bg-blue-100 text-blue-700';
            case 'Completed': return 'bg-slate-100 text-slate-700';
            case 'Draft': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-slate-100 text-slate-500';
        }
    };

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
                        <Plane className="w-4 h-4" />
                        Missions ({stats.activeMissions})
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
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-slate-900">Flight Missions</h3>
                                {user?.role !== 'pilot_technician' && (
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Schedule Mission
                                    </button>
                                )}
                            </div>

                            {isMissionsLoading ? (
                                <div className="text-center py-12 text-slate-500">Loading missions...</div>
                            ) : deployments.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                                    <Plane className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">No missions scheduled for this client.</p>
                                    {user?.role !== 'pilot_technician' && (
                                        <button
                                            onClick={() => setIsAddModalOpen(true)}
                                            className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                                        >
                                            Create first mission
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {deployments.map(mission => (
                                        <div key={mission.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow flex items-center justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(mission.status)} bg-opacity-10 text-opacity-100`}>
                                                    <Plane className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900">{mission.title}</h4>
                                                    <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                                        <MapPin className="w-3 h-3" /> {mission.siteName}
                                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                        <Calendar className="w-3 h-3" /> {mission.date}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(mission.status)}`}>
                                                    {mission.status}
                                                </span>
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-400">Type</p>
                                                    <p className="text-sm font-medium text-slate-700">{mission.type}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'stakeholders' && (
                        <StakeholderList clientId={client.id} />
                    )}

                    {activeTab === 'settings' && (
                        <div className="bg-white rounded-lg border border-slate-200 p-6">
                            <h3 className="text-lg font-medium text-slate-900 mb-6">Client Settings</h3>
                            <ClientSettingsForm client={client} onSuccess={(updated) => setClient(updated)} />
                        </div>
                    )}
                </div>
            </div>

            {/* Add Mission Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Plane className="w-4 h-4" /> Schedule New Mission
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                &times;
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mission Title</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                    placeholder="e.g. Q3 Roof Inspection"
                                    value={newDeployment.title || ''}
                                    onChange={e => setNewDeployment({ ...newDeployment, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mission Type</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                        value={newDeployment.type}
                                        onChange={e => setNewDeployment({ ...newDeployment, type: e.target.value as DeploymentType })}
                                    >
                                        {Object.values(DeploymentType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                        value={newDeployment.status}
                                        onChange={e => setNewDeployment({ ...newDeployment, status: e.target.value as DeploymentStatus })}
                                    >
                                        {Object.values(DeploymentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Site</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                        value={newDeployment.siteId || ''}
                                        onChange={e => setNewDeployment({ ...newDeployment, siteId: e.target.value })}
                                    >
                                        <option value="">Select Site...</option>
                                        {clientSites.map(site => (
                                            <option key={site.id} value={site.id}>{site.name}</option>
                                        ))}
                                    </select>
                                    {clientSites.length === 0 && (
                                        <p className="text-xs text-red-500 mt-1">No sites found for this client.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                        value={newDeployment.date}
                                        onChange={e => setNewDeployment({ ...newDeployment, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Location Details</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                    placeholder="City, State or Coordinates"
                                    value={newDeployment.location || ''}
                                    onChange={e => setNewDeployment({ ...newDeployment, location: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Days Onsite</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                    placeholder="e.g. 5"
                                    value={newDeployment.daysOnSite || ''}
                                    onChange={e => setNewDeployment({ ...newDeployment, daysOnSite: parseInt(e.target.value) })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Operational Notes</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none h-20 resize-none"
                                    placeholder="Flight plan details, hazards, etc."
                                    value={newDeployment.notes || ''}
                                    onChange={e => setNewDeployment({ ...newDeployment, notes: e.target.value })}
                                />
                            </div>

                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddMission}
                                disabled={!newDeployment.title || !newDeployment.siteId}
                                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
                            >
                                Confirm Schedule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ClientSettingsForm: React.FC<{ client: any, onSuccess: (data: any) => void }> = ({ client, onSuccess }) => {
    const { availableIndustries } = useIndustry();
    const [formData, setFormData] = useState({
        name: client.name || '',
        industryKey: client.industry_key || '',
        email: client.email || '',
        phone: client.phone || '',
        primaryContactName: client.primary_contact_name || '',
        address: {
            street: client.address?.street || '',
            city: client.address?.city || '',
            state: client.address?.state || '',
            zip: client.address?.zip || ''
        }
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const response = await apiClient.put(`/clients/${client.id}`, formData);
            if (response.data.success) {
                onSuccess(response.data.data);
                alert('Client updated successfully');
            }
        } catch (error) {
            console.error('Failed to update client:', error);
            alert('Failed to update client');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.industryKey}
                        onChange={e => setFormData({ ...formData, industryKey: e.target.value })}
                    >
                        <option value="">Select Industry</option>
                        {availableIndustries.map(ind => (
                            <option key={ind.key} value={ind.key}>{ind.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primary Email</label>
                    <input
                        type="email"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                        type="tel"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primary Contact Name</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        value={formData.primaryContactName}
                        onChange={e => setFormData({ ...formData, primaryContactName: e.target.value })}
                    />
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
                <h4 className="text-sm font-medium text-slate-900 mb-4">Address Details</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Street Address</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            value={formData.address.street}
                            onChange={e => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">City</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            value={formData.address.city}
                            onChange={e => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">State / Province</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            value={formData.address.state}
                            onChange={e => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Zip / Postal Code</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            value={formData.address.zip}
                            onChange={e => setFormData({ ...formData, address: { ...formData.address, zip: e.target.value } })}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                    {isSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
};

export default ClientDetail;
