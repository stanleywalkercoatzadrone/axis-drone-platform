import React, { useState, useEffect, useRef } from 'react';
import PilotSchedule from './PilotSchedule';
import { BadgeCheck, HardHat, Mail, Phone, Search, UserPlus, Filter, MoreHorizontal, FileText, DollarSign, Map, Send, CheckCircle2, ShieldCheck, MapPin, Upload, Package, X, Loader2, Download, Trash2, Plus, Zap, Eye, Pencil, User2, Briefcase, Building2 } from 'lucide-react';
import { Personnel, PersonnelRole, BankingInfo, Country } from '../types';
import apiClient from '../services/apiClient';
import { MAJOR_US_BANKS } from '../src/utils/bankData';
import { Button } from '../src/stitch/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../src/stitch/components/Card';
import { Input } from '../src/stitch/components/Input';
import { Badge } from '../src/stitch/components/Badge';
import { Heading, Text } from '../src/stitch/components/Typography';

import { useIndustry } from '../context/IndustryContext';
import { useCountry } from '../context/CountryContext';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AxisPerformanceTab } from '../src/components/personnel/AxisPerformanceTab';
import { PilotDocumentsPanel } from './PilotDocumentsPanel';
import L from 'leaflet';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// ── Semantic badge helpers ──────────────────────────────────────────────────
function roleBadge(role: string) {
    switch ((role || '').toLowerCase()) {
        case 'pilot':       return 'bg-blue-500/15 text-blue-300 border border-blue-500/25';
        case 'technician':  return 'bg-violet-500/15 text-violet-300 border border-violet-500/25';
        case 'both':        return 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25';
        default:            return 'bg-white/8 text-slate-300 border border-white/10';
    }
}
function statusBadge(status: string) {
    switch ((status || '').toLowerCase()) {
        case 'active':    return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25';
        case 'inactive':  return 'bg-white/8 text-slate-400 border border-white/10';
        case 'on leave':  return 'bg-amber-500/15 text-amber-300 border border-amber-500/25';
        default:          return 'bg-white/8 text-slate-400 border border-white/10';
    }
}
function complianceBadgeClass(person: Personnel) {
    const docs = person.documents || [];
    const missing = ['Part 107 Certificate', 'Government ID', 'W-9 Tax Form'].filter(
        req => !docs.some((d: any) => d.document_type === req)
    );
    if (missing.length === 0) return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25';
    if (missing.length <= 1)  return 'bg-amber-500/15 text-amber-300 border border-amber-500/25';
    return 'bg-rose-500/15 text-rose-300 border border-rose-500/25';
}
function complianceLabel(person: Personnel) {
    const docs = person.documents || [];
    const missing = ['Part 107 Certificate', 'Government ID', 'W-9 Tax Form'].filter(
        req => !docs.some((d: any) => d.document_type === req)
    );
    if (missing.length === 0) return 'Complete';
    if (missing.length <= 1)  return 'Partial';
    return 'Pending Docs';
}
function onboardingPct(status?: string) {
    switch (status) {
        case 'completed':    return 100;
        case 'in_progress':  return 60;
        case 'sent':         return 25;
        default:             return 5;
    }
}


