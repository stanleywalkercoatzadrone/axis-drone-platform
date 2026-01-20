import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight, Briefcase, Calendar, Check, CheckCircle, ChevronDown, ChevronRight, Clock, DollarSign, Download, Edit2, ExternalLink, FileText, Filter, LayoutGrid, Link as LinkIcon, Loader2, MapPin, MoreVertical, Plus, Receipt, Search, ShieldCheck, Trash2, Upload, Users, X, XCircle, Zap, Plane, List, Grid3X3, BarChart3, Activity, Printer, Send } from 'lucide-react';
import { Deployment, DeploymentStatus, DeploymentType, DailyLog, Personnel, DeploymentFile, UserAccount } from '../types';
import CalendarView from './CalendarView';
import AssetTracker from './AssetTracker';
import apiClient from '../src/services/apiClient';

const DeploymentTracker: React.FC = () => {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | DeploymentStatus>('All');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeModalTab, setActiveModalTab] = useState<'logs' | 'files' | 'financials' | 'team' | 'site-assets'>('logs');
    const [uploading, setUploading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
    const [siteAssets, setSiteAssets] = useState<any[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [activeSection, setActiveSection] = useState<'missions' | 'assets'>('missions');

    const [newLog, setNewLog] = useState<Partial<DailyLog>>({
        dailyPay: 0,
        bonusPay: 0
    });

    // Edit State
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [expandedFinancialId, setExpandedFinancialId] = useState<string | null>(null); // For accordion
    const [editForm, setEditForm] = useState<{ dailyPay: number, bonusPay: number, notes: string }>({
        dailyPay: 0,
        bonusPay: 0,
        notes: ''
    });

    const handleAddLog = async (day: string) => {
        if (!selectedDeployment || !newLog.technicianId) return;

        try {
            const payload = {
                ...newLog,
                date: new Date(day).toISOString(),
                deploymentId: selectedDeployment.id
            };

            const response = await apiClient.post(`/deployments/${selectedDeployment.id}/daily-logs`, payload);

            // Create the new log object from response
            const addedLog = response.data.data;

            // Update local state immediately with the REAL backend response
            const updatedDeployment = {
                ...selectedDeployment,
                dailyLogs: [...(selectedDeployment.dailyLogs || []), addedLog]
            };

            await setSelectedDeployment(updatedDeployment);

            // Update the main list as well to ensure persistence across modal closes
            setDeployments(prev => prev.map(d =>
                d.id === selectedDeployment.id ? updatedDeployment : d
            ));

            // Reset form
            setNewLog({
                technicianId: '',
                date: '', // Will be set by usage context
                dailyPay: 0,
                bonusPay: 0,
                notes: ''
            });

        } catch (err: any) {
            console.error('Error adding log:', err);
            alert(err.message);
        }
    };

    const startEditLog = (log: any) => {
        setEditingLogId(log.id);
        setEditForm({
            dailyPay: log.dailyPay || 0,
            bonusPay: log.bonusPay || 0,
            notes: log.notes || ''
        });
    };

    const cancelEditLog = () => {
        setEditingLogId(null);
        setEditForm({ dailyPay: 0, bonusPay: 0, notes: '' });
    };

    const saveEditLog = async (logId: string) => {
        if (!selectedDeployment) return;

        try {
            // Optimistic update
            const updatedLogs = (selectedDeployment.dailyLogs || []).map(l =>
                l.id === logId ? { ...l, ...editForm } : l
            );

            const optimisticDeployment = { ...selectedDeployment, dailyLogs: updatedLogs };
            setSelectedDeployment(optimisticDeployment);

            // API Call
            await apiClient.put(`/deployments/${selectedDeployment.id}/daily-logs/${logId}`, {
                ...editForm
            });

            // Sync main list
            setDeployments(prev => prev.map(d =>
                d.id === selectedDeployment.id ? optimisticDeployment : d
            ));

            setEditingLogId(null);

        } catch (err: any) {
            console.error('Failed to save edit:', err);
            alert('Failed to update pilot: ' + err.message);
            // Revert on failure (could fetch fresh data here, but manual refresh is safer fallback)
        }
    };

    const handleDeleteLog = async (logId: string) => {
        if (!selectedDeployment) return;

        console.log('--- DELETE ACTION TRIGGERED ---');
        console.log('Log ID:', logId);

        try {
            const response = await apiClient.delete(`/deployments/${selectedDeployment.id}/daily-logs/${logId}`);

            const updatedDeployment = {
                ...selectedDeployment,
                dailyLogs: (selectedDeployment.dailyLogs || []).filter(l => l.id !== logId)
            };

            await setSelectedDeployment(updatedDeployment);

            setDeployments(prev => prev.map(d =>
                d.id === selectedDeployment.id ? updatedDeployment : d
            ));

        } catch (err: any) {
            console.error('CRITICAL DELETE ERROR:', err);
            alert(`Delete Failed: ${err.message || 'Unknown error'}`);
        }
    };

    // Fetch deployments and personnel on mount
    useEffect(() => {
        fetchDeployments();
        fetchPersonnel();
        fetchAllUsers();
    }, []);

    const fetchDeployments = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/deployments');
            setDeployments(response.data.data || []);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching deployments:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchPersonnel = async () => {
        try {
            const response = await apiClient.get('/personnel');
            setPersonnel(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching personnel:', err);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const response = await apiClient.get('/users');
            setAllUsers(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching users:', err);
        }
    };

    const handleViewFinancials = async (deployment: Deployment) => {
        try {
            await handleViewDetails(deployment);
            setActiveModalTab('financials');
        } catch (err: any) {
            console.error('Error opening financials:', err);
        }
    };

    const handleViewDetails = async (deployment: Deployment) => {
        // Fetch fresh deployment data with daily logs AND files
        try {
            const [deployResponse, filesResponse] = await Promise.all([
                apiClient.get(`/deployments/${deployment.id}`),
                apiClient.get(`/deployments/${deployment.id}/files`)
            ]);

            const freshDeployment = deployResponse.data.data;
            setSelectedDeployment({
                ...freshDeployment,
                files: filesResponse.data.data
            });

            // If the deployment has a siteId, pre-fetch assets
            if (freshDeployment.siteId) {
                fetchSiteAssets(freshDeployment.siteId);
            }

            setActiveModalTab('logs');
            setIsLogModalOpen(true);
        } catch (err: any) {
            console.error('Error fetching deployment details:', err);
            alert(err.message);
        }
    };

    const fetchSiteAssets = async (siteId: string) => {
        try {
            setLoadingAssets(true);
            const response = await apiClient.get(`/assets?site_id=${siteId}`);
            setSiteAssets(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching site assets:', err);
        } finally {
            setLoadingAssets(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedDeployment) return;

        const formData = new FormData();
        formData.append('image', file); // API expects 'image' key from uploadSingle

        try {
            setUploading(true);
            const response = await apiClient.post(`/deployments/${selectedDeployment.id}/files`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const newFile = response.data.data;
            setSelectedDeployment(prev => prev ? ({
                ...prev,
                files: [newFile, ...(prev.files || [])]
            }) : null);

        } catch (err: any) {
            console.error('Error uploading file:', err);
            alert('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteFile = async (fileId: string) => {
        if (!selectedDeployment) return;
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            await apiClient.delete(`/deployments/${selectedDeployment.id}/files/${fileId}`);
            setSelectedDeployment(prev => prev ? ({
                ...prev,
                files: (prev.files || []).filter(f => f.id !== fileId)
            }) : null);
        } catch (err: any) {
            console.error('Error deleting file:', err);
            alert('Delete failed: ' + err.message);
        }
    };

    const handleAssignPersonnel = async (personnelId: string) => {
        if (!selectedDeployment) return;
        try {
            await apiClient.post(`/deployments/${selectedDeployment.id}/personnel`, { personnelId });
            setSelectedDeployment({
                ...selectedDeployment,
                technicianIds: [...(selectedDeployment.technicianIds || []), personnelId]
            });
            fetchDeployments(); // Refresh list to update counts
        } catch (err: any) {
            console.error('Error assigning personnel:', err);
            alert(err.message);
        }
    };

    const handleUnassignPersonnel = async (personnelId: string) => {
        if (!selectedDeployment) return;
        try {
            await apiClient.delete(`/deployments/${selectedDeployment.id}/personnel/${personnelId}`);
            setSelectedDeployment({
                ...selectedDeployment,
                technicianIds: (selectedDeployment.technicianIds || []).filter(id => id !== personnelId)
            });
            fetchDeployments();
        } catch (err: any) {
            console.error('Error unassigning personnel:', err);
            alert(err.message);
        }
    };

    const handleAssignMonitor = async (userId: string) => {
        if (!selectedDeployment) return;
        try {
            await apiClient.post(`/deployments/${selectedDeployment.id}/monitoring`, { userId, role: 'Monitor' });
            // Refresh details to get monitoring team
            const deployResponse = await apiClient.get(`/deployments/${selectedDeployment.id}`);
            setSelectedDeployment(deployResponse.data.data);
        } catch (err: any) {
            console.error('Error assigning monitor:', err);
            alert(err.message);
        }
    };

    const handleUnassignMonitor = async (userId: string) => {
        if (!selectedDeployment) return;
        try {
            await apiClient.delete(`/deployments/${selectedDeployment.id}/monitoring/${userId}`);
            setSelectedDeployment({
                ...selectedDeployment,
                monitoringTeam: (selectedDeployment.monitoringTeam || []).filter(u => u.id !== userId)
            });
        } catch (err: any) {
            console.error('Error unassigning monitor:', err);
            alert(err.message);
        }
    };

    const handleGenerateInvoice = async (personnelId: string) => {
        if (!selectedDeployment) return;
        try {
            const response = await apiClient.post('/invoices', {
                deploymentId: selectedDeployment.id,
                personnelId: personnelId
            });
            const link = response.data.data.link;
            // Assuming the link returned by backend is relative /invoice/token
            // We want to show full URL
            const fullLink = `${window.location.origin}${link}`;
            setGeneratedLink(fullLink);
        } catch (err: any) {
            console.error('Error creating invoice:', err);
            alert(err.message);
        }
    };

    const getDeploymentDays = (deployment: Deployment) => {
        if (!deployment || !deployment.date) return [];
        try {
            const days = [];
            // Handle potential Date object or string
            let dateStr = String(deployment.date);
            if (dateStr.includes('T')) {
                dateStr = dateStr.split('T')[0];
            }

            const parts = dateStr.split('-').map(Number);
            if (parts.length !== 3) return [dateStr]; // Fallback to raw string if parsing fails logic

            const [y, m, d] = parts;
            const startDate = new Date(y, m - 1, d);

            for (let i = 0; i < (deployment.daysOnSite || 1); i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);

                // Use local date components to avoid UTC timezone shifts
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const dayStr = String(date.getDate()).padStart(2, '0');
                days.push(`${year}-${month}-${dayStr}`);
            }
            return days;
        } catch (e) {
            console.error('Error calculating days:', e);
            // Safest fallback: return empty array to prevent render crash
            return [];
        }
    };

    const handleDayClick = (date: string) => {
        setNewDeployment({
            ...newDeployment,
            date: date
        });
        setIsAddModalOpen(true);
    };

    const getTotalCost = (deployment: Deployment) => {
        if (!deployment || !deployment.dailyLogs) return 0;
        return deployment.dailyLogs.reduce((sum, log) => sum + (log.dailyPay || 0) + (log.bonusPay || 0), 0);
    };

    const [newDeployment, setNewDeployment] = useState<Partial<Deployment>>({
        type: DeploymentType.ROUTINE,
        status: DeploymentStatus.SCHEDULED,
        date: new Date().toISOString().split('T')[0]
    });

    const handleAddDeployment = async () => {
        if (!newDeployment.title || !newDeployment.siteName) return;

        try {
            const response = await apiClient.post('/deployments', {
                title: newDeployment.title,
                type: newDeployment.type,
                status: newDeployment.status,
                siteName: newDeployment.siteName,
                date: newDeployment.date || new Date().toISOString().split('T')[0],
                location: newDeployment.location,
                notes: newDeployment.notes,
                daysOnSite: newDeployment.daysOnSite
            });

            const data = response.data;
            setDeployments([data.data, ...deployments]);
            setIsAddModalOpen(false);
            setNewDeployment({
                type: DeploymentType.ROUTINE,
                status: DeploymentStatus.SCHEDULED,
                date: new Date().toISOString().split('T')[0]
            });
        } catch (err: any) {
            console.error('Error creating deployment:', err);
            alert(err.message);
        }
    };

    const handleEmailInvoices = async () => {
        if (!selectedDeployment) return;

        if (!confirm(`Are you sure you want to email invoices to all pilots for "${selectedDeployment.title}"?\n\nThis will:\n1. Generate distinct secure invoice links for each pilot.\n2. Email the pilot their link.\n3. Send a summary to admin.`)) {
            return;
        }

        try {
            const response = await apiClient.post(`/deployments/${selectedDeployment.id}/invoices/send`);
            alert(response.data.message);
        } catch (err: any) {
            console.error('Error sending invoices:', err);
            alert(err.response?.data?.message || err.message || 'Failed to send invoices');
        }
    };

    const handlePrintReport = () => {
        window.print();
    };

    const filteredDeployments = deployments.filter(d => {
        const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status: DeploymentStatus) => {
        switch (status) {
            case DeploymentStatus.COMPLETED: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case DeploymentStatus.IN_PROGRESS: return 'bg-blue-50 text-blue-700 border-blue-100';
            case DeploymentStatus.SCHEDULED: return 'bg-amber-50 text-amber-700 border-amber-100';
            case DeploymentStatus.CANCELLED: return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-50 text-slate-600';
        }
    };

    // Calculate Terminal Metrics
    const activeMissions = deployments.filter(d => d.status === DeploymentStatus.IN_PROGRESS).length;
    const totalFleetSpend = deployments.reduce((sum, d) => sum + getTotalCost(d), 0);
    const totalDataAssets = deployments.reduce((sum, d) => sum + (d.fileCount || 0), 0);
    const groundTeamCount = personnel.filter(p => p.status === 'Active').length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Sub-navigation for Mission Terminal */}
            <div className="flex items-center gap-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveSection('missions')}
                    className={`pb-3 text-sm font-bold transition-all relative ${activeSection === 'missions'
                        ? 'text-slate-900'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Mission Controls
                    {activeSection === 'missions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveSection('assets')}
                    className={`pb-3 text-sm font-bold transition-all relative ${activeSection === 'assets'
                        ? 'text-slate-900'
                        : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Asset Registry
                    {activeSection === 'assets' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                </button>
            </div>

            {activeSection === 'missions' ? (
                <>
                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Mission Terminal</h2>
                            <p className="text-sm text-slate-500">Enterprise deployment tracker and mission logistics.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="List View"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('calendar')}
                                    className={`p-2 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Calendar View"
                                >
                                    <Grid3X3 className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> Schedule Mission
                            </button>
                        </div>
                    </div>

                    {/* Terminal Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Missions</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">{activeMissions}</span>
                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">LIVE</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                    <BarChart3 className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Fleet Spend</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">${totalFleetSpend.toLocaleString()}</span>
                                <span className="text-[10px] font-medium text-slate-400">USD</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Assets</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">{totalDataAssets}</span>
                                <span className="text-[10px] font-medium text-slate-400">FILES</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                    <Users className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ground Team</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-slate-900">{groundTeamCount}</span>
                                <span className="text-[10px] font-medium text-slate-400">ACTIVE</span>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'calendar' ? (
                        <CalendarView
                            deployments={deployments} // No filtering on calendar to see full schedule
                            onDeploymentClick={handleViewDetails}
                            onDayClick={handleDayClick}
                        />
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                            {/* Filters */}
                            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                                    {['All', DeploymentStatus.SCHEDULED, DeploymentStatus.IN_PROGRESS, DeploymentStatus.COMPLETED].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setStatusFilter(status as any)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === status
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search missions..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mission ID</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Operation</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Site / Location</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Assets</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Team</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredDeployments.map((deploy) => (
                                            <tr
                                                key={deploy.id}
                                                onClick={() => handleViewDetails(deploy)}
                                                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                            >
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded">{deploy.id.split('-')[0].toUpperCase()}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900">{deploy.title}</p>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{deploy.type}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-3 h-3 text-slate-400" />
                                                        <div>
                                                            <p className="text-sm text-slate-700">{deploy.siteName}</p>
                                                            {deploy.location && <p className="text-xs text-slate-400">{deploy.location}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-xs">{deploy.date}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                        <FileText className="w-3 h-3 text-slate-400" />
                                                        <span className="text-xs font-bold">{deploy.fileCount || 0}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                        <Users className="w-3 h-3 text-slate-400" />
                                                        <span className="text-xs font-bold">{deploy.personnelCount || 0}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(deploy.status)}`}>
                                                        {deploy.status === DeploymentStatus.IN_PROGRESS && <span className="relative flex h-1.5 w-1.5 mr-1">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                                        </span>}
                                                        {deploy.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => handleViewFinancials(deploy)}
                                                            className="p-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all flex items-center gap-1"
                                                            title="View Financials & Invoices"
                                                        >
                                                            <DollarSign className="w-3.5 h-3.5" />
                                                            Finance
                                                        </button>
                                                        <button
                                                            onClick={() => handleViewDetails(deploy)}
                                                            className="p-1.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-100 rounded-lg transition-all"
                                                            title="Mission Details & Assets"
                                                        >
                                                            <ArrowRight className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {filteredDeployments.length === 0 && (
                                    <div className="p-12 text-center">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Plane className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <h3 className="text-sm font-medium text-slate-900">No missions found</h3>
                                        <p className="text-xs text-slate-500 mt-1">Check your search terms or schedule a new mission.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <AssetTracker />
            )}



            {/* Mission Details Modal */}
            {
                isLogModalOpen && selectedDeployment && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 h-[80vh] flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        Mission Details
                                    </h3>
                                    <p className="text-sm text-slate-500">{selectedDeployment.title} — {selectedDeployment.siteName}</p>
                                </div>
                                <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    &times;
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-slate-200 px-6">
                                <button
                                    onClick={() => setActiveModalTab('logs')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeModalTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        Daily Logs & Pay
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveModalTab('files')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeModalTab === 'files' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Mission Assets / Files
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveModalTab('financials')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeModalTab === 'financials' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Receipt className="w-4 h-4" />
                                        Financials & Invoicing
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveModalTab('team')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeModalTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Team Setup
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveModalTab('site-assets')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeModalTab === 'site-assets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4" />
                                        Site Assets
                                    </div>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50/50">
                                {activeModalTab === 'logs' ? (
                                    <div className="p-6 space-y-6">
                                        {/* Daily Logs Content */}
                                        {getDeploymentDays(selectedDeployment).map((day) => (
                                            <div key={day} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                    <h4 className="font-medium text-slate-700 text-sm flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-slate-400" />
                                                        {new Date(day).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </h4>
                                                    <span className="text-xs font-semibold text-slate-500 bg-slate-200/50 px-2 py-1 rounded">
                                                        Day Total: ${(selectedDeployment.dailyLogs?.filter(l => l.date === day).reduce((sum, l) => sum + (l.dailyPay || 0) + (l.bonusPay || 0), 0) || 0).toLocaleString()}
                                                    </span>
                                                </div>

                                                <div className="p-4 space-y-4">
                                                    {/* Existing Logs for this day */}
                                                    <div className="space-y-2">

                                                        <div className="space-y-2">
                                                            {(selectedDeployment.dailyLogs?.filter(l => String(l.date).split('T')[0] === day) || []).map(log => {
                                                                const personName = personnel.find(p => p.id === log.technicianId)?.fullName || log.technicianId;
                                                                const totalPay = (editingLogId === log.id ? editForm.dailyPay + editForm.bonusPay : (log.dailyPay || 0) + (log.bonusPay || 0));

                                                                return (
                                                                    <div key={log.id} className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded border border-slate-100">
                                                                        <div className="flex items-center gap-3 flex-1">
                                                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                                                {personName.charAt(0)}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <span className="font-medium text-slate-700 block">{personName}</span>

                                                                                {editingLogId === log.id ? (
                                                                                    <div className="flex items-center gap-2 mt-1">
                                                                                        <div className="flex items-center gap-1">
                                                                                            <span className="text-[10px] text-slate-400 uppercase">Rate:</span>
                                                                                            <input
                                                                                                type="number"
                                                                                                className="w-20 px-1 py-0.5 text-xs border rounded"
                                                                                                value={editForm.dailyPay}
                                                                                                onChange={e => setEditForm({ ...editForm, dailyPay: parseFloat(e.target.value) || 0 })}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1">
                                                                                            <span className="text-[10px] text-emerald-500 uppercase">Bonus:</span>
                                                                                            <input
                                                                                                type="number"
                                                                                                className="w-20 px-1 py-0.5 text-xs border rounded"
                                                                                                value={editForm.bonusPay}
                                                                                                onChange={e => setEditForm({ ...editForm, bonusPay: parseFloat(e.target.value) || 0 })}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                                                        <span>Daily: ${log.dailyPay?.toLocaleString() || 0}</span>
                                                                                        {(log.bonusPay || 0) > 0 && (
                                                                                            <>
                                                                                                <span>•</span>
                                                                                                <span className="text-emerald-600 font-medium">Bonus: ${log.bonusPay?.toLocaleString()}</span>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded border border-emerald-100 min-w-[80px] text-center">
                                                                                ${totalPay.toLocaleString()}
                                                                            </span>

                                                                            {editingLogId === log.id ? (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => saveEditLog(log.id)}
                                                                                        className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                                        title="Save Changes"
                                                                                    >
                                                                                        <Check className="w-4 h-4" />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={cancelEditLog}
                                                                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors"
                                                                                        title="Cancel Edit"
                                                                                    >
                                                                                        <X className="w-4 h-4" />
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => startEditLog(log)}
                                                                                        className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                                        title="Edit Pay/Bonus"
                                                                                    >
                                                                                        <Edit2 className="w-4 h-4" />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDeleteLog(log.id)}
                                                                                        className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                                        title="Remove Pilot"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {(selectedDeployment.dailyLogs?.filter(l => l.date === day) || []).length === 0 && (
                                                                <p className="text-xs text-slate-400 italic text-center py-3">No pilots assigned to this day yet.</p>
                                                            )}
                                                        </div>

                                                        {/* Add New Pilot Form */}
                                                        <div className="pt-3 border-t border-slate-200 mt-3">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Add Pilot to This Day</h5>
                                                            </div>
                                                            <div className="grid grid-cols-12 gap-2">
                                                                <div className="col-span-5">
                                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pilot/Technician</label>
                                                                    <select
                                                                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                                        value={newLog.technicianId || ''}
                                                                        onChange={e => {
                                                                            const selectedPersonnel = personnel.find(p => p.id === e.target.value);
                                                                            setNewLog({
                                                                                ...newLog,
                                                                                technicianId: e.target.value,
                                                                                dailyPay: selectedPersonnel?.dailyPayRate || 0
                                                                            });
                                                                        }}
                                                                    >
                                                                        <option value="">Select...</option>
                                                                        {personnel
                                                                            .filter(p => p.status === 'Active')
                                                                            .filter(p => {
                                                                                // Debug logging for first few items to avoid console spam
                                                                                // console.log(`Checking ${p.fullName} for day ${day}`);

                                                                                const isAssigned = selectedDeployment.dailyLogs?.some(log => {
                                                                                    // robust date compare: string to string
                                                                                    const logDateStr = String(log.date).split('T')[0];
                                                                                    const targetDateStr = String(day).split('T')[0];
                                                                                    const isSameDay = logDateStr === targetDateStr;
                                                                                    const isSamePerson = String(log.technicianId) === String(p.id);

                                                                                    return isSameDay && isSamePerson;
                                                                                });

                                                                                return !isAssigned;
                                                                            })
                                                                            .map(person => (
                                                                                <option key={person.id} value={person.id}>
                                                                                    {person.fullName} ({person.role})
                                                                                </option>
                                                                            ))}
                                                                    </select>
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Daily Rate</label>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                                        placeholder="0"
                                                                        value={newLog.dailyPay || ''}
                                                                        onChange={e => setNewLog({ ...newLog, dailyPay: parseFloat(e.target.value) || 0 })}
                                                                    />
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bonus Pay</label>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                                                        placeholder="0"
                                                                        value={newLog.bonusPay || ''}
                                                                        onChange={e => setNewLog({ ...newLog, bonusPay: parseFloat(e.target.value) || 0 })}
                                                                    />
                                                                </div>
                                                                <div className="col-span-3 flex items-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            handleAddLog(day);
                                                                        }}
                                                                        disabled={!newLog.technicianId || !newLog.dailyPay}
                                                                        className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                                                                    >
                                                                        <Plus className="w-3 h-3" /> Add Pilot
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : activeModalTab === 'files' ? (
                                    <div className="p-6 space-y-6">
                                        {/* Files / Assets Content */}
                                        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50/50 hover:border-blue-300 transition-all">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                                <Upload className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-slate-900">Upload Mission Assets</h3>
                                            <p className="text-xs text-slate-500 mt-1 max-w-xs">
                                                Upload flight logs, KML files, site photos, or PDF reports associated with this mission.
                                            </p>
                                            <div className="mt-4 relative">
                                                <input
                                                    type="file"
                                                    onChange={handleFileUpload}
                                                    disabled={uploading}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                    multiple={false}
                                                />
                                                <button disabled={uploading} className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">
                                                    {uploading ? 'Uploading...' : 'Select File'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-slate-500" />
                                                Attached Files ({selectedDeployment.files?.length || 0})
                                            </h4>

                                            <div className="grid grid-cols-1 gap-3">
                                                {(selectedDeployment.files || []).length === 0 ? (
                                                    <p className="text-sm text-slate-500 italic">No files attached yet.</p>
                                                ) : (
                                                    selectedDeployment.files?.map(file => (
                                                        <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all group">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                                                    <FileText className="w-5 h-5 text-slate-500" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                                                        <span>{(file.size || 0 / 1024).toFixed(1)} KB</span>
                                                                        <span>•</span>
                                                                        <span>{new Date(file.uploadedAt || '').toLocaleDateString()}</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={file.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Download"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </a>
                                                                <button
                                                                    onClick={() => handleDeleteFile(file.id)}
                                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : activeModalTab === 'financials' ? (
                                    <div className="p-6 space-y-6 mission-cost-report">
                                        {/* DEBUGGING LOGS */}
                                        {(() => {
                                            console.log('Rendering Financials Tab:', {
                                                selectedDeployment,
                                                dailyLogs: selectedDeployment?.dailyLogs,
                                                personnel
                                            });
                                            return null;
                                        })()}
                                        {/* Financial Overview - CoatzadroneUSA */}
                                        <div className={`bg-white rounded-xl border transition-all ${expandedFinancialId === 'PROJECT_TOTAL' ? 'border-blue-200 shadow-md' : 'border-slate-200 shadow-sm'}`}>
                                            <div
                                                className="p-6 cursor-pointer flex justify-between items-center"
                                                onClick={() => setExpandedFinancialId(expandedFinancialId === 'PROJECT_TOTAL' ? null : 'PROJECT_TOTAL')}
                                            >
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                                                        CoatzadroneUSA
                                                    </h3>
                                                    <p className="text-sm text-slate-500">{selectedDeployment.title} — {selectedDeployment.siteName}</p>
                                                    <p className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex items-end gap-6">
                                                    <div className="text-right">
                                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Project Gross</p>
                                                        <p className="text-2xl font-bold text-slate-900">${getTotalCost(selectedDeployment).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex gap-2 no-print" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={handlePrintReport}
                                                            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 transition-colors flex items-center gap-2"
                                                        >
                                                            <Printer className="w-4 h-4" /> Print
                                                        </button>
                                                        <button
                                                            onClick={handleEmailInvoices}
                                                            className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                        >
                                                            <Send className="w-4 h-4" /> Email All
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Project Accordion Details */}
                                            {expandedFinancialId === 'PROJECT_TOTAL' && (
                                                <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 border-t border-slate-100 pt-4">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Daily Burn Rate Breakdown</h4>
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                                            <tr>
                                                                <th className="px-3 py-2 font-medium">Date</th>
                                                                <th className="px-3 py-2 font-medium">Personnel Count</th>
                                                                <th className="px-3 py-2 font-medium">Daily Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {getDeploymentDays(selectedDeployment).map(day => {
                                                                const dayLogs = selectedDeployment.dailyLogs?.filter(l => l.date === day) || [];
                                                                const dayTotal = dayLogs.reduce((sum, l) => sum + (l.dailyPay || 0) + (l.bonusPay || 0), 0);
                                                                return (
                                                                    <tr key={day}>
                                                                        <td className="px-3 py-2 font-mono text-xs">{day}</td>
                                                                        <td className="px-3 py-2">{dayLogs.length}</td>
                                                                        <td className="px-3 py-2 font-semibold text-slate-900">${dayTotal.toLocaleString()}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* Personnel Breakdown */}
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                                <h4 className="font-bold text-slate-800">Personnel Financials</h4>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {Array.from(new Set((selectedDeployment.dailyLogs || []).filter(l => l && l.technicianId).map(l => l.technicianId))).map(techId => {
                                                    const personLogs = (selectedDeployment.dailyLogs || []).filter(l => l.technicianId === techId);
                                                    const totalDays = personLogs.length;
                                                    const totalPay = personLogs.reduce((sum, l) => sum + (l.dailyPay || 0) + (l.bonusPay || 0), 0);
                                                    const personName = personnel?.find(p => p.id === techId)?.fullName || 'Unknown Technician';
                                                    const isExpanded = expandedFinancialId === techId;

                                                    return (
                                                        <div key={techId} className={`transition-all ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                                                            {/* Row Header */}
                                                            <div
                                                                className="flex items-center justify-between px-6 py-4 cursor-pointer"
                                                                onClick={() => setExpandedFinancialId(isExpanded ? null : techId)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-1 rounded transition-transform ${isExpanded ? 'rotate-90 text-blue-600' : 'text-slate-400'}`}>
                                                                        <ChevronRight className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-slate-900">{personName}</p>
                                                                        <p className="text-xs text-slate-500">{totalDays} days logged</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-6">
                                                                    <div className="text-right">
                                                                        <p className="text-xl font-bold text-emerald-600">${totalPay.toLocaleString()}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleGenerateInvoice(techId);
                                                                        }}
                                                                        className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm z-10"
                                                                    >
                                                                        <LinkIcon className="w-3 h-3" /> Invoice Link
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Expanded Details */}
                                                            {isExpanded && (
                                                                <div className="px-14 pb-4 animate-in fade-in slide-in-from-top-1">
                                                                    <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden bg-white">
                                                                        <thead className="bg-slate-50 border-b border-slate-200">
                                                                            <tr>
                                                                                <th className="px-3 py-2 font-medium text-slate-500">Date</th>
                                                                                <th className="px-3 py-2 font-medium text-slate-500">Rate</th>
                                                                                <th className="px-3 py-2 font-medium text-slate-500">Bonus</th>
                                                                                <th className="px-3 py-2 font-medium text-slate-500">Notes</th>
                                                                                <th className="px-3 py-2 font-medium text-slate-500 text-right">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            {personLogs.map(log => (
                                                                                <tr key={log.id}>
                                                                                    <td className="px-3 py-2 text-slate-600 font-mono">{log.date ? String(log.date).split('T')[0] : 'N/A'}</td>
                                                                                    <td className="px-3 py-2 text-slate-600">${log.dailyPay?.toLocaleString()}</td>
                                                                                    <td className="px-3 py-2 text-emerald-600">{log.bonusPay ? `+$${log.bonusPay}` : '-'}</td>
                                                                                    <td className="px-3 py-2 text-slate-500 italic max-w-xs truncate">{log.notes || '-'}</td>
                                                                                    <td className="px-3 py-2 font-medium text-slate-900 text-right">
                                                                                        ${((log.dailyPay || 0) + (log.bonusPay || 0)).toLocaleString()}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {(selectedDeployment.dailyLogs || []).length === 0 && (
                                                    <div className="px-6 py-8 text-center text-slate-500 italic">
                                                        No daily logs recorded yet. Add logs to see financial breakdown.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {generatedLink && (
                                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-2">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                                                        <CheckCircle className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-emerald-900">Secure Invoice Link Generated</h4>
                                                        <p className="text-sm text-emerald-700 mt-1">
                                                            Share this link with the pilot. It is a one-time use secure link that allows them to view and download their invoice.
                                                        </p>
                                                        <div className="mt-3 flex items-center gap-2">
                                                            <code className="flex-1 bg-white border border-emerald-200 px-3 py-2 rounded text-xs text-emerald-800 font-mono break-all selection:bg-emerald-200">
                                                                {generatedLink}
                                                            </code>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(generatedLink);
                                                                    alert('Link copied to clipboard!');
                                                                }}
                                                                className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition-colors"
                                                            >
                                                                Copy
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setGeneratedLink(null)} className="text-emerald-400 hover:text-emerald-600">
                                                        &times;
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : activeModalTab === 'site-assets' ? (
                                    <div className="p-6 space-y-6">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-amber-500" />
                                                Site-Linked Assets
                                            </h4>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                                                Site ID: {selectedDeployment.siteId || 'None'}
                                            </div>
                                        </div>

                                        {loadingAssets ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                                <p className="text-sm">Fetching enterprise assets...</p>
                                            </div>
                                        ) : siteAssets.length === 0 ? (
                                            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
                                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Activity className="w-5 h-5 text-slate-300" />
                                                </div>
                                                <h5 className="text-sm font-medium text-slate-900">No assets linked to this site</h5>
                                                <p className="text-xs text-slate-500 mt-1">Visit the Assets tab to register equipment for {selectedDeployment.siteName}.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {siteAssets.map((asset) => (
                                                    <div key={asset.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all group">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${asset.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                                                <Zap className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-bold text-slate-900">{asset.name}</p>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${asset.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                        {asset.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500">{asset.category} • {asset.location}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Next Audit</p>
                                                            <p className="text-xs font-medium text-slate-700">{asset.nextInspectionDate || 'Not Scheduled'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : activeModalTab === 'team' ? (
                                    <div className="p-6 space-y-8">
                                        {/* Team Setup Content */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Flight Crew / Personnel */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                    <Plane className="w-4 h-4 text-blue-500" />
                                                    Flight Crew (Pilots/Techs)
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDeployment.technicianIds || []).map(techId => {
                                                        const p = personnel.find(per => per.id === techId);
                                                        if (!p) return null;
                                                        return (
                                                            <div key={techId} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                                        {p.fullName.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-slate-900">{p.fullName}</p>
                                                                        <p className="text-[10px] text-slate-500 font-bold uppercase">{p.role}</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleUnassignPersonnel(techId)}
                                                                    className="text-slate-400 hover:text-red-600 p-1"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                    {(selectedDeployment.technicianIds || []).length === 0 && (
                                                        <p className="text-xs text-slate-400 italic bg-white p-4 rounded-lg border border-dashed text-center">No flight crew assigned.</p>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    <select
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                        onChange={(e) => {
                                                            if (e.target.value) handleAssignPersonnel(e.target.value);
                                                            e.target.value = "";
                                                        }}
                                                    >
                                                        <option value="">+ Assign Pilot/Technician</option>
                                                        {personnel
                                                            .filter(p => p.status === 'Active' && !(selectedDeployment.technicianIds || []).includes(p.id))
                                                            .map(p => (
                                                                <option key={p.id} value={p.id}>{p.fullName} ({p.role})</option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Mission Monitoring / Users */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                                    Mission Monitoring (Control)
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDeployment.monitoringTeam || []).map(u => (
                                                        <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-emerald-100 rounded-lg shadow-sm shadow-emerald-50/50">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                                                    {u.fullName.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-slate-900">{u.fullName}</p>
                                                                    <p className="text-[10px] text-emerald-600 font-bold uppercase">{u.role}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleUnassignMonitor(u.id)}
                                                                className="text-slate-400 hover:text-red-600 p-1"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(selectedDeployment.monitoringTeam || []).length === 0 && (
                                                        <p className="text-xs text-slate-400 italic bg-white p-4 rounded-lg border border-dashed text-center">No monitoring team assigned.</p>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    <select
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                                        onChange={(e) => {
                                                            if (e.target.value) handleAssignMonitor(e.target.value);
                                                            e.target.value = "";
                                                        }}
                                                    >
                                                        <option value="">+ Assign Monitoring Team</option>
                                                        {allUsers
                                                            .filter(u => !(selectedDeployment.monitoringTeam || []).some(m => m.id === u.id))
                                                            .map(u => (
                                                                <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-6 flex items-center justify-center text-slate-500">
                                        Select a tab to view details
                                    </div>
                                )}
                            </div>

                            <div className="bg-white border-t border-slate-200 p-4 flex justify-between items-center shrink-0">
                                <div className="text-sm">
                                    <span className="text-slate-500">Total Mission Cost: </span>
                                    <span className="font-bold text-slate-900 text-lg">${getTotalCost(selectedDeployment).toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => setIsLogModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div >
                )
            }

            {/* Add Mission Modal */}
            {
                isAddModalOpen && (
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
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Site Name</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                            placeholder="e.g. Site Alpha"
                                            value={newDeployment.siteName || ''}
                                            onChange={e => setNewDeployment({ ...newDeployment, siteName: e.target.value })}
                                        />
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
                                    onClick={handleAddDeployment}
                                    disabled={!newDeployment.title || !newDeployment.siteName}
                                    className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
                                >
                                    Confirm Schedule
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DeploymentTracker;
