
import React, { useState, useEffect, useRef } from 'react';
import { BadgeCheck, HardHat, Mail, Phone, Search, UserPlus, Filter, MoreHorizontal, FileText, DollarSign, Map as MapIcon, Send, CheckCircle2, LayoutGrid, MapPin, Navigation } from 'lucide-react';
import { Personnel, PersonnelRole } from '../types';
import apiClient from '../src/services/apiClient';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React-Leaflet
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
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('pt_searchQuery') || '');

    const [roleFilter, setRoleFilter] = useState<'All' | PersonnelRole>(() => (sessionStorage.getItem('pt_roleFilter') as any) || 'All');
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    // Persistence Effects
    useEffect(() => { sessionStorage.setItem('pt_searchQuery', searchQuery); }, [searchQuery]);
    useEffect(() => { sessionStorage.setItem('pt_roleFilter', roleFilter); }, [roleFilter]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Geocoding Status State
    const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
    const [pendingCount, setPendingCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);

    // Geocoding State (Map from Personnel ID to [lat, lng])
    const [geocodedPositions, setGeocodedPositions] = useState<Record<string, [number, number]>>({});

    // Load cached geocodes on mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem('pt_geocodes');
            if (cached) {
                setGeocodedPositions(JSON.parse(cached));
            }
        } catch (e) {
            console.error("Failed to load geocodes", e);
        }
    }, []);

    // Track processing Status to prevent duplicate requests
    const isProcessingRef = useRef(false);

    // Geocode new personnel addresses
    useEffect(() => {
        if (viewMode !== 'map' || personnel.length === 0) return;
        if (isProcessingRef.current) return;

        const geocodeAddresses = async () => {
            // Read fresh state from localStorage or Ref would be better, but we can't easily.
            // Instead, we will use the functional update pattern's knowledge or just check localStorage.
            // Simplest fix: Read localStorage first to get 'absolute truth' of what we have.
            let currentPositions: Record<string, [number, number]> = {};
            try {
                const cached = localStorage.getItem('pt_geocodes');
                if (cached) currentPositions = JSON.parse(cached);
            } catch (e) { }

            // Filter personnel who have an address but NOT in currentPositions
            const toGeocode = personnel.filter(p =>
                p.homeAddress &&
                p.homeAddress.trim().length > 5 &&
                !currentPositions[p.id]
            );

            if (toGeocode.length === 0) {
                setGeocodingStatus('completed');
                return;
            }

            console.log(`[Geocoding] Starting batch for ${toGeocode.length} addresses.`);
            isProcessingRef.current = true;
            setGeocodingStatus('processing');
            setPendingCount(toGeocode.length);
            setErrorCount(0);

            let processed = 0;
            let currentErrors = 0;
            let batchUpdates = { ...currentPositions };
            let hasNewUpdates = false;

            // Sequential fetch
            for (const person of toGeocode) {
                // Double check if component unmounted or mode changed? (Hard to check inside async loop without Ref)

                try {
                    console.log(`[Geocoding] Fetching: ${person.homeAddress}`);
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(person.homeAddress)}`);

                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.length > 0) {
                            const lat = parseFloat(data[0].lat);
                            const lng = parseFloat(data[0].lon);

                            batchUpdates[person.id] = [lat, lng];
                            hasNewUpdates = true;

                            // Update UI state immediately for this person
                            setGeocodedPositions(prev => ({ ...prev, [person.id]: [lat, lng] }));
                            console.log(`[Geocoding] Success: ${person.fullName}`);
                        } else {
                            console.warn(`[Geocoding] No results for: ${person.homeAddress}`);
                            currentErrors++;
                        }
                    } else {
                        console.error(`[Geocoding] API Error: ${response.status}`);
                        currentErrors++;
                    }
                } catch (err) {
                    console.error(`Failed to geocode ${person.fullName}:`, err);
                    currentErrors++;
                }

                processed++;
                setPendingCount(toGeocode.length - processed);
                if (currentErrors > 0) setErrorCount(currentErrors); // Update error count only if errors exist

                // Wait 1.1 seconds between requests to be safe
                await new Promise(resolve => setTimeout(resolve, 1100));
            }

            if (hasNewUpdates) {
                localStorage.setItem('pt_geocodes', JSON.stringify(batchUpdates));
            }

            setGeocodingStatus(currentErrors > 0 ? 'error' : 'completed');
            isProcessingRef.current = false;
        };

        geocodeAddresses();
    }, [personnel, viewMode]); // Removed geocodedPositions from dependency to break loop

    const [editedPerson, setEditedPerson] = useState<Personnel | null>(null);
    const [newPersonnel, setNewPersonnel] = useState<Partial<Personnel>>({
        role: PersonnelRole.PILOT,
        status: 'Active',
        certificationLevel: 'Part 107',

        dailyPayRate: 0,
        maxTravelDistance: 0,
        homeAddress: ''
    });
    const [sendingOnboarding, setSendingOnboarding] = useState(false);
    const [onboardingPromptOpen, setOnboardingPromptOpen] = useState<{ isOpen: boolean; personnelId?: string; name?: string }>({ isOpen: false });

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

    const handleAddPersonnel = async () => {
        if (!newPersonnel.fullName || !newPersonnel.email) return;

        try {
            const response = await apiClient.post('/personnel', {
                fullName: newPersonnel.fullName,
                role: newPersonnel.role,
                email: newPersonnel.email,
                phone: newPersonnel.phone,
                certificationLevel: newPersonnel.certificationLevel,
                dailyPayRate: newPersonnel.dailyPayRate || 0,

                maxTravelDistance: newPersonnel.maxTravelDistance || 0,
                status: newPersonnel.status || 'Active',
                homeAddress: newPersonnel.homeAddress
            });

            const data = response.data;
            setPersonnel([...personnel, data.data]);
            setIsAddModalOpen(false);
            setNewPersonnel({
                role: PersonnelRole.PILOT,
                status: 'Active',
                certificationLevel: 'Part 107',
                dailyPayRate: 0,
                maxTravelDistance: 0,
                homeAddress: ''
            });

            // Prompt to send onboarding package
            setOnboardingPromptOpen({
                isOpen: true,
                personnelId: data.data.id,
                name: data.data.fullName
            });

        } catch (err: any) {
            console.error('Error creating personnel:', err);
            alert(err.message);
        }
    };

    const handleSendOnboarding = async (personnelId: string) => {
        try {
            setSendingOnboarding(true);
            await apiClient.post('/onboarding/send', { personnelId });

            // Update local state
            setPersonnel(personnel.map(p =>
                p.id === personnelId
                    ? { ...p, onboarding_status: 'sent', onboarding_sent_at: new Date().toISOString() }
                    : p
            ));

            alert('Onboarding package sent successfully!');
            setOnboardingPromptOpen({ isOpen: false });

            if (selectedPerson?.id === personnelId) {
                setSelectedPerson({
                    ...selectedPerson,
                    onboarding_status: 'sent',
                    onboarding_sent_at: new Date().toISOString()
                } as Personnel);
            }
        } catch (err: any) {
            console.error('Error sending onboarding:', err);
            alert(err.message || 'Failed to send onboarding package.');
        } finally {
            setSendingOnboarding(false);
        }
    };

    const handleDeletePersonnel = async (id: string) => {
        if (!confirm('Are you sure you want to remove this personnel member? This action cannot be undone.')) return;

        try {
            await apiClient.delete(`/personnel/${id}`);
            setPersonnel(personnel.filter(p => p.id !== id));
            if (selectedPerson?.id === id) {
                setIsDetailModalOpen(false);
                setSelectedPerson(null);
            }
        } catch (err: any) {
            console.error('Error deleting personnel:', err);
            alert(err.message || 'Failed to delete personnel.');
        }
    };

    const handleViewDetails = (person: Personnel) => {
        setSelectedPerson(person);
        setEditedPerson(person);
        setIsEditMode(false);
        setIsDetailModalOpen(true);
    };

    const handleUpdatePersonnel = async () => {
        if (!editedPerson || !selectedPerson) return;

        try {
            const response = await apiClient.put(`/personnel/${selectedPerson.id}`, {
                fullName: editedPerson.fullName,
                role: editedPerson.role,
                email: editedPerson.email,
                phone: editedPerson.phone,
                certificationLevel: editedPerson.certificationLevel,
                dailyPayRate: editedPerson.dailyPayRate,
                maxTravelDistance: editedPerson.maxTravelDistance,

                status: editedPerson.status,
                homeAddress: editedPerson.homeAddress
            });

            const updatedPersonnel = personnel.map(p =>
                p.id === selectedPerson.id ? response.data.data : p
            );
            setPersonnel(updatedPersonnel);
            setSelectedPerson(response.data.data);
            setEditedPerson(response.data.data);
            setIsEditMode(false);
        } catch (err: any) {
            console.error('Error updating personnel:', err);
            alert(err.message || 'Failed to update personnel.');
        }
    };

    const handleCancelEdit = () => {
        setEditedPerson(selectedPerson);
        setIsEditMode(false);
    };

    const filteredPersonnel = personnel.filter(p => {
        const matchesSearch = p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'All' || p.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Personnel Registry</h2>
                    <p className="text-sm text-slate-500">Manage pilots, technicians, and operational staff.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <UserPlus className="w-4 h-4" /> Add Personnel
                </button>
            </div>



            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* View Toggle & Filters */}
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'list'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" /> List
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'map'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <MapIcon className="w-3.5 h-3.5" /> Map
                            </button>
                        </div>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                            {['All', PersonnelRole.PILOT, PersonnelRole.TECHNICIAN].map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setRoleFilter(role as any)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${roleFilter === role
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search personnel..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                {/* Content Area */}
                {viewMode === 'list' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Certification</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPersonnel.map((person) => (
                                    <tr
                                        key={person.id}
                                        onClick={() => handleViewDetails(person)}
                                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                    {person.fullName.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{person.fullName}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{person.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {person.role === PersonnelRole.PILOT ? (
                                                    <BadgeCheck className="w-4 h-4 text-blue-500" />
                                                ) : person.role === PersonnelRole.BOTH ? (
                                                    <div className="flex -space-x-1">
                                                        <BadgeCheck className="w-4 h-4 text-blue-500 z-10" />
                                                        <HardHat className="w-4 h-4 text-amber-500" />
                                                    </div>
                                                ) : (
                                                    <HardHat className="w-4 h-4 text-amber-500" />
                                                )}
                                                <span className="text-sm text-slate-700">{person.role}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                    <Mail className="w-3 h-3 text-slate-400" /> {person.email}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                                    <Phone className="w-3 h-3 text-slate-400" /> {person.phone}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                {person.certificationLevel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${person.status === 'Active'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : person.status === 'On Leave'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${person.status === 'Active' ? 'bg-emerald-500' : person.status === 'On Leave' ? 'bg-amber-500' : 'bg-slate-400'
                                                    }`} />
                                                {person.status}
                                            </span>
                                            {person.onboarding_status && person.onboarding_status !== 'not_sent' && (
                                                <div className="mt-1">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${person.onboarding_status === 'completed' ? 'text-emerald-600' :
                                                        person.onboarding_status === 'in_progress' ? 'text-amber-600' : 'text-blue-600'
                                                        }`}>
                                                        {person.onboarding_status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                                                        {person.onboarding_status === 'sent' && <Send className="w-3 h-3" />}
                                                        {person.onboarding_status === 'completed' ? 'Onboarding Complete' : 'Onboarding Sent'}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                {!['completed', 'in_progress'].includes(person.onboarding_status || '') && (
                                                    <button
                                                        onClick={() => handleSendOnboarding(person.id)}
                                                        disabled={sendingOnboarding}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Send Onboarding Package"
                                                    >
                                                        <Send className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeletePersonnel(person.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors group/delete"
                                                    title="Remove Personnel"
                                                >
                                                    <MoreHorizontal className="w-4 h-4 text-slate-400 group-hover/delete:hidden" />
                                                    <span className="hidden group-hover/delete:inline text-[10px] font-bold uppercase tracking-wider text-red-600">Remove</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredPersonnel.length === 0 && (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Search className="w-5 h-5 text-slate-400" />
                                </div>
                                <h3 className="text-sm font-medium text-slate-900">No personnel found</h3>
                                <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search query.</p>
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Add Personnel
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full bg-slate-100 relative group border border-slate-200 rounded-lg overflow-hidden" style={{ height: '600px', zIndex: 0 }}>
                        <MapContainer
                            center={[30.2672, -97.7431]}
                            zoom={10}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {filteredPersonnel.map((person, i) => {
                                // Priority: 
                                // 1. Geocoded Real Position
                                // 2. Fallback Deterministic Calculation (Austin-based offset)

                                let position: [number, number];

                                if (geocodedPositions[person.id]) {
                                    position = geocodedPositions[person.id];
                                } else {
                                    // Fallback: Austin TX (30.2672, -97.7431) with deterministic scatter
                                    const latOffset = ((i * 1337) % 100 - 50) / 1000;
                                    const lngOffset = ((i * 7331) % 100 - 50) / 1000;
                                    position = [30.2672 + latOffset, -97.7431 + lngOffset];
                                }

                                return (
                                    <Marker
                                        key={person.id}
                                        position={position}
                                        eventHandlers={{
                                            click: () => handleViewDetails(person),
                                        }}
                                    >
                                        <Popup>
                                            <div className="p-1 min-w-[150px]">
                                                <div className="font-bold text-slate-800 text-sm mb-1">{person.fullName}</div>
                                                <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wide">{person.role}</div>

                                                {person.homeAddress && (
                                                    <div className="text-xs text-slate-600 mb-2 flex items-start gap-1 bg-slate-50 p-1 rounded border border-slate-100">
                                                        <MapIcon className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                                                        <span className="leading-tight">{person.homeAddress}</span>
                                                    </div>
                                                )}

                                                {!geocodedPositions[person.id] && person.homeAddress && (
                                                    <div className="text-[10px] text-amber-600 mb-2 italic">
                                                        📍 Locating address...
                                                    </div>
                                                )}

                                                <button
                                                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded w-full hover:bg-blue-100 hover:text-blue-700 font-semibold transition-colors flex items-center justify-center gap-1"
                                                    onClick={() => handleViewDetails(person)}
                                                >
                                                    View Profile <Navigation className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>

                        {/* Geocoding Status Overlay */}
                        <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-2 items-end pointer-events-none">
                            {geocodingStatus === 'processing' && (
                                <div className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-md border border-slate-200 text-xs text-slate-600 flex items-center gap-2 pointer-events-auto">
                                    <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
                                    <span>Locating {pendingCount} personnel...</span>
                                </div>
                            )}
                            {geocodingStatus === 'error' && errorCount > 0 && (
                                <div className="bg-red-50/90 backdrop-blur px-3 py-2 rounded-lg shadow-md border border-red-200 text-xs text-red-600 flex items-center gap-2 pointer-events-auto">
                                    <span>⚠️ Failed to locate {errorCount} addresses</span>
                                </div>
                            )}
                            {geocodingStatus === 'completed' && errorCount === 0 && (
                                <div className="bg-emerald-50/90 backdrop-blur px-3 py-2 rounded-lg shadow-md border border-emerald-200 text-xs text-emerald-600 flex items-center gap-2 pointer-events-auto animate-out fade-out duration-1000 delay-3000 fill-mode-forwards">
                                    <span>✓ All locations updated</span>
                                </div>
                            )}
                            <div className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-500 pointer-events-auto">
                                Showing {filteredPersonnel.length} personnel in current view
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Personnel Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-semibold text-slate-900">Add New Personnel</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    &times;
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        placeholder="e.g. Jane Doe"
                                        value={newPersonnel.fullName || ''}
                                        onChange={e => setNewPersonnel({ ...newPersonnel, fullName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                        placeholder="e.g. jane@axis.com"
                                        value={newPersonnel.email || ''}
                                        onChange={e => setNewPersonnel({ ...newPersonnel, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                            value={newPersonnel.role}
                                            onChange={e => setNewPersonnel({ ...newPersonnel, role: e.target.value as PersonnelRole })}
                                        >
                                            <option value={PersonnelRole.PILOT}>Pilot</option>
                                            <option value={PersonnelRole.TECHNICIAN}>Technician</option>
                                            <option value={PersonnelRole.BOTH}>Both</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                            value={newPersonnel.status}
                                            onChange={e => setNewPersonnel({ ...newPersonnel, status: e.target.value as any })}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="On Leave">On Leave</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Daily Pay Rate ($)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                            placeholder="e.g. 450.00"
                                            value={newPersonnel.dailyPayRate || ''}
                                            onChange={e => setNewPersonnel({ ...newPersonnel, dailyPayRate: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Home Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                            placeholder="e.g. 123 Main St, Austin, TX"
                                            value={newPersonnel.homeAddress || ''}
                                            onChange={e => setNewPersonnel({ ...newPersonnel, homeAddress: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Travel Distance (Miles)</label>
                                    <div className="relative">
                                        <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                            placeholder="e.g. 50"
                                            value={newPersonnel.maxTravelDistance || ''}
                                            onChange={e => setNewPersonnel({ ...newPersonnel, maxTravelDistance: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
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
                                    onClick={handleAddPersonnel}
                                    disabled={!newPersonnel.fullName || !newPersonnel.email}
                                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                                >
                                    Save Personnel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Personnel Detail Modal */}
            {
                isDetailModalOpen && selectedPerson && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 shadow-inner">
                                        {selectedPerson.fullName.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{selectedPerson.fullName}</h3>
                                        <p className="text-[10px] text-slate-500 font-mono tracking-wider">ID: {selectedPerson.id.substring(0, 6).toUpperCase()}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-full transition-all">
                                    &times;
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {isEditMode ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                value={editedPerson?.fullName || ''}
                                                onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, fullName: e.target.value } : null)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Role</label>
                                                <select
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                    value={editedPerson?.role}
                                                    onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, role: e.target.value as PersonnelRole } : null)}
                                                >
                                                    <option value={PersonnelRole.PILOT}>Pilot</option>
                                                    <option value={PersonnelRole.TECHNICIAN}>Technician</option>
                                                    <option value={PersonnelRole.BOTH}>Both</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                                                <select
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                    value={editedPerson?.status}
                                                    onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, status: e.target.value as any } : null)}
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="On Leave">On Leave</option>
                                                    <option value="Inactive">Inactive</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                                            <input
                                                type="email"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                value={editedPerson?.email || ''}
                                                onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, email: e.target.value } : null)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                value={editedPerson?.phone || ''}
                                                onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, phone: e.target.value } : null)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Certification Level</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                value={editedPerson?.certificationLevel || ''}
                                                onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, certificationLevel: e.target.value } : null)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Home Address</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                    value={editedPerson?.homeAddress || ''}
                                                    onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, homeAddress: e.target.value } : null)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Daily Pay Rate ($)</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                    value={editedPerson?.dailyPayRate || ''}
                                                    onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, dailyPayRate: parseFloat(e.target.value) || 0 } : null)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Max Travel Distance (Miles)</label>
                                            <div className="relative">
                                                <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                    value={editedPerson?.maxTravelDistance || ''}
                                                    onChange={e => setEditedPerson(editedPerson ? { ...editedPerson, maxTravelDistance: parseInt(e.target.value) || 0 } : null)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</p>
                                                <div className="flex items-center gap-2">
                                                    {selectedPerson.role === PersonnelRole.PILOT ? <BadgeCheck className="w-4 h-4 text-blue-500" /> : <HardHat className="w-4 h-4 text-amber-500" />}
                                                    <span className="text-sm font-medium text-slate-700">{selectedPerson.role}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${selectedPerson.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${selectedPerson.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                    {selectedPerson.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4 border-t border-slate-100">
                                            <div className="flex items-center gap-4 group">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                                                    <Mail className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Email Address</p>
                                                    <p className="text-sm font-medium text-slate-700">{selectedPerson.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                                                    <Phone className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Phone Number</p>
                                                    <p className="text-sm font-medium text-slate-700">{selectedPerson.phone || 'Not provided'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Certifications</p>
                                                    <p className="text-sm font-medium text-slate-700">{selectedPerson.certificationLevel}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                                                    <DollarSign className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Daily Pay Rate</p>
                                                    <p className="text-sm font-medium text-slate-700">${selectedPerson.dailyPayRate?.toLocaleString() || '0.00'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-cyan-600 group-hover:bg-cyan-50 transition-colors">
                                                    <MapPin className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Home Base</p>
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                                                            {selectedPerson.homeAddress || 'No address on file'}
                                                        </p>
                                                        {selectedPerson.homeAddress && (
                                                            <a
                                                                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(selectedPerson.homeAddress)}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                                            >
                                                                <Navigation className="w-3 h-3" /> Get Directions
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-purple-600 group-hover:bg-purple-50 transition-colors">
                                                    <MapIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Max Travel</p>
                                                    <p className="text-sm font-medium text-slate-700">{selectedPerson.maxTravelDistance ? `${selectedPerson.maxTravelDistance} Miles` : 'Not specified'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 group">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50 transition-colors">
                                                    <Send className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Onboarding</p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-slate-700">
                                                            {selectedPerson.onboarding_status === 'completed' ? 'Completed' :
                                                                selectedPerson.onboarding_status === 'sent' ? 'Sent' :
                                                                    selectedPerson.onboarding_status === 'in_progress' ? 'In Progress' : 'Not Sent'}
                                                        </span>
                                                        {!['completed', 'in_progress'].includes(selectedPerson.onboarding_status || '') && (
                                                            <button
                                                                onClick={() => handleSendOnboarding(selectedPerson.id)}
                                                                disabled={sendingOnboarding}
                                                                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
                                                            >
                                                                {sendingOnboarding ? 'Sending...' : 'Send Package'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                {isEditMode ? (
                                    <>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUpdatePersonnel}
                                            className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                                        >
                                            Save Changes
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleDeletePersonnel(selectedPerson.id)}
                                            className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 uppercase tracking-wider"
                                        >
                                            Remove From Registry
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEditMode(true)}
                                                className="px-4 py-2 text-sm font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all shadow-sm"
                                            >
                                                Edit Personnel
                                            </button>
                                            <button
                                                onClick={() => setIsDetailModalOpen(false)}
                                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            >
                                                Close View
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div >
                    </div >
                )}

            {/* Onboarding Prompt Modal */}
            {
                onboardingPromptOpen.isOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Send Welcome Package?</h3>
                                <p className="text-sm text-slate-600 mb-6">
                                    Would you like to send the onboarding welcome package (NDA, W-9, etc.) to <strong>{onboardingPromptOpen.name}</strong> now?
                                </p>

                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setOnboardingPromptOpen({ isOpen: false })}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        Not Now
                                    </button>
                                    <button
                                        onClick={() => onboardingPromptOpen.personnelId && handleSendOnboarding(onboardingPromptOpen.personnelId)}
                                        disabled={sendingOnboarding}
                                        className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm disabled:opacity-70"
                                    >
                                        {sendingOnboarding ? 'Sending...' : 'Send Package'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PersonnelTracker;