const PersonnelTracker: React.FC = () => {

    const { tLabel } = useIndustry();
    const { activeCountryId, countries: enabledCountries } = useCountry();
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('pt_searchQuery') || '');
    const [roleFilter, setRoleFilter] = useState<'All' | PersonnelRole>(() => (sessionStorage.getItem('pt_roleFilter') as any) || 'All');

    // Persistence Effects
    useEffect(() => { sessionStorage.setItem('pt_searchQuery', searchQuery); }, [searchQuery]);
    useEffect(() => { sessionStorage.setItem('pt_roleFilter', roleFilter); }, [roleFilter]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedPerson, setEditedPerson] = useState<Personnel | null>(null);
    const [newPersonnel, setNewPersonnel] = useState<Partial<Personnel>>({
        role: PersonnelRole.PILOT,
        status: 'Active',
        certificationLevel: 'Part 107',
        dailyPayRate: 0,
        maxTravelDistance: 0,
        homeAddress: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
        countryId: activeCountryId || undefined,
        emergencyContactName: '',
        emergencyContactPhone: '',
        taxClassification: 'Individual/Sole Proprietor',
        accountType: 'Checking'
    });
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [addFile, setAddFile] = useState<File | null>(null);
    const [sendingOnboarding, setSendingOnboarding] = useState(false);

    const [onboardingPromptOpen, setOnboardingPromptOpen] = useState<{ isOpen: boolean; personnelId?: string; name?: string; email?: string; }>({ isOpen: false });
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    // Pre-Onboarding Document Sender State
    const [isSendDocsModalOpen, setIsSendDocsModalOpen] = useState(false);
    const [sendDocsEmail, setSendDocsEmail] = useState('');
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
    const [sendingDocs, setSendingDocs] = useState(false);

    // Banking State
    const [modalTab, setModalTab] = useState<'details' | 'banking' | 'documents' | 'performance' | 'schedule'>('details');
    const [bankingInfo, setBankingInfo] = useState<BankingInfo | null>(null);
    const [editedBankingInfo, setEditedBankingInfo] = useState<Partial<BankingInfo>>({});
    const [loadingBanking, setLoadingBanking] = useState(false);

    // Document State
    const [analyzingDoc, setAnalyzingDoc] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docExpiration, setDocExpiration] = useState(''); // New state
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [viewingDoc, setViewingDoc] = useState<any | null>(null);
    const [viewingDocBlobUrl, setViewingDocBlobUrl] = useState<string | null>(null);
    const [loadingView, setLoadingView] = useState(false);
    const [documentSearch, setDocumentSearch] = useState('');
    const [loadingDocuments, setLoadingDocuments] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addFileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Fetch personnel on mount
    useEffect(() => {
        fetchPersonnel();
    }, []);

    const fetchPersonnel = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/personnel');
            setPersonnel(response.data.data || []);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching personnel:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOnboarding = async (id: string, email: string) => {
        try {
            const res = await apiClient.post('/candidates/send', { candidate_email: email, payload: { personnelId: id } });
            if (res.data.success) {
                alert(`Onboarding package sent to ${email}!\n\nMagic Link (Admin Copy):\n${res.data.data.magicLink}`);
                setPersonnel(prev => prev.map(p => p.id === id ? { ...p, onboarding_status: 'sent' } : p));
                if (selectedPerson?.id === id) {
                    setSelectedPerson(prev => prev ? { ...prev, onboarding_status: 'sent' } : null);
                }
            }
        } catch (error: any) {
            console.error('Failed to send onboarding:', error);
            alert(error.response?.data?.message || 'Failed to send onboarding package');
        }
    };

    const handleProvisionAccount = async (id: string, email: string) => {
        try {
            const res = await apiClient.post(`/personnel/${id}/provision`);
            if (res.data.success) {
                alert(`Account provisioned successfully for ${email}!\n\nPilot Login Link (Admin Copy):\n${res.data.data.invitationUrl}`);
            }
        } catch (error: any) {
            console.error('Failed to provision account:', error);
            alert(error.response?.data?.message || 'Failed to provision pilot account');
        }
    };

    const handleSendDocs = async () => {
        if (!sendDocsEmail) {
            alert('Please enter an email address.');
            return;
        }
        if (selectedDocs.length === 0) {
            alert('Please select at least one document to send.');
            return;
        }

        try {
            setSendingDocs(true);
            const res = await apiClient.post('/candidates/send-docs', {
                candidate_email: sendDocsEmail,
                documents: selectedDocs
            });

            if (res.data.success) {
                alert(`Documents successfully sent to ${sendDocsEmail}!`);
                setIsSendDocsModalOpen(false);
                setSendDocsEmail('');
                setSelectedDocs([]);
            }
        } catch (error: any) {
            console.error('Failed to send documents:', error);
            alert(error.response?.data?.message || 'Failed to send documents');
        } finally {
            setSendingDocs(false);
        }
    };

    const getComplianceBadge = (person: Personnel) => {
        const status = (person as any).complianceStatus || 'pending';
        switch (status) {
            case 'compliant': return <Badge variant="success" className="bg-green-100 text-green-700 border-green-200">Compliant</Badge>;
            case 'expired': return <Badge className="bg-red-100 text-red-700 border-red-200">Expired</Badge>;
            case 'expiring_soon': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Expiring Soon</Badge>;
            default: return <Badge variant="outline" className="text-slate-400">Pending Docs</Badge>;
        }
    };

    const handleInitializeWithAI = async () => {
        if (!addFile) {
            alert("Please select a document first.");
            return;
        }

        try {
            setAnalyzingDoc(true);
            const formData = new FormData();
            formData.append('file', addFile);
            const aiRes = await apiClient.post('/personnel/analyze-document', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (aiRes.data.success && aiRes.data.data) {
                const aiData = aiRes.data.data;
                console.log('AI Extraction successful:', aiData);

                // Update Name
                if (aiData.name) {
                    const nameParts = aiData.name.trim().split(' ');
                    if (nameParts.length >= 2) {
                        setFirstName(nameParts[0]);
                        setLastName(nameParts.slice(1).join(' '));
                    } else {
                        setFirstName(aiData.name);
                    }
                }

                // Update other fields in newPersonnel state
                setNewPersonnel(prev => ({
                    ...prev,
                    bankName: aiData.bankName || prev.bankName,
                    routingNumber: aiData.routingNumber || prev.routingNumber,
                    accountNumber: aiData.accountNumber || prev.accountNumber,
                    swiftCode: aiData.swiftCode || prev.swiftCode,
                    taxClassification: aiData.taxClassification || prev.taxClassification,
                    companyName: aiData.businessName || aiData.companyName || prev.companyName,
                    email: aiData.email || prev.email,
                    phone: aiData.phone || prev.phone,
                    homeAddress: aiData.homeAddress || aiData.fullAddress || prev.homeAddress,
                    city: aiData.city || prev.city,
                    state: aiData.state || prev.state,
                    zipCode: aiData.zipCode || prev.zipCode,
                    country: aiData.country || prev.country || 'US',
                    certificationLevel: aiData.licenseNumber ? 'Part 107' : prev.certificationLevel
                }));
            }
        } catch (err: any) {
            console.error('AI Extraction failed:', err);
            alert("AI extraction failed. Please enter details manually.");
        } finally {
            setAnalyzingDoc(false);
        }
    };

    const handleAddPersonnel = async () => {
        if (!firstName || !lastName || !newPersonnel.email) {
            alert("Please provide the required details (Name and Email).");
            return;
        }

        setLoading(true);
        try {
            const fullName = `${firstName} ${lastName}`;
            const response = await apiClient.post('/personnel', {
                fullName,
                ...newPersonnel
            });

            const data = response.data;
            const newId = data.data.id;

            // If a file was used for initialization, also upload it as a permanent document
            if (addFile) {
                try {
                    const formData = new FormData();
                    formData.append('file', addFile);
                    formData.append('documentType', 'License');
                    await apiClient.post(`/personnel/${newId}/documents`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                } catch (docErr) {
                    console.error('Error uploading initial document:', docErr);
                }
            }

            setPersonnel([...personnel, data.data]);
            setIsAddModalOpen(false);
            setNewPersonnel({
                role: PersonnelRole.PILOT,
                status: 'Active',
                certificationLevel: 'Part 107',
                dailyPayRate: 0,
                maxTravelDistance: 0,
                homeAddress: '',
                companyName: '',
                phone: ''
            });
            setFirstName('');
            setLastName('');
            setAddFile(null);

            setOnboardingPromptOpen({
                isOpen: true,
                personnelId: data.data.id,
                name: data.data.fullName,
                email: newPersonnel.email
            });

        } catch (err: any) {
            console.error('Error creating personnel:', err);
            alert(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRoutingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const routing = e.target.value;
        const bank = MAJOR_US_BANKS.find(b => b.routingNumber === routing);
        setNewPersonnel(prev => ({
            ...prev,
            routingNumber: routing,
            bankName: bank ? bank.name : prev.bankName,
            swiftCode: bank ? (bank as any).swiftCode : prev.swiftCode
        }));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAddFile(file);
    };

    const handleDeletePersonnel = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await apiClient.delete(`/personnel/${id}`);
            setPersonnel(personnel.filter(p => p.id !== id));
            if (selectedPerson?.id === id) setIsDetailModalOpen(false);
        } catch (err: any) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleViewDetails = (person: Personnel) => {
        setSelectedPerson(person);
        setEditedPerson(person);
        setIsEditMode(false);
        setModalTab('details');
        setIsDetailModalOpen(true);
        fetchDocuments(person.id);
    };

    const fetchDocuments = async (pilotId: string) => {
        try {
            setLoadingDocuments(true);
            const response = await apiClient.get(`/personnel/${pilotId}/documents`);
            if (response.data.success) {
                setDocuments(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoadingDocuments(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedPerson) return;
        setUploadingPhoto(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post(`/personnel/${selectedPerson.id}/photo`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setSelectedPerson(res.data.data);
                setPersonnel(prev => prev.map(p => p.id === selectedPerson.id ? res.data.data : p));
            }
        } catch (error) {
            alert('Photo upload failed');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const fetchBankingInfo = async (pilotId: string) => {
        try {
            setLoadingBanking(true);
            const response = await apiClient.get(`/personnel/${pilotId}/banking`);
            if (response.data.success && response.data.data) {
                setBankingInfo(response.data.data);
                setEditedBankingInfo(response.data.data);
            } else {
                setBankingInfo(null);
                setEditedBankingInfo({ pilotId, currency: 'USD', countryId: 'US', accountType: 'Checking', swiftCode: '' });
            }
        } catch (error) {
            console.error('Error fetching banking:', error);
        } finally {
            setLoadingBanking(false);
        }
    };

    const handleSaveBankingInfo = async () => {
        if (!selectedPerson) return;
        try {
            const response = await apiClient.put(`/personnel/${selectedPerson.id}/banking`, editedBankingInfo);
            if (response.data.success) {
                setBankingInfo(response.data.data);
                setIsEditMode(false);
                alert('Banking info saved.');
            }
        } catch (error: any) {
            alert(error.response?.data?.message || error.message);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedPerson) return;

        setUploadingDoc(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pilotId', selectedPerson.id);
        formData.append('countryId', selectedPerson.country === 'US' ? 'US' : 'CA'); // Simple default logic
        if (docExpiration) formData.append('expirationDate', docExpiration);

        try {
            const res = await apiClient.post(`/personnel/${selectedPerson.id}/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setDocuments(prev => [res.data.document || res.data.data, ...prev]);

                // Update Personnel & Banking state immediately
                if (res.data.updatedPersonnel) {
                    setSelectedPerson(res.data.updatedPersonnel);
                    setEditedPerson(res.data.updatedPersonnel);
                    setPersonnel(prev => prev.map(p => p.id === selectedPerson.id ? res.data.updatedPersonnel : p));
                }
                if (res.data.updatedBanking) {
                    setBankingInfo(res.data.updatedBanking);
                    setEditedBankingInfo(res.data.updatedBanking);
                }

                setDocExpiration(''); // Reset expiration
                alert('Document uploaded and details auto-populated!');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload document.');
        } finally {
            setUploadingDoc(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (!selectedPerson) return;
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            const res = await apiClient.delete(`/personnel/${selectedPerson.id}/documents/${docId}`);
            if (res.data.success) {
                setDocuments(prev => prev.filter(d => d.id !== docId));
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete document.');
        }
    };

    const handleViewDocument = async (doc: any) => {
        if (!selectedPerson) return;
        setViewingDoc(doc);
        setLoadingView(true);
        try {
            const response = await apiClient.get(`/personnel/${selectedPerson.id}/documents/${doc.id}/view`, {
                responseType: 'blob'
            });
            const blobUrl = URL.createObjectURL(response.data);
            setViewingDocBlobUrl(blobUrl);
        } catch (error) {
            console.error('Error fetching document view:', error);
            alert('Failed to load document preview.');
            handleCloseViewer();
        } finally {
            setLoadingView(false);
        }
    };

    const handleCloseViewer = () => {
        setViewingDoc(null);
        if (viewingDocBlobUrl) {
            URL.revokeObjectURL(viewingDocBlobUrl);
            setViewingDocBlobUrl(null);
        }
    };

    const handleUpdatePersonnel = async () => {
        if (!editedPerson || !selectedPerson) return;
        try {
            // Include banking fields even in profile update if they exist
            const updatePayload = {
                ...editedPerson,
                // Ensure banking fields are passed if they were edited in the profile tab
                bankName: editedPerson.bankName,
                routingNumber: editedPerson.routingNumber,
                accountNumber: editedPerson.accountNumber,
                accountType: editedPerson.accountType,
                swiftCode: editedPerson.swiftCode
            };
            const response = await apiClient.put(`/personnel/${selectedPerson.id}`, updatePayload);
            setPersonnel(personnel.map(p => p.id === selectedPerson.id ? response.data.data : p));
            setSelectedPerson(response.data.data);
            setIsEditMode(false);
        } catch (err: any) {
            alert(err.response?.data?.message || err.message);
        }
    };

    const handleCancelEdit = () => {
        setEditedPerson(selectedPerson);
        setIsEditMode(false);
    };

    useEffect(() => {
        if (isDetailModalOpen && selectedPerson && modalTab === 'banking') {
            fetchBankingInfo(selectedPerson.id);
        }
    }, [isDetailModalOpen, selectedPerson, modalTab]);

    const filteredPersonnel = personnel.filter(p => {
        const matchesSearch = p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || p.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'All' || p.role === roleFilter || p.role === PersonnelRole.BOTH;
        // Country scope: if an active country is selected, only show pilots assigned to that country
        const matchesCountry = !activeCountryId || (p as any).countryId === activeCountryId;
        return matchesSearch && matchesRole && matchesCountry;
    });

    return (
        <div className="min-h-screen bg-transparent text-white">
            <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">

                {/* ── Page header ─────────────────────────────────────────── */}
                <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg backdrop-blur-sm">
                    <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-1">
                            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                Pilot / Technicians
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight text-white lg:text-3xl">Personnel Management</h1>
                            <p className="text-sm text-slate-400">Manage pilots, technicians, onboarding, provisioning, and compliance.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setIsSendDocsModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                            >
                                <Send className="h-4 w-4" /> Send Docs
                            </button>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
                            >
                                <Plus className="h-4 w-4" /> Add Personnel
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Filters + stats bar ──────────────────────────────────── */}
                <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg backdrop-blur-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="relative w-full max-w-sm">
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search name, email..."
                                    className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['All', PersonnelRole.PILOT, PersonnelRole.TECHNICIAN, PersonnelRole.BOTH] as string[]).map(role => (
                                    <button
                                        key={role}
                                        onClick={() => setRoleFilter(role as any)}
                                        className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                                            roleFilter === role
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                                {/* Map toggle */}
                                <div className="ml-2 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-0.5">
                                    {(['list', 'map'] as const).map(m => (
                                        <button key={m} onClick={() => setViewMode(m)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition ${
                                                viewMode === m ? 'bg-slate-700 shadow text-white' : 'text-slate-500 hover:text-slate-300'
                                            }`}>{m}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Stat chips */}
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: 'Total',   value: personnel.length },
                                { label: 'Active',  value: personnel.filter(p => (p.status || '').toLowerCase() === 'active').length },
                                { label: 'Pending', value: personnel.filter(p => complianceLabel(p) === 'Pending Docs').length },
                                { label: 'On Leave',value: personnel.filter(p => (p.status || '').toLowerCase() === 'on leave').length },
                            ].map(stat => (
                                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</div>
                                    <div className="mt-0.5 text-lg font-bold text-white">{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Main split grid ──────────────────────────────────────── */}
                <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">

                    {/* Left — table */}
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg backdrop-blur-sm">
                        <div className="border-b border-white/10 px-6 py-4">
                            <h2 className="text-base font-semibold text-white">Team Directory</h2>
                            <p className="mt-0.5 text-xs text-slate-400">Click a row to preview. Click Open for the full profile.</p>
                        </div>

                        {viewMode === 'list' ? (
                            <div className="overflow-x-auto">
                                {loading && (
                                    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span className="text-sm">Loading personnel...</span>
                                    </div>
                                )}
                                {!loading && error && (
                                    <div className="flex items-center justify-center gap-2 py-16 text-rose-400 text-sm">
                                        ⚠️ {error}
                                    </div>
                                )}
                                {!loading && !error && filteredPersonnel.length === 0 && (
                                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
                                        <span className="text-3xl">👥</span>
                                        <span className="text-sm font-medium">No personnel found</span>
                                        <span className="text-xs opacity-70">{searchQuery ? 'Try a different search' : 'Add your first personnel'}</span>
                                    </div>
                                )}
                                {!loading && filteredPersonnel.length > 0 && (
                                    <table className="min-w-full text-left">
                                        <thead className="sticky top-0 z-10 bg-slate-950/60 backdrop-blur-sm">
                                            <tr className="border-b border-white/10">
                                                <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Name</th>
                                                <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Role</th>
                                                <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Status</th>
                                                <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Compliance</th>
                                                <th className="px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Open</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredPersonnel.map(person => {
                                                const isSelected = selectedPerson?.id === person.id;
                                                return (
                                                    <tr
                                                        key={person.id}
                                                        onClick={() => setSelectedPerson(person)}
                                                        className={`cursor-pointer transition ${
                                                            isSelected ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-white/5'
                                                        }`}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sm font-semibold text-white shadow-sm overflow-hidden">
                                                                    {person.photoUrl
                                                                        ? <img src={person.photoUrl} className="w-full h-full object-cover" />
                                                                        : (person.fullName?.[0] ?? '?')}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-semibold text-white">{person.fullName}</div>
                                                                    <div className="text-xs text-slate-400">{person.email || 'No email'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge(person.role)}`}>
                                                                {person.role}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(person.status)}`}>
                                                                {person.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${complianceBadgeClass(person)}`}>
                                                                {complianceLabel(person)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <button
                                                                className="rounded-lg border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 transition"
                                                                onClick={e => { e.stopPropagation(); handleViewDetails(person); }}
                                                            >
                                                                Open
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        ) : (
                            <div className="h-[600px] w-full">
                                <MapContainer center={[39.8283, -98.5795]} zoom={4} style={{ height: '100%', width: '100%' }}>
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                    />
                                    {filteredPersonnel.filter(p => p.latitude && p.longitude).map(person => (
                                        <React.Fragment key={person.id}>
                                            <Marker position={[person.latitude!, person.longitude!]}>
                                                <Popup>
                                                    <div className="text-center">
                                                        <div className="font-bold">{person.fullName}</div>
                                                        <div className="text-xs text-zinc-500">{person.role}</div>
                                                        <div className="text-xs mt-1">Travel: {person.maxTravelDistance || 0} mi</div>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                            {person.maxTravelDistance && person.maxTravelDistance > 0 && (
                                                <Circle
                                                    center={[person.latitude!, person.longitude!]}
                                                    pathOptions={{ fillColor: 'blue', color: 'blue', opacity: 0.2, fillOpacity: 0.1 }}
                                                    radius={person.maxTravelDistance * 1609.34}
                                                />
                                            )}
                                        </React.Fragment>
                                    ))}
                                </MapContainer>
                            </div>
                        )}
                    </div>

                    {/* Right — preview panel */}
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg backdrop-blur-sm">
                        {selectedPerson ? (
                            <>
                                {/* Preview header */}
                                <div className="border-b border-white/10 px-6 py-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-700 text-lg font-semibold text-white shadow-sm overflow-hidden">
                                            {selectedPerson.photoUrl
                                                ? <img src={selectedPerson.photoUrl} className="w-full h-full object-cover" />
                                                : selectedPerson.fullName?.[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-semibold text-white truncate">{selectedPerson.fullName}</h2>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${roleBadge(selectedPerson.role)}`}>{selectedPerson.role}</span>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(selectedPerson.status)}`}>{selectedPerson.status}</span>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${complianceBadgeClass(selectedPerson)}`}>{complianceLabel(selectedPerson)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick actions */}
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        {selectedPerson.onboarding_status !== 'completed' && (
                                            <button
                                                onClick={() => handleSendOnboarding(selectedPerson.id, selectedPerson.email)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-blue-500 transition whitespace-nowrap"
                                            >
                                                <Send className="h-3.5 w-3.5" /> Send Onboarding
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleProvisionAccount(selectedPerson.id, selectedPerson.email)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition whitespace-nowrap"
                                        >
                                            <ShieldCheck className="h-3.5 w-3.5" /> Provision Account
                                        </button>
                                    </div>

                                    {/* Onboarding progress */}
                                    {selectedPerson.onboarding_status !== 'completed' && (
                                        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                                            <div className="mb-1.5 flex items-center justify-between">
                                                <span className="text-xs font-medium text-slate-400">Onboarding Progress</span>
                                                <span className="text-xs font-bold text-white">{onboardingPct(selectedPerson.onboarding_status)}%</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                                                <div
                                                    className="h-full rounded-full bg-blue-500 transition-all"
                                                    style={{ width: `${onboardingPct(selectedPerson.onboarding_status)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Detail sections */}
                                <div className="space-y-3 px-6 py-5">
                                    {[
                                        {
                                            icon: <User2 className="h-3.5 w-3.5 text-slate-500" />,
                                            title: 'Contact',
                                            rows: [
                                                <><Mail className="h-3.5 w-3.5 text-slate-500" /><span>{selectedPerson.email || 'N/A'}</span></>,
                                                <><Phone className="h-3.5 w-3.5 text-slate-500" /><span>{selectedPerson.phone || 'N/A'}</span></>,
                                            ]
                                        },
                                        {
                                            icon: <MapPin className="h-3.5 w-3.5 text-slate-500" />,
                                            title: 'Address',
                                            rows: [
                                                <span>{[selectedPerson.homeAddress, selectedPerson.city, selectedPerson.state, selectedPerson.zipCode, selectedPerson.country].filter(Boolean).join(', ') || 'N/A'}</span>
                                            ]
                                        },
                                        {
                                            icon: <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />,
                                            title: 'Emergency',
                                            rows: [
                                                <span>{selectedPerson.emergencyContactName || 'N/A'}</span>,
                                                ...(selectedPerson.emergencyContactPhone ? [<span>{selectedPerson.emergencyContactPhone}</span>] : [])
                                            ]
                                        },
                                        {
                                            icon: <Briefcase className="h-3.5 w-3.5 text-slate-500" />,
                                            title: 'Professional',
                                            rows: [
                                                <span>Max Travel: <strong className="text-white">{selectedPerson.maxTravelDistance ?? 0} mi</strong></span>,
                                                <span>Company: <strong className="text-white">{selectedPerson.companyName || 'N/A'}</strong></span>,
                                            ]
                                        },
                                    ].map(section => (
                                        <div key={section.title} className="rounded-xl border border-white/8 bg-white/4 p-3">
                                            <div className="mb-2 flex items-center gap-1.5">
                                                {section.icon}
                                                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{section.title}</span>
                                            </div>
                                            <div className="space-y-1">
                                                {section.rows.map((row, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm text-slate-300">{row}</div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
                                    <button
                                        onClick={() => handleViewDetails(selectedPerson)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
                                    >
                                        Open Full Profile
                                    </button>
                                    <button
                                        onClick={() => { handleViewDetails(selectedPerson); setIsEditMode(true); }}
                                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition"
                                    >
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeletePersonnel(selectedPerson.id)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex min-h-[500px] items-center justify-center px-8 text-center">
                                <div className="max-w-xs">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                                        <Building2 className="h-6 w-6 text-slate-500" />
                                    </div>
                                    <h3 className="text-base font-semibold text-white">Select a team member</h3>
                                    <p className="mt-1 text-sm text-slate-400">Click a row to preview profile, contact info, and quick actions.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <Card variant="glass" className="border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                        <CardHeader className="px-6 py-5 border-b border-slate-800 flex flex-row justify-between items-center bg-slate-900/50">
                            <CardTitle className="text-xl font-black text-white uppercase tracking-widest">Add New Personnel</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white"><X /></Button>
                        </CardHeader>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name" />
                                <Input label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name" />
                            </div>

                            {/* Contact */}
                            <div className="space-y-4 border-t pt-4">
                                <Heading level={4} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Contact Details</Heading>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Email" value={newPersonnel.email || ''} onChange={e => setNewPersonnel({ ...newPersonnel, email: e.target.value })} placeholder="email@example.com" />
                                    <Input label="Company Name (Optional)" value={newPersonnel.companyName || ''} onChange={e => setNewPersonnel({ ...newPersonnel, companyName: e.target.value })} placeholder="Company Name" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Phone Number" value={newPersonnel.phone || ''} onChange={e => setNewPersonnel({ ...newPersonnel, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
                                    <Input label="Secondary Phone" value={newPersonnel.secondaryPhone || ''} onChange={e => setNewPersonnel({ ...newPersonnel, secondaryPhone: e.target.value })} placeholder="Optional" />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-4 border-t pt-4">
                                <Heading level={4} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Address</Heading>
                                <Input label="Street Address" value={newPersonnel.homeAddress || ''} onChange={e => setNewPersonnel({ ...newPersonnel, homeAddress: e.target.value })} placeholder="123 Main St" />
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <Input label="City" value={newPersonnel.city || ''} onChange={e => setNewPersonnel({ ...newPersonnel, city: e.target.value })} />
                                    <Input label="State" value={newPersonnel.state || ''} onChange={e => setNewPersonnel({ ...newPersonnel, state: e.target.value })} />
                                    <Input label="Zip Code" value={newPersonnel.zipCode || ''} onChange={e => setNewPersonnel({ ...newPersonnel, zipCode: e.target.value })} />
                                    <Input label="Country Code" value={newPersonnel.country || 'US'} onChange={e => setNewPersonnel({ ...newPersonnel, country: e.target.value })} />
                                </div>
                                {/* Assigned Country (FK to countries table) */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Assigned Country</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={(newPersonnel as any).countryId || ''}
                                        onChange={e => setNewPersonnel({ ...newPersonnel, countryId: e.target.value || undefined } as any)}
                                    >
                                        <option value="">— No country assignment —</option>
                                        {enabledCountries.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.iso_code})</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400">This scopes the pilot to the selected country's dashboard view.</p>
                                </div>
                            </div>

                            {/* Emergency Contact */}
                            <div className="space-y-4 border-t pt-4">
                                <Heading level={4} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Emergency Contact</Heading>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Contact Name" value={newPersonnel.emergencyContactName || ''} onChange={e => setNewPersonnel({ ...newPersonnel, emergencyContactName: e.target.value })} />
                                    <Input label="Contact Phone" value={newPersonnel.emergencyContactPhone || ''} onChange={e => setNewPersonnel({ ...newPersonnel, emergencyContactPhone: e.target.value })} />
                                </div>
                            </div>

                            {/* Professional */}
                            <div className="space-y-4 border-t pt-4">
                                <Heading level={4} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Professional</Heading>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Role</label>
                                        <select
                                            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            value={newPersonnel.role}
                                            onChange={e => setNewPersonnel({ ...newPersonnel, role: e.target.value as any })}
                                        >
                                            <option value={PersonnelRole.PILOT}>Pilot</option>
                                            <option value={PersonnelRole.TECHNICIAN}>Technician</option>
                                            <option value={PersonnelRole.BOTH}>Both</option>
                                        </select>
                                    </div>
                                    <Input label="Max Travel (Miles)" type="number" value={newPersonnel.maxTravelDistance || ''} onChange={e => setNewPersonnel({ ...newPersonnel, maxTravelDistance: parseFloat(e.target.value) })} />
                                </div>
                            </div>

                            {/* Banking & Tax */}
                            <div className="space-y-4 border-t pt-4">
                                <Heading level={4} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Banking & Tax</Heading>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Tax Classification</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={newPersonnel.taxClassification || 'Individual/Sole Proprietor'}
                                        onChange={e => setNewPersonnel({ ...newPersonnel, taxClassification: e.target.value })}
                                    >
                                        <option>Individual/Sole Proprietor</option>
                                        <option>C Corporation</option>
                                        <option>S Corporation</option>
                                        <option>Partnership</option>
                                        <option>Trust/Estate</option>
                                        <option>LLC</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Routing Number" value={newPersonnel.routingNumber || ''} onChange={handleRoutingChange} placeholder="000000000" />
                                    <Input label="Bank Name" value={newPersonnel.bankName || ''} onChange={e => setNewPersonnel({ ...newPersonnel, bankName: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Account Number" value={newPersonnel.accountNumber || ''} onChange={e => setNewPersonnel({ ...newPersonnel, accountNumber: e.target.value })} />
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Account Type</label>
                                        <select
                                            className="w-full p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            value={newPersonnel.accountType || 'Checking'}
                                            onChange={e => setNewPersonnel({ ...newPersonnel, accountType: e.target.value })}
                                        >
                                            <option>Checking</option>
                                            <option>Savings</option>
                                            <option>Business</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Swift Code" value={newPersonnel.swiftCode || ''} onChange={e => setNewPersonnel({ ...newPersonnel, swiftCode: e.target.value })} />
                                </div>
                            </div>

                            {/* Upload */}
                            <div className="space-y-4 border-t pt-4">
                                <label className="text-sm font-medium text-slate-700">Initial Document (e.g., W9 or License)</label>
                                <div className="flex gap-4 items-center">
                                    <button
                                        type="button"
                                        className="flex-1 border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative"
                                        onClick={() => !analyzingDoc && addFileInputRef.current?.click()}
                                    >
                                        {analyzingDoc ? (
                                            <div className="flex flex-col items-center py-2">
                                                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-2" />
                                                <Text className="text-cyan-600 font-medium animate-pulse">Analyzing Document...</Text>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                                                <Text className="text-slate-600 font-medium mb-1">{addFile ? addFile.name : 'Upload W9 or License'}</Text>
                                                <Text variant="small" className="text-slate-400 text-xs">AI can extract profile details from the file</Text>
                                            </>
                                        )}
                                        <input
                                            ref={addFileInputRef}
                                            type="file"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                            disabled={analyzingDoc}
                                        />
                                    </button>

                                    {addFile && !analyzingDoc && (
                                        <Button
                                            onClick={handleInitializeWithAI}
                                            className="h-full bg-cyan-600 hover:bg-cyan-500 text-white px-6 flex flex-col items-center justify-center gap-2"
                                        >
                                            <Zap className="w-5 h-5 fill-cyan-300" />
                                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Initialize<br />With AI</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-5 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-3 z-10">
                            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="border-slate-700 text-slate-400">Cancel</Button>
                            <Button onClick={handleAddPersonnel} disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 text-white border-none px-8 font-black tracking-widest uppercase">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SAVE PERSONNEL'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )
            }

            {
                isDetailModalOpen && selectedPerson && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900">
                            {/* Header */}
                            <div className="px-6 py-5 border-b bg-slate-50 flex flex-wrap gap-y-3 justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer relative group" onClick={() => photoInputRef.current?.click()}>
                                        <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                        {selectedPerson.photoUrl ? <img src={selectedPerson.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">{selectedPerson.fullName[0]}</div>}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload className="w-5 h-5 text-white" /></div>
                                    </div>
                                    <div>
                                        <Heading level={3} className="text-slate-900">{selectedPerson.fullName}</Heading>
                                        <div className="flex gap-2 mt-1 items-center flex-wrap">
                                            <Badge variant="outline">{selectedPerson.role}</Badge>
                                            <Badge variant={selectedPerson.status === 'Active' ? 'success' : 'default'}>{selectedPerson.status}</Badge>
                                            {selectedPerson.onboarding_status && (
                                                <Badge variant={selectedPerson.onboarding_status === 'completed' ? 'success' : 'outline'} className="capitalize">
                                                    Onboarding: {selectedPerson.onboarding_status.replace('_', ' ')}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                    {selectedPerson.onboarding_status !== 'completed' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 whitespace-nowrap"
                                            onClick={() => handleSendOnboarding(selectedPerson.id, selectedPerson.email)}
                                        >
                                            <Send className="w-4 h-4 mr-2" />
                                            Send Onboarding
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 whitespace-nowrap"
                                        onClick={() => handleProvisionAccount(selectedPerson.id, selectedPerson.email)}
                                    >
                                        <ShieldCheck className="w-4 h-4 mr-2" />
                                        Provision Account
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setIsDetailModalOpen(false)}><X /></Button>
                                </div>
                            </div>

                            {/* Onboarding Progress Bar */}
                            {selectedPerson.onboarding_status !== 'completed' && (
                                <div className="px-6 py-3 bg-slate-50/50 border-b">
                                    <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                        <span>Onboarding Progress</span>
                                        <span>{
                                            selectedPerson.onboarding_status === 'not_sent' ? '0%' :
                                                selectedPerson.onboarding_status === 'sent' ? '25%' :
                                                    selectedPerson.onboarding_status === 'in_progress' ? '60%' : '100%'
                                        }</span>
                                    </div>
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-500"
                                            style={{
                                                width: selectedPerson.onboarding_status === 'not_sent' ? '5%' :
                                                    selectedPerson.onboarding_status === 'sent' ? '25%' :
                                                        selectedPerson.onboarding_status === 'in_progress' ? '60%' : '100%'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Tabs */}
                            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
                                {['details', 'performance', 'schedule', 'banking', 'documents'].map(tab => (
                                    <button
                                        key={tab}
                                        className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${modalTab === tab ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-800'}`}
                                        onClick={() => setModalTab(tab as any)}
                                    >
                                        {tab === 'details' ? 'Profile' : tab}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-white text-slate-900">
                                {modalTab === 'performance' && selectedPerson && (
                                    <AxisPerformanceTab pilotId={selectedPerson.id} />
                                )}

                                {modalTab === 'schedule' && selectedPerson && (
                                    <PilotSchedule pilotId={selectedPerson.id} />
                                )}

                                {modalTab === 'details' && (
                                    <div className="space-y-6">
                                        {isEditMode ? (
                                            <div className="space-y-6">
                                                {/* Name & Contact */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input label="Full Name" value={editedPerson?.fullName || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, fullName: e.target.value } : null)} />
                                                    <Input label="Email" value={editedPerson?.email || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, email: e.target.value } : null)} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input label="Phone" value={editedPerson?.phone || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, phone: e.target.value } : null)} />
                                                    <Input label="Secondary Phone" value={editedPerson?.secondaryPhone || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, secondaryPhone: e.target.value } : null)} />
                                                </div>

                                                {/* Address */}
                                                <div className="space-y-2 pt-2 border-t">
                                                    <Text variant="small" className="font-semibold text-slate-500 uppercase">Address</Text>
                                                    <Input label="Street" value={editedPerson?.homeAddress || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, homeAddress: e.target.value } : null)} />
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                        <Input label="City" value={editedPerson?.city || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, city: e.target.value } : null)} />
                                                        <Input label="State" value={editedPerson?.state || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, state: e.target.value } : null)} />
                                                        <Input label="Zip" value={editedPerson?.zipCode || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, zipCode: e.target.value } : null)} />
                                                        <Input label="Country" value={editedPerson?.country || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, country: e.target.value } : null)} />
                                                    </div>
                                                </div>

                                                {/* Emergency */}
                                                <div className="space-y-4 pt-4 border-t">
                                                    <Text variant="small" className="font-semibold text-slate-500 uppercase">Emergency Contact</Text>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Input label="Name" value={editedPerson?.emergencyContactName || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, emergencyContactName: e.target.value } : null)} />
                                                        <Input label="Phone" value={editedPerson?.emergencyContactPhone || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, emergencyContactPhone: e.target.value } : null)} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                                    <Input label="Travel Radius (Miles)" type="number" value={editedPerson?.maxTravelDistance || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, maxTravelDistance: parseFloat(e.target.value) } : null)} />
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-slate-700">Role</label>
                                                        <select className="w-full p-2 border rounded-lg" value={editedPerson?.role} onChange={e => setEditedPerson(prev => prev ? { ...prev, role: e.target.value as any } : null)}>
                                                            <option value={PersonnelRole.PILOT}>Pilot</option>
                                                            <option value={PersonnelRole.TECHNICIAN}>Technician</option>
                                                            <option value={PersonnelRole.BOTH}>Both</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                                <div><Text variant="small" className="font-bold text-slate-500 mb-1">Contact</Text>
                                                    <div className="space-y-1"><Text className="text-slate-900 font-medium">{selectedPerson.email}</Text><Text className="text-slate-900 font-medium">{selectedPerson.phone}</Text><Text className="text-slate-500">{selectedPerson.secondaryPhone}</Text></div>
                                                </div>
                                                <div><Text variant="small" className="font-bold text-slate-500 mb-1">Address</Text>
                                                    <div className="space-y-1"><Text className="text-slate-900 font-medium">{selectedPerson.homeAddress}</Text><Text className="text-slate-900 font-medium">{selectedPerson.city}, {selectedPerson.state} {selectedPerson.zipCode}</Text><Text className="text-slate-900 font-medium">{selectedPerson.country}</Text></div>
                                                </div>
                                                <div><Text variant="small" className="font-bold text-slate-500 mb-1">Emergency</Text>
                                                    <div className="space-y-1"><Text className="text-slate-900 font-medium">{selectedPerson.emergencyContactName || 'N/A'}</Text><Text className="text-slate-900 font-medium">{selectedPerson.emergencyContactPhone}</Text></div>
                                                </div>
                                                <div><Text variant="small" className="font-bold text-slate-500 mb-1">Professional</Text>
                                                    <div className="space-y-1"><Text className="text-slate-900 font-medium">Max Travel: {selectedPerson.maxTravelDistance} miles</Text><Text className="text-slate-900 font-medium">Company: {selectedPerson.companyName || 'N/A'}</Text></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {modalTab === 'banking' && (
                                    <div className="space-y-4">
                                        {isEditMode ? (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-slate-700">Tax Classification</label>
                                                    <select
                                                        className="w-full p-2 border rounded-lg bg-white"
                                                        value={editedPerson?.taxClassification || 'Individual/Sole Proprietor'}
                                                        onChange={e => setEditedPerson(prev => prev ? { ...prev, taxClassification: e.target.value } : null)}
                                                    >
                                                        <option>Individual/Sole Proprietor</option>
                                                        <option>C Corporation</option>
                                                        <option>S Corporation</option>
                                                        <option>Partnership</option>
                                                        <option>Trust/Estate</option>
                                                        <option>LLC</option>
                                                    </select>
                                                </div>
                                                <Input label="Bank Name" value={editedBankingInfo.bankName || ''} onChange={e => setEditedBankingInfo(prev => ({ ...prev, bankName: e.target.value }))} />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input label="Routing" value={editedBankingInfo.routingNumber || ''} onChange={e => {
                                                        const routing = e.target.value;
                                                        const bank = MAJOR_US_BANKS.find(b => b.routingNumber === routing);
                                                        setEditedBankingInfo(prev => ({
                                                            ...prev,
                                                            routingNumber: routing,
                                                            bankName: bank ? bank.name : prev.bankName,
                                                            swiftCode: bank ? (bank as any).swiftCode : prev.swiftCode
                                                        }));
                                                    }} />
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-slate-700">Account Type</label>
                                                        <select
                                                            className="w-full p-2 border rounded-lg bg-white"
                                                            value={editedBankingInfo.accountType || 'Checking'}
                                                            onChange={e => setEditedBankingInfo(prev => ({ ...prev, accountType: e.target.value }))}
                                                        >
                                                            <option>Checking</option>
                                                            <option>Savings</option>
                                                            <option>Business</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input label="Account" type="text" value={editedBankingInfo.accountNumber || ''} onChange={e => setEditedBankingInfo(prev => ({ ...prev, accountNumber: e.target.value }))} />
                                                    <Input label="Swift Code" value={editedBankingInfo.swiftCode || ''} onChange={e => setEditedBankingInfo(prev => ({ ...prev, swiftCode: e.target.value }))} />
                                                </div>
                                                <div className="space-y-2 pt-4 border-t">
                                                    <label className="text-sm font-medium text-slate-700">Daily Rate ($)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="w-full p-2 border rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                        placeholder="e.g. 450.00"
                                                        value={editedBankingInfo.dailyRate || ''}
                                                        onChange={e => setEditedBankingInfo(prev => ({ ...prev, dailyRate: parseFloat(e.target.value) || null }))}
                                                    />
                                                    <p className="text-xs text-slate-400">Standard daily rate of pay for this personnel</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="bg-slate-50 p-4 rounded-lg border">
                                                    <Text variant="small" className="font-bold text-slate-500 uppercase mb-2">Tax Info</Text>
                                                    <Text className="text-slate-900 font-medium">{selectedPerson.taxClassification || 'Not set'}</Text>
                                                </div>
                                                <div className="bg-slate-50 p-4 rounded-lg border">
                                                    <Text variant="small" className="font-bold text-slate-500 uppercase mb-2">Banking</Text>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div><Text variant="small" className="text-slate-500 mb-1">Bank</Text><Text className="text-slate-900 font-medium">{bankingInfo?.bankName || 'Not set'}</Text></div>
                                                        <div><Text variant="small" className="text-slate-500 mb-1">Account Type</Text><Badge variant="outline" className="border-slate-300 text-slate-700">{bankingInfo?.accountType || 'Checking'}</Badge></div>
                                                        <div>
                                                            <Text variant="small" className="text-slate-500 mb-1">Routing</Text>
                                                            <div className="flex items-center gap-2">
                                                                <Text className="text-slate-900 font-mono font-medium">{bankingInfo?.routingNumber || 'Not set'}</Text>
                                                                {bankingInfo?.routingNumber && (
                                                                    <button onClick={() => navigator.clipboard.writeText(bankingInfo.routingNumber!)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Copy routing number">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <Text variant="small" className="text-slate-500 mb-1">Account</Text>
                                                            <div className="flex items-center gap-2">
                                                                <Text className="text-slate-900 font-mono font-medium">{bankingInfo?.accountNumber || 'Not set'}</Text>
                                                                {bankingInfo?.accountNumber && (
                                                                    <button onClick={() => navigator.clipboard.writeText(bankingInfo.accountNumber!)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Copy account number">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div><Text variant="small" className="text-slate-500 mb-1">Swift Code</Text><Text className="text-slate-900 font-medium">{bankingInfo?.swiftCode || 'Not set'}</Text></div>
                                                        <div><Text variant="small" className="text-slate-500 mb-1">Daily Rate</Text><Text className="font-semibold text-green-700">{bankingInfo?.dailyRate ? `$${bankingInfo.dailyRate.toFixed(2)}` : 'Not set'}</Text></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {modalTab === 'documents' && selectedPerson && (
                                    <PilotDocumentsPanel
                                        personnelId={selectedPerson.id}
                                        personnelName={selectedPerson.fullName}
                                    />
                                )}
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t flex justify-between z-10">
                                {isEditMode ? (
                                    <><Button variant="outline" onClick={handleCancelEdit}>Cancel</Button><Button onClick={modalTab === 'banking' ? handleSaveBankingInfo : handleUpdatePersonnel}>Save Changes</Button></>
                                ) : (
                                    <>
                                        <Button variant="ghost" onClick={() => handleDeletePersonnel(selectedPerson.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </Button>
                                        <Button onClick={() => setIsEditMode(true)}>Edit Profile</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                onboardingPromptOpen.isOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-xl p-6 text-center max-w-sm">
                            <Send className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                            <Heading level={3} className="mb-2">Send Welcome Package?</Heading>
                            <Text className="mb-6">Send onboarding documents to {onboardingPromptOpen.name}?</Text>
                            <div className="flex gap-3 justify-center">
                                <Button variant="ghost" onClick={() => setOnboardingPromptOpen({ isOpen: false })}>Later</Button>
                                <Button onClick={() => onboardingPromptOpen.personnelId && onboardingPromptOpen.email && handleSendOnboarding(onboardingPromptOpen.personnelId, onboardingPromptOpen.email)}>Send Now</Button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Document Viewer Modal */}
            {viewingDoc && (
                <div className="fixed inset-0 z-[100] flex justify-center items-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" style={{ height: '90vh' }}>
                        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                            <div>
                                <Heading level={3} className="text-slate-800">{viewingDoc.document_type || 'Document Viewer'}</Heading>
                                <Text variant="small" className="text-slate-500">Uploaded on {new Date(viewingDoc.uploaded_at || viewingDoc.created_at).toLocaleDateString()}</Text>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={viewingDoc.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm flex items-center transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4 mr-2" /> Download
                                </a>
                                <button
                                    onClick={handleCloseViewer}
                                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-200 p-2 md:p-6 overflow-hidden flex justify-center items-center">
                            {/* Secure document viewer via backend proxy */}
                            {loadingView ? (
                                <div className="flex flex-col items-center justify-center text-slate-500 space-y-4">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <p>Loading document...</p>
                                </div>
                            ) : viewingDoc.file_url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) ? (
                                <img
                                    src={viewingDocBlobUrl || viewingDoc.file_url}
                                    alt="Document Viewer"
                                    className="max-w-full max-h-full object-contain rounded shadow-sm bg-white"
                                />
                            ) : viewingDocBlobUrl ? (
                                <iframe
                                    src={viewingDocBlobUrl}
                                    className="w-full h-full rounded shadow-sm bg-white border-0"
                                    title="Document Viewer"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full bg-white text-slate-500 space-y-4 p-8">
                                    <FileText className="w-12 h-12 text-slate-300" />
                                    <p className="text-slate-500">Failed to load document preview.</p>
                                    <a href={viewingDoc.file_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                                        Open in New Tab
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Send Pre-Onboarding Documents Modal */}
            {isSendDocsModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <Card variant="glass" className="border-slate-800 w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
                        <CardHeader className="px-6 py-5 border-b border-slate-800 flex flex-row justify-between items-center bg-slate-900/50">
                            <CardTitle className="text-xl font-black text-white uppercase tracking-widest">Send Documents</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsSendDocsModalOpen(false)} className="text-slate-400 hover:text-white"><X /></Button>
                        </CardHeader>

                        <div className="p-6 space-y-6 flex-1">
                            <Text className="text-slate-400 text-sm">
                                Send standalone onboarding documents directly to a candidate's email without creating a system profile.
                            </Text>

                            <Input
                                label="Candidate Email"
                                type="email"
                                value={sendDocsEmail}
                                onChange={e => setSendDocsEmail(e.target.value)}
                                placeholder="candidate@example.com"
                            />

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-slate-300">Select Documents to Attach:</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSelectedDocs(['nda', 'pilot_agreement', 'onboarding_guide', 'w9', 'direct_deposit'])}
                                            className="text-xs text-cyan-500 hover:text-cyan-400 font-bold uppercase tracking-wider"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={() => setSelectedDocs([])}
                                            className="text-xs text-slate-500 hover:text-slate-400 font-bold uppercase tracking-wider"
                                        >
                                            None
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 bg-slate-900/50 p-4 border border-slate-800 rounded-lg">
                                    {[
                                        { id: 'nda', label: 'Non-Disclosure Agreement (NDA)' },
                                        { id: 'pilot_agreement', label: 'Pilot Services Agreement' },
                                        { id: 'onboarding_guide', label: 'Pilot Onboarding Guide' },
                                        { id: 'w9', label: 'W-9 Tax Form' },
                                        { id: 'direct_deposit', label: 'Direct Deposit Authorization' }
                                    ].map(doc => (
                                        <label key={doc.id} className="flex items-center gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-600/50 focus:ring-offset-slate-900"
                                                checked={selectedDocs.includes(doc.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedDocs(prev => [...prev, doc.id]);
                                                    } else {
                                                        setSelectedDocs(prev => prev.filter(id => id !== doc.id));
                                                    }
                                                }}
                                            />
                                            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{doc.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-5 bg-slate-950/80 border-t border-slate-800 flex justify-end gap-3 z-10">
                            <Button variant="outline" onClick={() => setIsSendDocsModalOpen(false)} className="border-slate-700 text-slate-400">Cancel</Button>
                            <Button onClick={handleSendDocs} disabled={sendingDocs || selectedDocs.length === 0 || !sendDocsEmail} className="bg-cyan-600 hover:bg-cyan-500 text-white border-none px-6 font-black tracking-widest uppercase flex items-center gap-2 disabled:opacity-50">
                                {sendingDocs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                SEND EMAILS
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default PersonnelTracker;
