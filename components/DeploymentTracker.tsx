import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Calendar,
    Cloud,
    Trash2,
    Upload,
    FileText,
    CheckCircle,
    XCircle,
    Download,
    Eye,
    Printer,
    Send,
    ShieldCheck,
    Plus,
    Users,
    DollarSign,
    Box,
    CheckSquare,
    Square,
    Check,
    X,
    ArrowRight, Briefcase, ChevronDown, ChevronRight, Clock, Edit2, ExternalLink, Filter, LayoutGrid, Link as LinkIcon, Loader2, MapPin, MoreVertical, Receipt, Search, Zap, Plane, List, Grid3X3, BarChart3, Activity, Mail, UserPlus, UserCheck, BrainCircuit, RotateCcw
} from 'lucide-react';
import ProjectInvoiceView from './ProjectInvoiceView';
import { Deployment, DeploymentStatus, DeploymentType, DailyLog, Personnel, DeploymentFile, UserAccount, Country } from '../types';
import CalendarView from './CalendarView';
import AssetTracker from './AssetTracker';
import WorkItemChecklist from './WorkItemChecklist';
import ClientForm from './ClientForm';
import StakeholderForm from './StakeholderForm';
import apiClient from '../src/services/apiClient';
import { useAuth } from '../src/context/AuthContext';
import IndustryReportsHub from '../modules/ai-reporting/IndustryReportsHub';
import { isAdmin } from '../src/utils/roleUtils';

const calculateDistance = (loc1?: string, loc2?: string) => {
    if (!loc1 || !loc2) return null;
    const parse = (s: string) => {
        const parts = s.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lon: parts[1] };
        return null;
    };
    const c1 = parse(loc1);
    const c2 = parse(loc2);
    if (c1 && c2) {
        // Haversine
        const R = 3958.8; // Radius of Earth in miles
        const dLat = (c2.lat - c1.lat) * Math.PI / 180;
        const dLon = (c2.lon - c1.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    }
    return null;
};

