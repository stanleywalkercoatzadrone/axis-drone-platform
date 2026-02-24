import React, { useState, useEffect, useRef } from 'react';
import PilotSchedule from './PilotSchedule';
import { BadgeCheck, HardHat, Mail, Phone, Search, UserPlus, Filter, MoreHorizontal, FileText, DollarSign, Map, Send, CheckCircle2, ShieldCheck, MapPin, Upload, Package, X, Loader2, Download, Trash2, Plus, Zap } from 'lucide-react';
import { Personnel, PersonnelRole, BankingInfo, Country } from '../types';
import apiClient from '../src/services/apiClient';
import { MAJOR_US_BANKS } from '../src/utils/bankData';
import { Button } from '../src/stitch/components/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../src/stitch/components/Card';
import { Input } from '../src/stitch/components/Input';
import { Badge } from '../src/stitch/components/Badge';
import { Heading, Text } from '../src/stitch/components/Typography';

import { useIndustry } from '../src/context/IndustryContext';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AxisPerformanceTab } from '../src/components/personnel/AxisPerformanceTab';
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


const PersonnelTracker: React.FC = () => {
    useEffect(() => {
        console.log('🚀 [DEBUG] PersonnelTracker component mounted');
    }, []);
    const { tLabel } = useIndustry();
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
        emergencyContactName: '',
        emergencyContactPhone: '',
        taxClassification: 'Individual/Sole Proprietor',
        accountType: 'Checking'
    });
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [addFile, setAddFile] = useState<File | null>(null);

    const [onboardingPromptOpen, setOnboardingPromptOpen] = useState<{ isOpen: boolean; personnelId?: string; name?: string; }>({ isOpen: false });
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    // Banking State
    const [modalTab, setModalTab] = useState<'details' | 'banking' | 'documents' | 'performance' | 'schedule'>('details');
    const [bankingInfo, setBankingInfo] = useState<BankingInfo | null>(null);
    const [editedBankingInfo, setEditedBankingInfo] = useState<Partial<BankingInfo>>({});

    // Document State
    const [analyzingDoc, setAnalyzingDoc] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docType, setDocType] = useState('License');
    const [docExpiration, setDocExpiration] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
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

    const handleSendOnboarding = async (id: string) => {
        try {
            const res = await apiClient.post('/onboarding/send', { personnelId: id });
            if (res.data.success) {
                alert('Onboarding package sent!');
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

    const getComplianceBadge = (person: Personnel) => {
        const status = (person as any).complianceStatus || 'pending';
        switch (status) {
            case 'compliant': return <Badge variant="success">Compliant</Badge>;
            case 'expired': return <Badge variant="destructive">Expired</Badge>;
            case 'expiring_soon': return <Badge variant="warning">Expiring Soon</Badge>;
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
                name: data.data.fullName
            });

        } catch (err: any) {
            console.error('Error creating personnel:', err);
            alert(err.message);
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
            bankName: bank ? bank.name : prev.bankName
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
            alert(err.message);
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
            const response = await apiClient.get(`/personnel/${pilotId}/documents`);
            if (response.data.success) {
                setDocuments(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
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
            alert(error.message);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedPerson) return;

        setUploadingDoc(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pilotId', selectedPerson.id);
        formData.append('documentType', docType);
        formData.append('countryId', selectedPerson.country === 'US' ? 'US' : 'CA');
        if (docExpiration) formData.append('expirationDate', docExpiration);

        try {
            const res = await apiClient.post(`/personnel/${selectedPerson.id}/documents`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setDocuments(prev => [res.data.document || res.data.data, ...prev]);
                if (res.data.updatedPersonnel) {
                    setSelectedPerson(res.data.updatedPersonnel);
                    setEditedPerson(res.data.updatedPersonnel);
                    setPersonnel(prev => prev.map(p => p.id === selectedPerson.id ? res.data.updatedPersonnel : p));
                }
                if (res.data.updatedBanking) {
                    setBankingInfo(res.data.updatedBanking);
                    setEditedBankingInfo(res.data.updatedBanking);
                }
                setDocExpiration('');
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

    const handleUpdatePersonnel = async () => {
        if (!editedPerson || !selectedPerson) return;
        try {
            const updatePayload = {
                ...editedPerson,
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
            alert(err.message);
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
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-slate-200">
            <div className="flex items-end justify-between">
                <div>
                    <Heading level={2} className="text-white tracking-widest">{tLabel('stakeholder').toUpperCase()}S</Heading>
                    <Text variant="small" className="text-slate-500 font-medium">Manage pilots, technicians, and operational staff.</Text>
                </div>
                <div className="flex gap-2">
                    <div className="bg-slate-900/50 p-1 rounded-lg flex border border-slate-800">
                        <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>LIST</button>
                        <button onClick={() => setViewMode('map')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'map' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>MAP</button>
                    </div>
                    <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white border-none shadow-lg shadow-cyan-900/20">
                        <UserPlus className="w-4 h-4" /> Add Personnel
                    </Button>
                </div>
            </div>

            <Card className="border-slate-800 overflow-hidden bg-slate-900/40">
                <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/80">
                    <div className="flex items-center bg-slate-950/50 p-1 rounded-lg border border-slate-800">
                        {['All', PersonnelRole.PILOT, PersonnelRole.TECHNICIAN, PersonnelRole.BOTH].map((role) => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role as any)}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${roleFilter === role ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {role}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search fleet personnel..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:bg-slate-800 transition-all placeholder:text-slate-600"
                        />
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950/30 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Name</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Compliance</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filteredPersonnel.map((person) => (
                                    <tr key={person.id} onClick={() => handleViewDetails(person)} className="hover:bg-slate-800/20 cursor-pointer group transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black overflow-hidden shadow-inner">
                                                    {person.photoUrl ? <img src={person.photoUrl} className="w-full h-full object-cover" /> : person.fullName[0]}
                                                </div>
                                                <Text variant="small" className="font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{person.fullName}</Text>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="secondary" className="bg-slate-800/50 border-slate-700 text-xs py-0 px-2">{person.role}</Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={person.status === 'Active' ? 'success' : 'default'} className="text-[10px] py-0 px-2">{person.status}</Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="scale-90 origin-left">
                                                {getComplianceBadge(person)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeletePersonnel(person.id); }} className="hover:bg-red-950/30">
                                                <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-red-500 transition-colors" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                                <div className="text-xs text-slate-500">{person.role}</div>
                                                <div className="text-xs mt-1">Travel Radius: {person.maxTravelDistance || 0} miles</div>
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
            </Card>

            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <Card variant="glass" className="border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                        <CardHeader className="px-6 py-5 border-b border-slate-800 flex flex-row justify-between items-center bg-slate-900/50">
                            <CardTitle className="text-xl font-black text-white uppercase tracking-widest">Add New Personnel</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white"><X /></Button>
                        </CardHeader>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-950/30">
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name" />
                                <Input label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name" />
                            </div>

                            <div className="space-y-4 border-t border-slate-800 pt-4">
                                <Heading level={4} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Contact Details</Heading>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Email" value={newPersonnel.email || ''} onChange={e => setNewPersonnel({ ...newPersonnel, email: e.target.value })} placeholder="email@example.com" />
                                    <Input label="Company" value={newPersonnel.companyName || ''} onChange={e => setNewPersonnel({ ...newPersonnel, companyName: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Phone" value={newPersonnel.phone || ''} onChange={e => setNewPersonnel({ ...newPersonnel, phone: e.target.value })} />
                                    <Input label="Secondary Phone" value={newPersonnel.secondaryPhone || ''} onChange={e => setNewPersonnel({ ...newPersonnel, secondaryPhone: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-slate-800 pt-4">
                                <Heading level={4} className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Professional</Heading>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Text variant="small" className="font-bold text-slate-500 ml-1">ROLE</Text>
                                        <select
                                            className="w-full p-2 h-10 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
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

                            <div className="space-y-4 border-t border-slate-800 pt-4">
                                <label className="text-sm font-medium text-slate-400">Initial Document (e.g., W9 or License)</label>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        className="flex-1 border-2 border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-900/20 hover:bg-slate-900/40 hover:border-cyan-500/30 transition-all cursor-pointer"
                                        onClick={() => !analyzingDoc && addFileInputRef.current?.click()}
                                    >
                                        <div className="bg-slate-800 p-2 rounded-full mb-2 text-slate-400"><Upload className="w-5 h-5" /></div>
                                        <Text variant="small" className="text-slate-200 font-bold max-w-[150px] truncate">{addFile ? addFile.name : 'UPLOAD FILE'}</Text>
                                        <input ref={addFileInputRef} type="file" className="hidden" onChange={handleFileSelect} disabled={analyzingDoc} />
                                    </button>

                                    {addFile && (
                                        <Button
                                            onClick={handleInitializeWithAI}
                                            disabled={analyzingDoc}
                                            className="h-auto px-6 bg-slate-800 hover:bg-cyan-900/20 text-cyan-500 border-slate-700 flex flex-col items-center justify-center gap-2 min-w-[140px]"
                                        >
                                            {analyzingDoc ? (
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <Zap className="w-6 h-6" />
                                            )}
                                            <span className="text-[10px] font-black uppercase tracking-tighter">Initialize with AI</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-5 bg-slate-900 border-t border-slate-800 flex justify-end gap-3 z-10">
                            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="text-slate-500">Cancel</Button>
                            <Button onClick={handleAddPersonnel} disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 text-white border-none px-8 font-bold">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                SAVE PERSONNEL
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {isDetailModalOpen && selectedPerson && (
                <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <Card variant="glass" className="border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                        <div className="px-6 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-700 shadow-xl cursor-pointer relative group" onClick={() => photoInputRef.current?.click()}>
                                    <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                    {selectedPerson.photoUrl ? <img src={selectedPerson.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center text-2xl font-black text-slate-500">{selectedPerson.fullName[0]}</div>}
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload className="w-6 h-6 text-white" /></div>
                                </div>
                                <div>
                                    <Heading level={3} className="text-white tracking-widest uppercase">{selectedPerson.fullName}</Heading>
                                    <div className="flex gap-2 mt-1.5 items-center">
                                        <Badge variant="secondary" className="bg-slate-800/50 border-slate-700">{selectedPerson.role}</Badge>
                                        <Badge variant={selectedPerson.status === 'Active' ? 'success' : 'default'}>{selectedPerson.status}</Badge>
                                        {selectedPerson.onboarding_status && (
                                            <Badge variant={selectedPerson.onboarding_status === 'completed' ? 'success' : 'outline'} className="capitalize border-slate-800">
                                                Onboarding: {selectedPerson.onboarding_status.replace('_', ' ')}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedPerson.onboarding_status !== 'completed' && (
                                    <Button size="sm" variant="outline" className="border-cyan-900/50 text-cyan-500 hover:bg-cyan-950/30" onClick={() => handleSendOnboarding(selectedPerson.id)}>
                                        <Send className="w-4 h-4 mr-2" /> SEND ONBOARDING
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => setIsDetailModalOpen(false)} className="text-slate-500 hover:text-white"><X /></Button>
                            </div>
                        </div>

                        {selectedPerson.onboarding_status !== 'completed' && (
                            <div className="px-6 py-3 bg-slate-950/30 border-b border-slate-800">
                                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    <span>ONBOARDING PROGRESS</span>
                                    <span>{selectedPerson.onboarding_status === 'not_sent' ? '5%' : selectedPerson.onboarding_status === 'sent' ? '25%' : selectedPerson.onboarding_status === 'in_progress' ? '60%' : '100%'}</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-600 shadow-[0_0_10px_rgba(8,145,178,0.5)] transition-all duration-700" style={{ width: selectedPerson.onboarding_status === 'not_sent' ? '5%' : selectedPerson.onboarding_status === 'sent' ? '25%' : selectedPerson.onboarding_status === 'in_progress' ? '60%' : '100%' }} />
                                </div>
                            </div>
                        )}

                        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 pt-2">
                            {['details', 'performance', 'schedule', 'banking', 'documents'].map(tab => (
                                <button key={tab} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${modalTab === tab ? 'text-cyan-400 border-cyan-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`} onClick={() => setModalTab(tab as any)}>
                                    {tab === 'details' ? 'Profile' : tab}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-950/20">
                            {modalTab === 'performance' && selectedPerson && <AxisPerformanceTab pilotId={selectedPerson.id} />}
                            {modalTab === 'schedule' && selectedPerson && <PilotSchedule pilotId={selectedPerson.id} />}
                            {modalTab === 'details' && (
                                <div className="space-y-6">
                                    {isEditMode ? (
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                            <Input label="FULL NAME" value={editedPerson?.fullName || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, fullName: e.target.value } : null)} />
                                            <Input label="EMAIL" value={editedPerson?.email || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, email: e.target.value } : null)} />
                                            <Input label="PHONE" value={editedPerson?.phone || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, phone: e.target.value } : null)} />
                                            <Input label="TRAVEL RADIUS" type="number" value={editedPerson?.maxTravelDistance || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, maxTravelDistance: parseFloat(e.target.value) } : null)} />
                                            <div className="col-span-2"><Input label="STREET ADDRESS" value={editedPerson?.homeAddress || ''} onChange={e => setEditedPerson(prev => prev ? { ...prev, homeAddress: e.target.value } : null)} /></div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <Text variant="small" className="font-black text-slate-500 uppercase tracking-widest">Contact</Text>
                                                <div className="mt-2 space-y-1"><Text className="font-bold">{selectedPerson.email}</Text><Text className="text-slate-400">{selectedPerson.phone}</Text></div>
                                            </div>
                                            <div>
                                                <Text variant="small" className="font-black text-slate-500 uppercase tracking-widest">Address</Text>
                                                <div className="mt-2 text-slate-300"><Text>{selectedPerson.homeAddress}</Text><Text>{selectedPerson.city}, {selectedPerson.state} {selectedPerson.zipCode}</Text></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {modalTab === 'banking' && (
                                <div className="space-y-6">
                                    {isEditMode ? (
                                        <div className="grid grid-cols-2 gap-6">
                                            <Input label="BANK NAME" value={editedBankingInfo.bankName || ''} onChange={e => setEditedBankingInfo(prev => ({ ...prev, bankName: e.target.value }))} />
                                            <Input label="ROUTING" value={editedBankingInfo.routingNumber || ''} onChange={e => setEditedBankingInfo(prev => ({ ...prev, routingNumber: e.target.value }))} />
                                            <Input label="ACCOUNT" type="password" value={editedBankingInfo.accountNumber || ''} onChange={e => setEditedBankingInfo(prev => ({ ...prev, accountNumber: e.target.value }))} />
                                            <div className="space-y-2">
                                                <Text variant="small" className="font-bold text-slate-500 ml-1">TYPE</Text>
                                                <select className="w-full p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm" value={editedBankingInfo.accountType || 'Checking'} onChange={e => setEditedBankingInfo(prev => ({ ...prev, accountType: e.target.value }))}>
                                                    <option>Checking</option><option>Savings</option><option>Business</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-6">
                                            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                                <Text className="font-black text-cyan-500 tracking-widest uppercase">Institution</Text>
                                                <Text className="font-bold text-white">{bankingInfo?.bankName || 'NOT SET'}</Text>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                                <div><Text variant="small" className="text-slate-500 font-black uppercase tracking-widest mb-1">Routing</Text><Text className="font-mono text-white">{bankingInfo?.routingNumber ? '****' + bankingInfo.routingNumber.slice(-4) : '•••••••••'}</Text></div>
                                                <div><Text variant="small" className="text-slate-500 font-black uppercase tracking-widest mb-1">Account</Text><Text className="font-mono text-white">{bankingInfo?.accountNumber ? '****' + bankingInfo.accountNumber.slice(-4) : '•••••••••'}</Text></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {modalTab === 'documents' && (
                                <div className="space-y-6">
                                    <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-4">
                                        <Heading level={4} className="text-sm font-black text-white uppercase tracking-widest">Secure Upload</Heading>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Text variant="small" className="font-black text-slate-500 ml-1 uppercase">Doc Type</Text>
                                                <select className="w-full p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm" value={docType} onChange={e => setDocType(e.target.value)}>
                                                    <option value="License">License (FAA/Pilot)</option><option value="W9">W9 Form</option><option value="Insurance">Insurance Policy</option><option value="Other">Field Report</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Text variant="small" className="font-black text-slate-500 ml-1 uppercase">Expiry</Text>
                                                <input type="date" className="w-full p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm" value={docExpiration} onChange={e => setDocExpiration(e.target.value)} />
                                            </div>
                                        </div>
                                        <Button onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc} className="w-full bg-slate-800 hover:bg-slate-700 border-none py-6 font-bold tracking-widest">
                                            {uploadingDoc ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Upload className="w-5 h-5 mr-3" />} SELECT SECURE FILE
                                        </Button>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    </div>

                                    <div className="space-y-3">
                                        <Heading level={4} className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Archived Records</Heading>
                                        <div className="space-y-2">
                                            {documents.map(doc => (
                                                <div key={doc.id} className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex justify-between items-center group hover:border-cyan-900/50 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="bg-slate-800 p-2.5 rounded-lg text-cyan-500 shadow-inner"><FileText className="w-5 h-5" /></div>
                                                        <div><Text className="font-bold text-slate-200">{doc.document_type}</Text><Text variant="small" className="text-slate-600 font-mono text-[10px]">{new Date(doc.created_at).toLocaleDateString()}</Text></div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant={doc.validation_status === 'VALID' ? 'success' : 'outline'} className="text-[9px] font-black italic tracking-widest border-slate-800">{doc.validation_status}</Badge>
                                                        <a href={doc.file_url} target="_blank" className="p-2 text-slate-500 hover:text-cyan-400" title="Download Record"><Download className="w-4 h-4" /></a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-5 bg-slate-900 border-t border-slate-800 flex justify-between z-10">
                            {isEditMode ? (
                                <><Button variant="ghost" onClick={handleCancelEdit} className="text-slate-500">Cancel</Button><Button onClick={modalTab === 'banking' ? handleSaveBankingInfo : handleUpdatePersonnel} className="bg-cyan-600 px-10 font-bold">COMMIT CHANGES</Button></>
                            ) : (
                                <><Button variant="ghost" onClick={() => handleDeletePersonnel(selectedPerson.id)} className="text-slate-600 hover:text-red-500 hover:bg-red-950/10"><Trash2 className="w-4 h-4 mr-2" /> DISCHARGE</Button><Button onClick={() => setIsEditMode(true)} className="bg-slate-800 hover:bg-slate-700 font-bold px-10 border-none">EDIT PROFILE</Button></>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default PersonnelTracker;