const DeploymentTracker: React.FC<{ forcedStatus?: DeploymentStatus; industryFilter?: string }> = ({ forcedStatus, industryFilter }) => {
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [countries, setCountries] = useState<Country[]>([]);
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('dt_searchQuery') || '');
    const [statusFilter, setStatusFilter] = useState<'All' | DeploymentStatus | string>(() => {
        if (forcedStatus) return forcedStatus;
        return (sessionStorage.getItem('dt_statusFilter') as any) || 'All';
    });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [isStakeholderFormOpen, setIsStakeholderFormOpen] = useState(false);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => (sessionStorage.getItem('dt_viewMode') as any) || 'list');

    // Lifecycle Transition Logic
    const getNextAllowedStatuses = (current: DeploymentStatus): DeploymentStatus[] => {
        const allowed: Record<string, DeploymentStatus[]> = {
            [DeploymentStatus.DRAFT]: [DeploymentStatus.SCHEDULED, DeploymentStatus.ARCHIVED],
            [DeploymentStatus.SCHEDULED]: [DeploymentStatus.ACTIVE, DeploymentStatus.CANCELLED, DeploymentStatus.DELAYED, DeploymentStatus.DRAFT],
            [DeploymentStatus.ACTIVE]: [DeploymentStatus.REVIEW, DeploymentStatus.COMPLETED, DeploymentStatus.DELAYED, DeploymentStatus.CANCELLED],
            [DeploymentStatus.REVIEW]: [DeploymentStatus.COMPLETED, DeploymentStatus.ACTIVE],
            [DeploymentStatus.COMPLETED]: [DeploymentStatus.ARCHIVED, DeploymentStatus.REVIEW],
            [DeploymentStatus.ARCHIVED]: [] // Terminal
        };
        return allowed[current] || [];
    };

    const handleStatusChange = async (id: string, newStatus: DeploymentStatus) => {
        try {
            const res = await apiClient.put(`/deployments/${id}`, { status: newStatus });
            if (res.data.success) {
                // Update local list
                setDeployments(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
                if (selectedDeployment && selectedDeployment.id === id) {
                    setSelectedDeployment(prev => prev ? { ...prev, status: newStatus } : null);
                }
            }
        } catch (error) {
            console.error('Failed to update status', error);
            alert("Failed to update status: " + (error as any).message); // Will refine this UI later
        }
    };
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Invoicing State
    const [selectedPersonnelForInvoice, setSelectedPersonnelForInvoice] = useState<Set<string>>(new Set());
    const [sendToPilots, setSendToPilots] = useState(true);
    const [invoiceNote, setInvoiceNote] = useState('');
    const [showInvoiceNoteModal, setShowInvoiceNoteModal] = useState(false);
    const [pendingInvoiceIds, setPendingInvoiceIds] = useState<string[] | undefined>(undefined);

    const [activeModalTab, setActiveModalTab] = useState<'logs' | 'files' | 'financials' | 'team' | 'site-assets' | 'checklist' | 'ai-reports'>('logs');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number } | null>(null);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [sites, setSites] = useState<any[]>([]);
    const selectedClientForNewMissionRef = React.useRef<string>(''); // Ref to track without triggering rerender loops if needed, or use state
    const [selectedClientForNewMission, setSelectedClientForNewMission] = useState<string>('');
    const [clientStakeholders, setClientStakeholders] = useState<any[]>([]);
    const [siteAssets, setSiteAssets] = useState<any[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    // Persistence Effects
    useEffect(() => { sessionStorage.setItem('dt_searchQuery', searchQuery); }, [searchQuery]);
    useEffect(() => { sessionStorage.setItem('dt_statusFilter', statusFilter); }, [statusFilter]);
    useEffect(() => { sessionStorage.setItem('dt_viewMode', viewMode); }, [viewMode]);

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

    // Pricing Engine State
    const [pricingData, setPricingData] = useState<any>(null);
    const [isCalculatingPricing, setIsCalculatingPricing] = useState(false);
    const [markupOverride, setMarkupOverride] = useState<number | null>(null);

    const [isAddingExtraDay, setIsAddingExtraDay] = useState(false);
    const [extraDayDate, setExtraDayDate] = useState('');
    const [deploymentPaymentTerms, setDeploymentPaymentTerms] = useState<number>(30); // Per-deployment payment terms override

    // Fetch global payment terms on mount to set the default for new mission overrides
    useEffect(() => {
        apiClient.get('/system/settings').then(res => {
            if (res.data.success && res.data.data.invoice_payment_days) {
                setDeploymentPaymentTerms(parseInt(res.data.data.invoice_payment_days));
            }
        }).catch(err => console.error('Failed to fetch global terms:', err));
    }, []);

    const confirmAddExtraDay = () => {
        if (!extraDayDate || !selectedDeployment) return;

        // We don't save to backend immediately here; we just make it available in the UI
        // effectively "forcing" getDeploymentDays to include it by mocking a log or just relying on a temporary state?
        // Actually, getDeploymentDays pulls from `dailyLogs`. If we don't save a log, it won't persist.
        // Strategy: We will rely on the `getDeploymentDays` to scan `extraDayDates` (new state) map + logs.
        // OR better: Create a 0-value placeholder log? No, that might be "dirty".
        // Alternative: Just temporarily add it to a local "extraDates" array in state that getDeploymentDays also checks?
        // Wait, `getDeploymentDays` takes `deployment` object. I can attach `extraDates` to the selectedDeployment object locally.

        // Let's modify the selectedDeployment state to include this date in a temporary 'virtual' way 
        // OR just handle it via a separate state that `getDeploymentDays` doesn't see?

        // Actually, easiest way: Just pass `extraDates` to `getDeploymentDays` or modify `selectedDeployment.dailyLogs` with a placeholder?
        // If I update `selectedDeployment` with a placeholder log (technicianId: 'placeholder'), backend might reject it if I try to save.

        // Let's go with: Update selectedDeployment locally to track this "intent".
        // But `getDeploymentDays` is pure. 
        // I will add a `tempDays` state and merge it.

        setTempExtraDays(prev => [...prev, extraDayDate]);
        setIsAddingExtraDay(false);
        setExtraDayDate('');
    };

    const [tempExtraDays, setTempExtraDays] = useState<string[]>([]);

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

    const handleAddPilotToAllDays = async () => {
        if (!selectedDeployment || !newLog.technicianId || !newLog.dailyPay) return;
        const allDays = getDeploymentDays(selectedDeployment);
        const existingDays = new Set(
            (selectedDeployment.dailyLogs || [])
                .filter(l => String(l.technicianId) === String(newLog.technicianId))
                .map(l => String(l.date).split('T')[0])
        );
        const daysToAdd = allDays.filter(day => !existingDays.has(day));
        if (daysToAdd.length === 0) {
            alert('This pilot is already assigned to all days.');
            return;
        }
        if (!confirm(`Add ${personnel.find(p => String(p.id) === String(newLog.technicianId))?.fullName || 'Pilot'} to ${daysToAdd.length} remaining day(s) at $${newLog.dailyPay}/day?`)) return;
        try {
            let updatedDeployment = { ...selectedDeployment };
            for (const day of daysToAdd) {
                const payload = {
                    ...newLog,
                    date: new Date(day + 'T12:00:00').toISOString(),
                    deploymentId: selectedDeployment.id
                };
                const response = await apiClient.post(`/deployments/${selectedDeployment.id}/daily-logs`, payload);
                const addedLog = response.data.data;
                updatedDeployment = {
                    ...updatedDeployment,
                    dailyLogs: [...(updatedDeployment.dailyLogs || []), addedLog]
                };
            }
            setSelectedDeployment(updatedDeployment);
            setDeployments(prev => prev.map(d => d.id === selectedDeployment.id ? updatedDeployment : d));
            setNewLog({ technicianId: '', date: '', dailyPay: 0, bonusPay: 0, notes: '' });
            alert(`Successfully added pilot to ${daysToAdd.length} day(s).`);
        } catch (err: any) {
            console.error('Error adding pilot to all days:', err);
            alert('Failed to add pilot to some days: ' + (err.response?.data?.message || err.message));
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
        fetchClients();
        fetchSites();
        fetchCountries();
    }, []);

    const fetchCountries = async () => {
        try {
            const response = await apiClient.get('/regions/countries?status=ENABLED');
            setCountries(response.data.data || []);
        } catch (err) {
            console.error('Failed to fetch countries', err);
        }
    };

    const fetchDeployments = async () => {
        try {
            setLoading(true);
            const url = industryFilter ? `/deployments?industryKey=${industryFilter}` : '/deployments';
            const response = await apiClient.get(url);
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

    const fetchClients = async () => {
        try {
            const response = await apiClient.get('/clients');
            setClients(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching clients:', err);
        }
    };

    const fetchSites = async (clientId?: string) => {
        try {
            const url = clientId ? `/assets/sites?clientId=${clientId}` : '/assets/sites';
            const response = await apiClient.get(url);
            setSites(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching sites:', err);
        }
    };

    const fetchClientStakeholders = async (clientId: string) => {
        try {
            const response = await apiClient.get(`/clients/${clientId}/stakeholders`);
            setClientStakeholders(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching client stakeholders:', err);
            setClientStakeholders([]);
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

    const handleAIRegisteredScan = async (deployment: Deployment) => {
        try {
            // Simulated AI Analysis for Mission
            const recommendations = [
                "Drone telemetry indicates abnormal battery drain on flight 4 — check cell consistency.",
                "Weather pattern shift detected: Wind gusting to 18mph. Advise ceiling reduction to 150ft.",
                "Image density for Sector B is 12% below requirement. Recommend adding 4 flight lines."
            ];

            const summary = `AI Mission Control has analyzed ${deployment.title}. Status: OPTIMAL with 3 active advisories.`;

            // We'll use a simple alert for now, but in a real app this would update a drawer or notification system
            alert(`--- AI MISSION INTELLIGENCE ---\n\n${summary}\n\nRecommendations:\n${recommendations.map(r => `• ${r}`).join('\n')}`);

        } catch (err: any) {
            console.error('AI Scan failed', err);
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

            // Fetch client stakeholders if we have a client ID
            if (freshDeployment.clientId) {
                fetchClientStakeholders(freshDeployment.clientId);
            }

            setActiveModalTab(user?.role === 'pilot_technician' ? 'files' : 'logs');
            setIsLogModalOpen(true);
        } catch (err: any) {
            console.error('Error fetching deployment details:', err);
            alert(err.message);
        }
    };

    const fetchSiteAssets = async (siteId: string) => {
        try {
            setLoadingAssets(true);
            const url = industryFilter ? `/assets?site_id=${siteId}&industryKey=${industryFilter}` : `/assets?site_id=${siteId}`;
            const response = await apiClient.get(url);
            setSiteAssets(response.data.data || []);
        } catch (err: any) {
            console.error('Error fetching site assets:', err);
        } finally {
            setLoadingAssets(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !selectedDeployment) return;

        setUploading(true);
        setUploadProgress({ current: 0, total: files.length });
        let currentDeployment = selectedDeployment;

        try {
            // Because backend uses uploadSingle, we upload sequentially
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('image', file);

                const response = await apiClient.post(`/deployments/${selectedDeployment.id}/files`, formData);
                if (response.data.success) {
                    const newFile = response.data.data;
                    currentDeployment = {
                        ...currentDeployment,
                        files: [newFile, ...(currentDeployment.files || [])]
                    };
                }
                setUploadProgress({ current: i + 1, total: files.length });
            }

            // Sync final state after all uploads complete
            setSelectedDeployment(currentDeployment);
            setDeployments(prev => prev.map(d =>
                d.id === selectedDeployment.id ? { ...d, fileCount: (d.fileCount || 0) + files.length } : d
            ));

        } catch (err: any) {
            console.error('Error uploading file:', err);
            alert('Upload failed for some or all files: ' + err.message);
        } finally {
            setUploading(false);
            setUploadProgress(null);
            if (event.target) {
                event.target.value = ''; // Reset input to allow selecting same files again
            }
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

    const handleAssignMonitor = async (userId: string, role: string = 'Monitor') => {
        if (!selectedDeployment) return;
        try {
            await apiClient.post(`/deployments/${selectedDeployment.id}/monitoring`, { userId, role });
            // Optimistic update
            let user = allUsers.find(u => u.id === userId);

            // If not found in allUsers (e.g. newly created stakeholder), look in clientStakeholders
            if (!user) {
                const stakeholder = clientStakeholders.find((s: any) => s.user_id === userId);
                if (stakeholder) {
                    user = {
                        id: stakeholder.user_id,
                        fullName: stakeholder.full_name,
                        email: stakeholder.email,
                        role: 'client_user', // Default for stakeholders
                        companyName: '', // Optional or derive
                        permissions: []
                    } as any;
                }
            }

            if (user) {
                setSelectedDeployment(prev => {
                    if (!prev) return null;
                    const existingMonitorIndex = (prev.monitoringTeam || []).findIndex(m => m.id === userId);

                    let newTeam = [...(prev.monitoringTeam || [])];
                    if (existingMonitorIndex >= 0) {
                        // Update existing
                        newTeam[existingMonitorIndex] = {
                            ...newTeam[existingMonitorIndex],
                            missionRole: role as any
                        };
                    } else {
                        // Add new
                        newTeam.push({
                            id: user!.id,
                            fullName: user!.fullName,
                            email: user!.email,
                            role: user!.role,
                            missionRole: role as any
                        });
                    }

                    return {
                        ...prev,
                        monitoringTeam: newTeam
                    };
                });
            }
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

    const handleCalculatePricing = async (markupVal?: number) => {
        if (!selectedDeployment) return;
        try {
            setIsCalculatingPricing(true);
            const response = await apiClient.post('/deployments/pricing/calculate', {
                deploymentId: selectedDeployment.id,
                markupOverride: markupVal ?? markupOverride
            });
            setPricingData(response.data.data);
            if (markupVal !== undefined) setMarkupOverride(markupVal);
        } catch (err: any) {
            console.error('Pricing calculation failed', err);
        } finally {
            setIsCalculatingPricing(false);
        }
    };

    const handleSavePricing = async () => {
        if (!selectedDeployment || !pricingData) return;
        try {
            const { recommendation, calculation } = pricingData;
            await apiClient.put(`/deployments/${selectedDeployment.id}/pricing`, {
                baseCost: calculation.totalBaseCost,
                markupPercentage: recommendation.markupPercentage,
                clientPrice: recommendation.recommendedPrice,
                travelCosts: calculation.travelCost,
                equipmentCosts: calculation.equipmentCost
            });

            // Refresh deployment
            const res = await apiClient.get(`/deployments/${selectedDeployment.id}`);
            setSelectedDeployment(res.data.data);
            alert('Pricing saved to mission successfully');
        } catch (err: any) {
            console.error('Failed to save pricing', err);
            alert('Failed to save pricing: ' + err.message);
        }
    };

    const handleGenerateInvoice = async (personnelId: string, openEdit: boolean = false) => {
        if (!selectedDeployment) return;
        try {
            const response = await apiClient.post('/invoices', {
                deploymentId: selectedDeployment.id,
                personnelId: personnelId,
                paymentTermsDays: deploymentPaymentTerms // Send payment terms override
            });
            const link = response.data.data.link;
            // Assuming the link returned by backend is relative /invoice/token
            // We want to show full URL
            const fullLink = `${window.location.origin}${link}`;

            if (openEdit) {
                window.open(`${fullLink}?edit=true`, '_blank');
            } else {
                setGeneratedLink(fullLink);
            }
        } catch (err: any) {
            console.error('Error creating invoice:', err);
            alert(err.message);
        }
    };

    const getDeploymentDays = (deployment: Deployment) => {
        if (!deployment || !deployment.date) return [];
        try {
            const daysSet = new Set<string>();

            // 1. Add range-based days
            let dateStr = String(deployment.date);
            if (dateStr.includes('T')) {
                dateStr = dateStr.split('T')[0];
            }

            const parts = dateStr.split('-').map(Number);
            if (parts.length === 3) {
                const [y, m, d] = parts;
                const startDate = new Date(y, m - 1, d);

                for (let i = 0; i < (deployment.daysOnSite || 1); i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);

                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(date.getDate()).padStart(2, '0');
                    daysSet.add(`${year}-${month}-${dayStr}`);
                }
            } else {
                daysSet.add(dateStr);
            }

            // 2. Add extra days found in logs
            if (deployment.dailyLogs) {
                deployment.dailyLogs.forEach(log => {
                    if (log.date) {
                        const logDate = String(log.date).split('T')[0];
                        daysSet.add(logDate);
                    }
                });
            }

            // 3. Add temporary extra days from UI
            if (selectedDeployment?.id === deployment.id) {
                tempExtraDays.forEach(d => daysSet.add(d));
            }

            // 4. Convert to array and sort
            return Array.from(daysSet).sort();
        } catch (e) {
            console.error('Error calculating days:', e);
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

    const [editingDeploymentId, setEditingDeploymentId] = useState<string | null>(null);

    const [newDeployment, setNewDeployment] = useState<Partial<Deployment>>({
        type: DeploymentType.ROUTINE,
        status: DeploymentStatus.SCHEDULED,
        date: new Date().toISOString().split('T')[0],
        clientId: '',
        countryId: '' // Add country support
    });

    const handleEditMission = (deployment: Deployment) => {
        setEditingDeploymentId(deployment.id);
        setNewDeployment({
            title: deployment.title,
            type: deployment.type,
            status: deployment.status,
            siteName: deployment.siteName,
            date: String(deployment.date).split('T')[0],
            location: deployment.location,
            notes: deployment.notes,
            daysOnSite: deployment.daysOnSite,
            clientId: deployment.clientId,
            countryId: deployment.countryId
        });
        setIsAddModalOpen(true);
        // We can keep the details modal open or close it. 
        // If we keep it open, we need to make sure z-index is handled or close it.
        // Let's close the details modal to avoid stacking issues for now, or just stack them.
        // Stacking might be confusing. Let's close details? 
        // Actually, user might want to go back. 
        // Let's keep details open but maybe hide it? 
        // Simplest: Edit is triggered from details modal.
    };

    const handleAddDeployment = async () => {
        if (!newDeployment.title || !newDeployment.siteName) return;

        try {
            if (editingDeploymentId) {
                // UPDATE Existing
                const response = await apiClient.put(`/deployments/${editingDeploymentId}`, {
                    title: newDeployment.title,
                    type: newDeployment.type,
                    status: newDeployment.status,
                    siteName: newDeployment.siteName,
                    date: newDeployment.date,
                    location: newDeployment.location,
                    notes: newDeployment.notes,
                    daysOnSite: newDeployment.daysOnSite,
                    clientId: newDeployment.clientId,
                    countryId: newDeployment.countryId,
                    industry: newDeployment.industry || industryFilter || null,
                });

                const updated = response.data.data;

                // Update List
                setDeployments(prev => prev.map(d => d.id === editingDeploymentId ? updated : d));

                // Update Selected (if open)
                if (selectedDeployment?.id === editingDeploymentId) {
                    setSelectedDeployment(prev => prev ? { ...prev, ...updated } : null);
                }

                alert('Mission updated successfully');
            } else {
                // CREATE New
                const response = await apiClient.post('/deployments', {
                    title: newDeployment.title,
                    type: newDeployment.type,
                    status: newDeployment.status,
                    siteName: newDeployment.siteName,
                    date: newDeployment.date || new Date().toISOString().split('T')[0],
                    location: newDeployment.location,
                    notes: newDeployment.notes,
                    daysOnSite: newDeployment.daysOnSite,
                    clientId: newDeployment.clientId,
                    countryId: newDeployment.countryId,
                    industry: newDeployment.industry || industryFilter || null,
                });

                const data = response.data;
                setDeployments([data.data, ...deployments]);
            }

            // Reset
            setIsAddModalOpen(false);
            setEditingDeploymentId(null);
            setNewDeployment({
                type: DeploymentType.ROUTINE,
                status: DeploymentStatus.SCHEDULED,
                date: new Date().toISOString().split('T')[0],
                clientId: '',
                countryId: ''
            });

        } catch (err: any) {
            console.error('Error saving deployment:', err);
            alert(err.message);
        }
    };

    const togglePersonnelSelection = (id: string) => {
        const newSet = new Set(selectedPersonnelForInvoice);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPersonnelForInvoice(newSet);
    };

    const handleEmailInvoices = async (specificPersonnelIds?: string[]) => {
        if (!selectedDeployment) return;
        // Show note modal first
        setPendingInvoiceIds(specificPersonnelIds || []);
        setShowInvoiceNoteModal(true);
    };

    const handleConfirmSendInvoices = async () => {
        if (!selectedDeployment) return;
        setShowInvoiceNoteModal(false);

        // Determine the target list exactly like the previous logic did
        const idsToUse = pendingInvoiceIds && pendingInvoiceIds.length > 0
            ? pendingInvoiceIds
            : Array.from(selectedPersonnelForInvoice);

        const isSelective = idsToUse.length > 0;

        try {
            const payload = isSelective
                ? { personnelIds: idsToUse, sendToPilots, adminNote: invoiceNote.trim() || undefined }
                : { sendToPilots, adminNote: invoiceNote.trim() || undefined };

            const response = await apiClient.post(`/deployments/${selectedDeployment.id}/invoices/send`, payload);
            setInvoiceNote('');
            if (response.data.emailStatus === 'MOCK') {
                alert('Success, but NOTE: System is in SMTP MOCK MODE. Emails were logged to server but not actually sent. Please check your SMTP settings if this is unexpected.');
            } else {
                alert(response.data.message);
            }
        } catch (err: any) {
            console.error('Error sending invoices:', err);
            alert('Failed to send invoices: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleNotifyAssignment = async (personId: string, type: 'CREW' | 'MONITOR' | 'CLIENT', name: string) => {
        if (!selectedDeployment) return;
        try {
            const response = await apiClient.post(`/deployments/${selectedDeployment.id}/notify-assignment`, {
                personId,
                type
            });

            if (response.data.emailStatus === 'MOCK') {
                alert(`Note: System is in SMTP MOCK MODE. Assignment notification for ${name} was logged to server but not actually sent.`);
            } else {
                alert(response.data.message);
            }
        } catch (err: any) {
            console.error('Error sending assignment notification:', err);
            alert('Failed to send notification: ' + (err.response?.data?.message || err.message));
        }
    };

    const togglePersonnelInvoiceSelection = (personnelId: string) => {
        setSelectedPersonnelForInvoice(prev => {
            const newSet = new Set(prev);
            if (newSet.has(personnelId)) {
                newSet.delete(personnelId);
            } else {
                newSet.add(personnelId);
            }
            return newSet;
        });
    };

    const handleViewInvoice = async (personnelId: string) => {
        if (!selectedDeployment) return;

        try {
            // We need to create a temporary invoice link or just fetch the existing one
            // Since the backend 'createInvoice' endpoint generates a link and stores it, we can use that.
            // But 'getInvoiceByToken' is what the view uses.
            // Let's call a new helper or re-use createInvoice to get the link.
            const response = await apiClient.post('/invoices/create', {
                deploymentId: selectedDeployment.id,
                personnelId: personnelId
            });

            if (response.data.success && response.data.data.link) {
                // Open in new tab
                // If the link is relative (starts with /), append origin
                const link = response.data.data.link;
                const url = link.startsWith('http') ? link : `${window.location.origin}${link}`;
                window.open(url, '_blank');
            } else {
                alert('Could not generate invoice link.');
            }

        } catch (err: any) {
            console.error('Error viewing invoice:', err);
            // If manual invoice creation fails, it might be because of 0 earnings or other issues.
            alert('Failed to open invoice. ensure the pilot has earnings.');
        }
    };

    const handlePrintReport = () => {
        window.print();
    };

    const handleDeleteDeployment = async (deploymentId: string, deploymentTitle: string) => {
        if (!confirm(`Are you sure you want to delete mission "${deploymentTitle}"?\n\nThis will permanently remove:\n• All daily logs and pay records\n• All uploaded files and documents\n• Team assignments\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            await apiClient.delete(`/deployments/${deploymentId}`);

            // Remove from local state
            setDeployments(prev => prev.filter(d => d.id !== deploymentId));

            // Close modal if this deployment was open
            if (selectedDeployment?.id === deploymentId) {
                setIsLogModalOpen(false);
                setSelectedDeployment(null);
            }
        } catch (err: any) {
            console.error('Error deleting deployment:', err);
            alert('Failed to delete mission: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteDay = async (day: string) => {
        if (!selectedDeployment) return;

        const logsForDay = selectedDeployment.dailyLogs?.filter(l => String(l.date).split('T')[0] === day) || [];

        // Calculate total pay for confirmation message
        const dayTotal = logsForDay.reduce((sum, l) => sum + (l.dailyPay || 0) + (l.bonusPay || 0), 0);

        // Format date safely for display (prevent timezone shifts)
        const parts = day.split('-').map(Number);
        const safeDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayFormatted = safeDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (logsForDay.length === 0) {
            // Check if it's a temp extra day
            if (tempExtraDays.includes(day)) {
                if (confirm(`Remove ${dayFormatted} from this mission?`)) {
                    setTempExtraDays(prev => prev.filter(d => d !== day));
                }
                return;
            }

            // If it's a range day with no logs, we can't "delete" it per se if it's part of the base range
            // But if the user really wants to remove it, and it's not a temp day... 
            // Actually, if it's part of the base 'daysOnSite' range, we can't just delete it without changing daysOnSite or start date.
            // But let's assume for now we just want to handle the "I added an extra day and want to remove it" case which usually lands in tempExtraDays 
            // OR if it was a day that had logs but they were all deleted, it might still show up if it's in range.

            // If the user tries to delete a day that is PURELY from the date range (and not temp), we should probably explain they need to adjust the mission duration.
            alert(`This day (${dayFormatted}) is part of the scheduled duration. To remove it, please adjust the "Days Onsite" or mission start date.`);
            return;
        }

        if (!confirm(`Delete all logs for ${dayFormatted}?\n\nThis will remove:\n• ${logsForDay.length} pilot log(s)\n• Total pay: $${dayTotal.toLocaleString()}\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            // Delete all logs for this day
            await Promise.all(
                logsForDay.map(log =>
                    apiClient.delete(`/deployments/${selectedDeployment.id}/daily-logs/${log.id}`)
                )
            );

            // Update local state
            const updatedDeployment = {
                ...selectedDeployment,
                dailyLogs: (selectedDeployment.dailyLogs || []).filter(l =>
                    String(l.date).split('T')[0] !== day
                )
            };

            setSelectedDeployment(updatedDeployment);
            setDeployments(prev => prev.map(d =>
                d.id === selectedDeployment.id ? updatedDeployment : d
            ));

            // Remove from temp extra days if it was added there too
            setTempExtraDays(prev => prev.filter(d => d !== day));

        } catch (err: any) {
            console.error('Error deleting day:', err);
            alert('Failed to delete day: ' + (err.response?.data?.message || err.message));
        }
    };

    const filteredDeployments = deployments.filter(d => {
        if (!d) return false;
        const search = searchQuery.toLowerCase();
        const matchesSearch = (d.title?.toLowerCase().includes(search) || false) ||
            (d.siteName?.toLowerCase().includes(search) || false) ||
            (d.id?.toLowerCase().includes(search) || false);
        const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
        const matchesIndustry = !industryFilter ||
            (d as any).industry?.toLowerCase() === industryFilter.toLowerCase();
        return matchesSearch && matchesStatus && matchesIndustry;
    });

    const getStatusColor = (status: DeploymentStatus) => {
        switch (status) {
            case DeploymentStatus.COMPLETED: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case DeploymentStatus.ACTIVE: return 'bg-blue-50 text-blue-700 border-blue-100';
            case DeploymentStatus.SCHEDULED: return 'bg-amber-50 text-amber-700 border-amber-100';
            case DeploymentStatus.CANCELLED: return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-slate-50 text-slate-600';
        }
    };

    // Calculate Terminal Metrics
    const totalMissionsCount = deployments.length;
    const totalFleetSpend = deployments.reduce((sum, d) => sum + getTotalCost(d), 0);
    const totalDataAssets = deployments.reduce((sum, d) => sum + (d.fileCount || 0), 0);
    const groundTeamCount = personnel.length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ── Invoice Note Modal ── */}
            {showInvoiceNoteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="bg-slate-900 px-6 py-5">
                            <h3 className="text-white font-bold text-lg">Send Invoices</h3>
                            <p className="text-slate-400 text-sm mt-0.5">
                                {pendingInvoiceIds && pendingInvoiceIds.length > 0
                                    ? `Sending to ${pendingInvoiceIds.length} selected pilot${pendingInvoiceIds.length > 1 ? 's' : ''}`
                                    : selectedPersonnelForInvoice.size > 0
                                        ? `Sending to ${selectedPersonnelForInvoice.size} selected pilot${selectedPersonnelForInvoice.size > 1 ? 's' : ''}`
                                        : 'Sending to all eligible pilots'}
                                {!sendToPilots && ' · Generating only (not emailing)'}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Note to pilots <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <textarea
                                    className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder-slate-400 bg-slate-50"
                                    rows={4}
                                    placeholder="e.g. Please review your invoice and confirm your banking details are correct. Payment will be processed within 5 business days."
                                    value={invoiceNote}
                                    onChange={e => setInvoiceNote(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-slate-400 mt-1.5">This note will appear in the invoice email sent to each pilot.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowInvoiceNoteModal(false); setInvoiceNote(''); setPendingInvoiceIds(undefined); }}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSendInvoices}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md"
                                >
                                    Send Invoices
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Missions</h2>
                    <p className="text-sm text-slate-500">Manage fleet deployments, crew assignments, and logistics.</p>
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

                    {user?.role !== 'pilot_technician' && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Schedule Mission
                        </button>
                    )}
                </div>
            </div>

            {/* Terminal Metrics Grid — hidden for pilots */}
            {user?.role !== 'pilot_technician' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Activity className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Missions</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">{totalMissionsCount}</span>
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
            </div>}

            {viewMode === 'calendar' ? (
                <CalendarView
                    deployments={deployments} // No filtering on calendar to see full schedule
                    onDeploymentClick={handleViewDetails}
                    onDayClick={handleDayClick}
                />
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col text-slate-900">
                    {/* Filters */}
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                            {(forcedStatus ? [forcedStatus] : ['All', DeploymentStatus.SCHEDULED, DeploymentStatus.ACTIVE, DeploymentStatus.COMPLETED]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => !forcedStatus && setStatusFilter(status as any)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === status
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        } ${forcedStatus ? 'cursor-default' : 'cursor-pointer'}`}
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
                                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                {deploy.id ? deploy.id.split('-')[0].toUpperCase() : 'N/A'}
                                            </span>
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
                                                    <p className="text-sm font-medium text-slate-900">{deploy.siteName || 'Unknown Site'}</p>
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
                                                {deploy.status === DeploymentStatus.ACTIVE && <span className="relative flex h-1.5 w-1.5 mr-1">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                                </span>}
                                                {deploy.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                {deploy.status === DeploymentStatus.ACTIVE && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedDeployment(deploy);
                                                                setIsLogModalOpen(true);
                                                                setActiveModalTab('files');
                                                            }}
                                                            className="p-1 px-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-all flex items-center gap-1"
                                                            title="Upload Flight Data"
                                                        >
                                                            <Upload className="w-3.5 h-3.5" />
                                                            Data
                                                        </button>
                                                        <button
                                                            onClick={() => handleAIRegisteredScan(deploy)}
                                                            className="p-1 px-2 text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 hover:bg-purple-100 rounded transition-all flex items-center gap-1"
                                                            title="AI Mission Review"
                                                        >
                                                            <BrainCircuit className="w-3.5 h-3.5" />
                                                            AI Scan
                                                        </button>
                                                        {isAdmin(user) && (
                                                            <button
                                                                onClick={() => handleStatusChange(deploy.id, DeploymentStatus.COMPLETED)}
                                                                className="p-1 px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded transition-all flex items-center gap-1"
                                                                title="Mark Mission as Complete"
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                Finish
                                                            </button>
                                                        )}
                                                    </>
                                                )}
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
                                                {isAdmin(user) && (
                                                    <button
                                                        onClick={() => handleDeleteDeployment(deploy.id, deploy.title)}
                                                        className="p-1.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-100 rounded-lg transition-all"
                                                        title="Delete Mission"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
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
                                <p className="text-xs text-slate-500 mt-1">
                                    {user?.role === 'pilot_technician'
                                        ? "You don't have any assigned missions yet."
                                        : "Check your search terms or schedule a new mission."}
                                </p>
                                {user?.role !== 'pilot_technician' && (
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                                    >
                                        Schedule Mission
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* Mission Details Modal */}
            {
                isLogModalOpen && selectedDeployment && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 h-[80vh] flex flex-col text-slate-900">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        Mission Details
                                        <button
                                            onClick={() => handleEditMission(selectedDeployment)}
                                            className="ml-2 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Edit Mission Details"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>

                                        {/* Status Transitions */}
                                        <div className="ml-4 flex items-center gap-2">
                                            {selectedDeployment.status !== DeploymentStatus.COMPLETED ? (
                                                <button
                                                    onClick={() => handleStatusChange(selectedDeployment.id, DeploymentStatus.COMPLETED)}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm group"
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                                    Complete Mission
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleStatusChange(selectedDeployment.id, DeploymentStatus.ACTIVE)}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100 hover:bg-amber-100 transition-all shadow-sm group"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
                                                    Uncomplete
                                                </button>
                                            )}
                                        </div>
                                    </h3>
                                    <p className="text-sm text-slate-500">{selectedDeployment.title} — {selectedDeployment.siteName}</p>
                                </div>
                                <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    &times;
                                </button>
                            </div>

                            {/* Tabs */}
                            {/* Tabs: pilots see only Flight Data; admins/ops see full tab set */}
                            <div className="flex border-b border-slate-200 px-6">
                                {user?.role === 'pilot_technician' ? (
                                    <button
                                        onClick={() => setActiveModalTab('files')}
                                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeModalTab === 'files' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Flight Data
                                        </div>
                                    </button>
                                ) : (
                                    <>
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
                                        <button
                                            onClick={() => setActiveModalTab('checklist')}
                                            className={`py-4 px-4 text-sm font-medium border-b-2 transition-all ${activeModalTab === 'checklist' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <CheckSquare className="w-4 h-4" />
                                                Checklist
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setActiveModalTab('ai-reports')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeModalTab === 'ai-reports' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                            AI Reports
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">NEW</span>
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50/50">
                                {activeModalTab === 'checklist' ? (
                                    <div className="p-6">
                                        <WorkItemChecklist scopeType="mission" scopeId={selectedDeployment.id} />
                                    </div>
                                ) : activeModalTab === 'logs' ? (
                                    <div className="p-6 space-y-6">
                                        {/* Daily Logs Content */}
                                        {getDeploymentDays(selectedDeployment).map((day) => (
                                            <div key={day} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                    <h4 className="font-medium text-slate-700 text-sm flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-slate-400" />
                                                        {(() => {
                                                            const [y, m, d] = day.split('-').map(Number);
                                                            return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                                        })()}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-slate-500 bg-slate-200/50 px-2 py-1 rounded">
                                                            Day Total: ${(selectedDeployment.dailyLogs?.filter(l => String(l.date).split('T')[0] === day).reduce((sum, l) => sum + (l.dailyPay || 0) + (l.bonusPay || 0), 0) || 0).toLocaleString()}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeleteDay(day)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            title="Delete entire day"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="p-4 space-y-4">
                                                    {/* Existing Logs for this day */}
                                                    <div className="space-y-2">

                                                        <div className="space-y-2">
                                                            {(selectedDeployment.dailyLogs?.filter(l => String(l.date).split('T')[0] === day) || []).map(log => {
                                                                const personName = personnel.find(p => String(p.id) === String(log.technicianId))?.fullName || `Pilot #${String(log.technicianId).slice(0, 8)}`;
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
                                                                            const selectedPersonnel = personnel.find(p => String(p.id) === String(e.target.value));
                                                                            setNewLog({
                                                                                ...newLog,
                                                                                technicianId: e.target.value,
                                                                                dailyPay: selectedPersonnel?.dailyPayRate || 0
                                                                            });
                                                                        }}
                                                                    >
                                                                        <option value="">Select...</option>
                                                                        {personnel
                                                                            .filter(p => p.status === 'Active' || p.status === 'Inactive' || p.status === 'On Leave')
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
                                                                <div className="col-span-3 flex items-end gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            handleAddLog(day);
                                                                        }}
                                                                        disabled={!newLog.technicianId || !newLog.dailyPay}
                                                                        className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                                                                    >
                                                                        <Plus className="w-3 h-3" /> Day
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            handleAddPilotToAllDays();
                                                                        }}
                                                                        disabled={!newLog.technicianId || !newLog.dailyPay}
                                                                        className="flex-1 px-2 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                                                                        title="Add this pilot to every day of the mission"
                                                                    >
                                                                        <Calendar className="w-3 h-3" /> All Days
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}


                                        {/* Add Extra/Non-Consecutive Day UI */}
                                        <div className="pt-4 border-t border-slate-200">
                                            {isAddingExtraDay ? (
                                                <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-4 animate-in fade-in slide-in-from-top-2">
                                                    <h4 className="text-sm font-bold text-slate-900 mb-2">Add Non-Consecutive Day</h4>
                                                    <div className="flex items-end gap-3">
                                                        <div className="flex-1">
                                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Select Date</label>
                                                            <input
                                                                type="date"
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                                value={extraDayDate}
                                                                onChange={(e) => setExtraDayDate(e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={confirmAddExtraDay}
                                                            disabled={!extraDayDate}
                                                            className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            Confirm Day
                                                        </button>
                                                        <button
                                                            onClick={() => setIsAddingExtraDay(false)}
                                                            className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setIsAddingExtraDay(true)}
                                                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-bold uppercase tracking-wider hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Extra Day (Out of Range)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : activeModalTab === 'files' ? (
                                    <div className="p-6 space-y-6">
                                        {/* Files / Assets Content */}
                                        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50/50 hover:border-blue-300 transition-all">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                                <Upload className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-slate-900">
                                                {user?.role === 'pilot_technician' ? 'Upload Flight Data' : 'Upload Mission Assets'}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1 max-w-xs">
                                                {user?.role === 'pilot_technician'
                                                    ? 'Upload your KML/KMZ flight paths, CSV/Excel data spreadsheets, and mission images (JPG/PNG).'
                                                    : 'Upload flight logs, KML files, site photos, or PDF reports associated with this mission.'}
                                            </p>
                                            <div className="mt-4 relative">
                                                <input
                                                    type="file"
                                                    onChange={handleFileUpload}
                                                    disabled={uploading}
                                                    accept={user?.role === 'pilot_technician' ? '.kml,.kmz,.csv,.xlsx,.xls,.ods,.jpg,.jpeg,.png,.heic,.webp' : undefined}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                    multiple={true}
                                                />
                                                <button disabled={uploading} className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 min-w-[140px]">
                                                    {uploadProgress ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...` : uploading ? 'Uploading...' : 'Select Files'}
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
                                                                {user?.role !== 'pilot_technician' && (
                                                                    <button
                                                                        onClick={() => handleDeleteFile(file.id)}
                                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : activeModalTab === 'financials' ? (
                                    <>
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
                                            {/* Pricing & Profit Engine */}
                                            <div className={`bg-white rounded-xl border transition-all ${expandedFinancialId === 'PRICING_ENGINE' ? 'border-blue-500 shadow-md ring-1 ring-blue-500/10' : 'border-slate-200 shadow-sm'}`}>
                                                <div
                                                    className="p-6 cursor-pointer flex justify-between items-center"
                                                    onClick={() => {
                                                        setExpandedFinancialId(expandedFinancialId === 'PRICING_ENGINE' ? null : 'PRICING_ENGINE');
                                                        if (!pricingData) handleCalculatePricing();
                                                    }}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${expandedFinancialId === 'PRICING_ENGINE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-50 text-blue-600'}`}>
                                                            <DollarSign className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Pricing & Profit Planning</h3>
                                                            <p className="text-sm text-slate-500">Analyze mission costs and optimize margins</p>
                                                        </div>
                                                    </div>
                                                    {selectedDeployment?.clientPrice > 0 && (
                                                        <div className="text-right mr-6">
                                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-0.5">Current Project Value</div>
                                                            <div className="text-xl font-bold text-slate-900">${selectedDeployment.clientPrice.toLocaleString()}</div>
                                                        </div>
                                                    )}
                                                    <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expandedFinancialId === 'PRICING_ENGINE' ? 'rotate-90' : ''}`} />
                                                </div>

                                                {expandedFinancialId === 'PRICING_ENGINE' && (
                                                    <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 border-t border-slate-100 pt-6">
                                                        {!pricingData && isCalculatingPricing ? (
                                                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
                                                                <p className="font-medium">Calculating pricing models...</p>
                                                            </div>
                                                        ) : pricingData ? (
                                                            <div className="space-y-8">
                                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                                                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3">Cost Analysis</div>
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between text-sm">
                                                                                <span className="text-slate-500">Labor Cost</span>
                                                                                <span className="font-semibold text-slate-900">${pricingData.calculation.laborCost.toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-sm">
                                                                                <span className="text-slate-500">Lodging</span>
                                                                                <span className="font-semibold text-slate-900">${pricingData.calculation.lodgingCost.toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-sm">
                                                                                <span className="text-slate-500">Transport/Misc</span>
                                                                                <span className="font-semibold text-slate-900">${(pricingData.calculation.travelCost + pricingData.calculation.equipmentCost).toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="pt-2 border-t border-slate-200 flex justify-between">
                                                                                <span className="text-xs font-bold text-slate-900">Total Base Cost</span>
                                                                                <span className="text-xs font-bold text-blue-600">${pricingData.calculation.totalBaseCost.toLocaleString()}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                                                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3">Margin Optimization</div>
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <div className="flex justify-between mb-2">
                                                                                    <span className="text-[11px] font-bold text-slate-600">Markup %</span>
                                                                                    <span className="text-xs font-bold text-blue-600">{pricingData.recommendation.markupPercentage}%</span>
                                                                                </div>
                                                                                <input
                                                                                    type="range"
                                                                                    min="0"
                                                                                    max="200"
                                                                                    step="5"
                                                                                    value={markupOverride ?? pricingData.recommendation.markupPercentage}
                                                                                    onChange={(e) => handleCalculatePricing(parseInt(e.target.value))}
                                                                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                                                />
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                                                <button onClick={() => handleCalculatePricing(30)} className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded hover:border-blue-500 transition-colors uppercase">30% (Std)</button>
                                                                                <button onClick={() => handleCalculatePricing(50)} className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded hover:border-blue-500 transition-colors uppercase">50% (High)</button>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="bg-blue-600/5 p-5 rounded-2xl border border-blue-600/10 flex flex-col justify-center text-center">
                                                                        <div className="text-[10px] uppercase font-bold text-blue-600 tracking-widest mb-2">Target Price</div>
                                                                        <div className="text-3xl font-black text-slate-900 tracking-tight">${Math.round(pricingData.recommendation.recommendedPrice).toLocaleString()}</div>
                                                                        <div className="text-xs text-slate-500 mt-1 italic">Suggested client quote</div>
                                                                    </div>

                                                                    <div className={`p-5 rounded-2xl border flex flex-col justify-center text-center ${pricingData.recommendation.estimatedMargin > 40 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                                                        <div className={`text-[10px] uppercase font-bold tracking-widest mb-2 ${pricingData.recommendation.estimatedMargin > 40 ? 'text-emerald-600' : 'text-amber-600'}`}>Est. Profit Margin</div>
                                                                        <div className={`text-3xl font-black tracking-tight ${pricingData.recommendation.estimatedMargin > 40 ? 'text-emerald-700' : 'text-amber-700'}`}>{Math.round(pricingData.recommendation.estimatedMargin)}%</div>
                                                                        <div className="text-xs text-slate-500 mt-1 italic">${Math.round(pricingData.recommendation.estimatedProfit).toLocaleString()} net profit</div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                                                    <button
                                                                        onClick={() => setPricingData(null)}
                                                                        className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                                                    >
                                                                        Discard
                                                                    </button>
                                                                    <button
                                                                        onClick={handleSavePricing}
                                                                        className="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all active:scale-95"
                                                                    >
                                                                        Apply Pricing to Project
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-8">
                                                                <p className="text-slate-500 mb-4">No pricing model calculated yet.</p>
                                                                <button onClick={() => handleCalculatePricing()} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Initialize Pricing Engine</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Financial Overview - CoatzadroneUSA */}
                                            <div className={`bg-white rounded-xl border transition-all ${expandedFinancialId === 'PROJECT_TOTAL' ? 'border-blue-200 shadow-md' : 'border-slate-200 shadow-sm'}`}>
                                                <div
                                                    className="p-6 cursor-pointer flex justify-between items-center"
                                                    onClick={() => setExpandedFinancialId(expandedFinancialId === 'PROJECT_TOTAL' ? null : 'PROJECT_TOTAL')}
                                                >
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                                                            Mission Financials & Pricing
                                                        </h3>
                                                        <p className="text-sm text-slate-500">{selectedDeployment.title} — {selectedDeployment.siteName}</p>
                                                        <p className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="flex items-end gap-6">
                                                        <div className="text-right">
                                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Project Gross</p>
                                                            <p className="text-2xl font-bold text-slate-900">${getTotalCost(selectedDeployment).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Payment Terms</label>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="180"
                                                                    value={deploymentPaymentTerms}
                                                                    onChange={e => setDeploymentPaymentTerms(parseInt(e.target.value) || 30)}
                                                                    className="w-20 px-3 py-1.5 border border-slate-200 rounded text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                                />
                                                                <span className="text-xs text-slate-500">days</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 no-print" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => navigate(`/invoices/master/${selectedDeployment.id}`)}
                                                                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 hover:text-blue-600 transition-colors flex items-center gap-2"
                                                                title="Create Master Invoice for Coatzadrone"
                                                            >
                                                                <FileText className="w-4 h-4" /> Master Inv.
                                                            </button>
                                                            <button
                                                                onClick={handlePrintReport}
                                                                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 transition-colors flex items-center gap-2"
                                                            >
                                                                <Printer className="w-4 h-4" /> Print
                                                            </button>
                                                            <div className="flex items-center gap-2 mr-2">
                                                                <input
                                                                    type="checkbox"
                                                                    id="sendToPilots"
                                                                    checked={sendToPilots}
                                                                    onChange={e => setSendToPilots(e.target.checked)}
                                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <label htmlFor="sendToPilots" className="text-xs text-slate-600 cursor-pointer select-none">
                                                                    Notify Pilots
                                                                </label>
                                                            </div>
                                                            <button
                                                                onClick={() => handleEmailInvoices()}
                                                                className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 transition-colors flex items-center gap-2"
                                                            >
                                                                <Send className="w-4 h-4" />
                                                                {selectedPersonnelForInvoice.size > 0
                                                                    ? `Email Selected (${selectedPersonnelForInvoice.size})`
                                                                    : 'Email All'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Project Accordion Details */}
                                                {expandedFinancialId === 'PROJECT_TOTAL' && (
                                                    <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 border-t border-slate-100 pt-4">
                                                        <ProjectInvoiceView
                                                            deployment={selectedDeployment}
                                                            logs={selectedDeployment.dailyLogs || []}
                                                            personnel={personnel}
                                                            paymentTerms={deploymentPaymentTerms}
                                                        />
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
                                                                        <div onClick={(e) => e.stopPropagation()}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedPersonnelForInvoice.has(techId)}
                                                                                onChange={() => togglePersonnelSelection(techId)}
                                                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                                                            />
                                                                        </div>
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
                                                                                handleGenerateInvoice(techId, true);
                                                                            }}
                                                                            className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded hover:bg-amber-100 transition-colors shadow-sm z-10"
                                                                            title="Edit Invoice Directly"
                                                                        >
                                                                            <Edit2 className="w-3 h-3" /> Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleGenerateInvoice(techId);
                                                                            }}
                                                                            className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm z-10"
                                                                            title="Generate Link"
                                                                        >
                                                                            <LinkIcon className="w-3 h-3" /> Link
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEmailInvoices([techId]);
                                                                            }}
                                                                            className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 transition-colors shadow-sm z-10"
                                                                            title="Email Invoice"
                                                                        >
                                                                            <Mail className="w-3 h-3" /> Email
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
                                    </>
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
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="text-[10px] text-slate-500 font-bold uppercase">{p.role}</p>
                                                                            {calculateDistance(p.homeAddress, selectedDeployment.location) && (
                                                                                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 rounded border border-blue-100">
                                                                                    {calculateDistance(p.homeAddress, selectedDeployment.location)} mi
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleNotifyAssignment(techId, 'CREW', p.fullName)}
                                                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Send Mission Invitation"
                                                                >
                                                                    <Plane className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleEmailInvoices([techId])}
                                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Email Invoice"
                                                                >
                                                                    <Send className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnassignPersonnel(techId)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Unassign Personnel"
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
                                                            .filter(p => (p.status === 'Active' || p.status === 'Inactive' || p.status === 'On Leave') && !(selectedDeployment.technicianIds || []).includes(p.id))
                                                            .map(p => {
                                                                const dist = selectedDeployment.location ? calculateDistance(p.homeAddress, selectedDeployment.location) : null;
                                                                return (
                                                                    <option key={p.id} value={p.id}>
                                                                        {p.fullName} ({p.role}) {dist ? `- ${dist} mi` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Client Stakeholders */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                        <Briefcase className="w-4 h-4 text-purple-600" />
                                                        Client Stakeholders
                                                    </h4>
                                                    {selectedDeployment.clientName && (
                                                        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100">
                                                            {selectedDeployment.clientName}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    {(selectedDeployment.monitoringTeam || []).filter(u => u.missionRole === 'Client' || u.missionRole === 'Site Contact' || u.role === 'client_user').map(u => (
                                                        <div key={u.id} className={`flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm ${u.missionRole === 'Site Contact' ? 'border-purple-300 bg-purple-50/30' : 'border-purple-100 shadow-purple-50/50'}`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.missionRole === 'Site Contact' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600'}`}>
                                                                    {u.fullName.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-medium text-slate-900">{u.fullName}</p>
                                                                        {u.missionRole === 'Site Contact' && (
                                                                            <span className="text-[10px] font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                                                Site Contact
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] text-purple-600 font-bold uppercase">{u.companyName || 'Client User'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newRole = u.missionRole === 'Site Contact' ? 'Client' : 'Site Contact';
                                                                        handleAssignMonitor(u.id, newRole);
                                                                    }}
                                                                    className={`p-1.5 rounded transition-colors ${u.missionRole === 'Site Contact' ? 'text-purple-600 bg-purple-100 hover:bg-purple-200' : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'}`}
                                                                    title={u.missionRole === 'Site Contact' ? "Remove Site Contact Status" : "Make Site Contact"}
                                                                    type="button"
                                                                >
                                                                    <UserCheck className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleNotifyAssignment(u.id, 'CLIENT', u.fullName);
                                                                    }}
                                                                    className="p-1.5 text-purple-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Notify Client"
                                                                    type="button"
                                                                >
                                                                    <Mail className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUnassignMonitor(u.id);
                                                                    }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Unassign"
                                                                    type="button"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(selectedDeployment.monitoringTeam || []).filter(u => u.missionRole === 'Client' || u.missionRole === 'Site Contact' || u.role === 'client_user').length === 0 && (
                                                        <p className="text-xs text-slate-400 italic bg-white p-4 rounded-lg border border-dashed text-center">No client stakeholders assigned.</p>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    <select
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 outline-none"
                                                        onChange={(e) => {
                                                            if (e.target.value === 'NEW_STAKEHOLDER') {
                                                                setIsStakeholderFormOpen(true);
                                                                // Reset selection
                                                                e.target.value = "";
                                                                return;
                                                            }
                                                            if (e.target.value) handleAssignMonitor(e.target.value, 'Client');
                                                            e.target.value = "";
                                                        }}
                                                    >
                                                        <option value="">+ Assign Client Stakeholder</option>
                                                        {clientStakeholders
                                                            .filter(s => !(selectedDeployment.monitoringTeam || []).some(m => m.id === s.user_id))
                                                            .map(s => (
                                                                <option key={s.id} value={s.user_id || ''} disabled={!s.user_id}>
                                                                    {s.full_name} ({s.title || 'Stakeholder'}) {!s.user_id ? '(No User Account)' : ''}
                                                                </option>
                                                            ))}
                                                        {clientStakeholders.length === 0 && selectedDeployment.clientId && (
                                                            <option disabled>No stakeholders found for this client</option>
                                                        )}
                                                        <option value="NEW_STAKEHOLDER">+ Add New Stakeholder</option>
                                                        {!selectedDeployment.clientId && (
                                                            <option disabled>Mission must be linked to a client first</option>
                                                        )}
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
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleNotifyAssignment(u.id, 'MONITOR', u.fullName)}
                                                                    className="p-1.5 text-emerald-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Notify Monitor of Assignment"
                                                                >
                                                                    <Mail className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnassignMonitor(u.id)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Unassign Monitor"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            </div>
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
                                ) : activeModalTab === 'ai-reports' ? (
                                    <div className="h-full overflow-y-auto">
                                        <IndustryReportsHub
                                            missionId={selectedDeployment.id}
                                            missionTitle={selectedDeployment.title}
                                        />
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
                    </div>
                )
            }

            {/* Add Mission Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <Plane className="w-4 h-4" /> {editingDeploymentId ? 'Edit Mission Details' : 'Schedule New Mission'}
                                </h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    &times;
                                </button>
                            </div>
                            <div className="p-6 space-y-4 overflow-y-auto text-slate-900">
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

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Country (Optional)</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                        value={newDeployment.countryId || ''}
                                        onChange={e => setNewDeployment({ ...newDeployment, countryId: e.target.value })}
                                    >
                                        <option value="">No specific country (Default)</option>
                                        {Array.isArray(countries) && countries.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400">Selecting a country may apply specific regulation checks (e.g. Mexico)</p>
                                </div>

                                {/* Client Selector */}
                                <div className="space-y-4 col-span-2">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium text-slate-700">Client</label>
                                            <button
                                                onClick={(e) => { e.preventDefault(); setIsClientFormOpen(true); }}
                                                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                            >
                                                + New Client
                                            </button>
                                        </div>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none"
                                            value={newDeployment.clientId || ''}
                                            onChange={(e) => {
                                                const clientId = e.target.value;
                                                setNewDeployment({ ...newDeployment, clientId, siteId: '' }); // Reset site when client changes
                                                fetchSites(clientId);
                                            }}
                                        >
                                            <option value="">Select Client (Optional)</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Site Name / Selection */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Site / Project</label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                value={newDeployment.siteId || ''}
                                                onChange={(e) => {
                                                    const site = sites.find(s => s.id === e.target.value);
                                                    setNewDeployment({
                                                        ...newDeployment,
                                                        siteId: e.target.value,
                                                        siteName: site?.name || '',
                                                        clientId: site?.client_id || newDeployment.clientId // Auto-select client if site has one
                                                    });
                                                }}
                                            >
                                                <option value="">Select Existing Site...</option>
                                                {sites.map(site => (
                                                    <option key={site.id} value={site.id}>
                                                        {site.name} {site.location ? `(${site.location})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Or enter manual site name..."
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm mt-2"
                                            value={newDeployment.siteName || ''}
                                            onChange={(e) => setNewDeployment({ ...newDeployment, siteName: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target Date</label>
                                            <input
                                                type="date"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                                value={newDeployment.date}
                                                onChange={e => setNewDeployment({ ...newDeployment, date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                                value={newDeployment.location || ''}
                                                onChange={e => setNewDeployment({ ...newDeployment, location: e.target.value })}
                                                placeholder="City, State"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
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
                                    {editingDeploymentId ? 'Save Changes' : 'Confirm Schedule'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Client Creation Modal */}
            {
                isClientFormOpen && (
                    <ClientForm
                        onClose={() => setIsClientFormOpen(false)}
                        onSuccess={async (newClient: any) => {
                            await fetchClients();
                            setIsClientFormOpen(false);
                            if (newClient && newClient.id) {
                                setSelectedClientForNewMission(newClient.id);
                                setNewDeployment(prev => ({ ...prev, siteId: undefined, siteName: '' }));
                                fetchSites(newClient.id);
                            }
                        }}
                    />
                )
            }

            {/* Stakeholder Creation Modal */}
            {
                isStakeholderFormOpen && selectedDeployment && selectedDeployment.clientId && (
                    <StakeholderForm
                        clientId={selectedDeployment.clientId}
                        onClose={() => setIsStakeholderFormOpen(false)}
                        onSuccess={async () => {
                            await fetchClientStakeholders(selectedDeployment.clientId!);
                            setIsStakeholderFormOpen(false);
                        }}
                    />
                )
            }
        </div >
    );
};

export default DeploymentTracker;
