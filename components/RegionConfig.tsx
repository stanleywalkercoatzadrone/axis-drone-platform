import React, { useState, useEffect, useCallback } from 'react';
import {
    Globe, Loader, Users, UserCheck, UserPlus, UserMinus,
    Search, CheckCircle, XCircle, ChevronDown, ChevronUp,
    Zap, ZapOff
} from 'lucide-react';
import { Country, Region } from '../types';
import { isoToFlag } from '../src/utils/countryFlag';

interface Personnel {
    id: string;
    name?: string;
    fullName?: string;
    email: string;
    role: string;
    status: string;
}

interface RegionConfigProps {
    apiClient: any;
}

const REGION_ORDER: Record<string, number> = {
    'North America':   1,
    'Central America': 2,
    'South America':   3,
    'Caribbean':       4,
    'Europe':          5,
    'Asia Pacific':    6,
};

function pilotName(p: Personnel) {
    return p.fullName || p.name || 'Unknown';
}

function roleBadge(role: string) {
    const r = (role || '').toLowerCase();
    if (r === 'pilot')      return 'bg-blue-500/15 text-blue-300 border border-blue-500/25';
    if (r === 'technician') return 'bg-violet-500/15 text-violet-300 border border-violet-500/25';
    return 'bg-white/8 text-slate-300 border border-white/10';
}

const RegionConfig: React.FC<RegionConfigProps> = ({ apiClient }) => {
    const [regions, setRegions]   = useState<Region[]>([]);
    const [countries, setCountries] = useState<Country[]>([]);
    const [loading, setLoading]   = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [bulkWorking, setBulkWorking] = useState(false);

    // Pilot assignment state
    const [expandedCountry, setExpandedCountry]   = useState<string | null>(null);
    const [countryPilots, setCountryPilots]       = useState<Record<string, Personnel[]>>({});
    const [availablePilots, setAvailablePilots]   = useState<Record<string, Personnel[]>>({});
    const [loadingPilots, setLoadingPilots]       = useState<string | null>(null);
    const [movingPilot, setMovingPilot]           = useState<string | null>(null);
    const [bulkAssigning, setBulkAssigning]       = useState<string | null>(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [regionsRes, countriesRes] = await Promise.all([
                apiClient.get('/regions/regions'),
                apiClient.get('/regions/countries')
            ]);
            const fetchedRegions: any[] = regionsRes.data?.data || regionsRes.data || [];
            const sorted = [...fetchedRegions].sort(
                (a, b) => (REGION_ORDER[a.name] || 99) - (REGION_ORDER[b.name] || 99)
            );
            setRegions(sorted);
            setCountries(countriesRes.data?.data || countriesRes.data || []);
        } catch (err) {
            console.error('RegionConfig fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (country: any) => {
        const isoCode = country.iso_code || country.isoCode;
        if (isoCode === 'US') {
            alert('The United States cannot be disabled.');
            return;
        }
        const newStatus = country.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
        setTogglingId(country.id);
        try {
            await apiClient.patch(`/regions/countries/${country.id}/status`, { status: newStatus });
            setCountries(prev => prev.map(c => (c as any).id === country.id ? { ...c, status: newStatus } : c));
        } catch {
            alert('Failed to update country status');
        } finally {
            setTogglingId(null);
        }
    };

    const handleBulkStatus = async (targetStatus: 'ENABLED' | 'DISABLED', regionId?: string) => {
        setBulkWorking(true);
        try {
            const toChange = countries.filter((c: any) => {
                const matches = !regionId || c.region_id === regionId;
                const notUS   = (c.iso_code || c.isoCode) !== 'US';
                return matches && notUS && c.status !== targetStatus;
            });
            await Promise.all(
                toChange.map((c: any) =>
                    apiClient.patch(`/regions/countries/${c.id}/status`, { status: targetStatus })
                )
            );
            setCountries(prev => prev.map((c: any) => {
                const matches = !regionId || (c as any).region_id === regionId;
                const notUS   = (c.iso_code || c.isoCode) !== 'US';
                if (matches && notUS) return { ...c, status: targetStatus };
                return c;
            }));
        } catch {
            alert('Some countries could not be updated');
        } finally {
            setBulkWorking(false);
        }
    };

    const loadCountryPilots = useCallback(async (countryId: string) => {
        setLoadingPilots(countryId);
        try {
            const [assignedRes, availableRes] = await Promise.all([
                apiClient.get(`/regions/countries/${countryId}/pilots`),
                apiClient.get(`/regions/countries/${countryId}/available-pilots`)
            ]);
            setCountryPilots(prev  => ({ ...prev,  [countryId]: assignedRes.data?.data  || [] }));
            setAvailablePilots(prev => ({ ...prev, [countryId]: availableRes.data?.data || [] }));
        } catch (err) {
            console.error('Failed to load country pilots:', err);
        } finally {
            setLoadingPilots(null);
        }
    }, [apiClient]);

    const handleExpandCountry = (countryId: string) => {
        if (expandedCountry === countryId) {
            setExpandedCountry(null);
        } else {
            setExpandedCountry(countryId);
            loadCountryPilots(countryId);
        }
    };

    const handleAssignPilot = async (countryId: string, pilot: Personnel) => {
        setMovingPilot(pilot.id);
        try {
            await apiClient.post(`/regions/countries/${countryId}/pilots`, { personnelId: pilot.id });
            setCountryPilots(prev  => ({ ...prev,  [countryId]: [...(prev[countryId] || []),  pilot].sort((a, b) => pilotName(a).localeCompare(pilotName(b))) }));
            setAvailablePilots(prev => ({ ...prev, [countryId]: (prev[countryId] || []).filter(p => p.id !== pilot.id) }));
        } catch { alert('Failed to assign pilot'); }
        finally { setMovingPilot(null); }
    };

    const handleRemovePilot = async (countryId: string, pilot: Personnel) => {
        setMovingPilot(pilot.id);
        try {
            await apiClient.delete(`/regions/countries/${countryId}/pilots/${pilot.id}`);
            setAvailablePilots(prev  => ({ ...prev,  [countryId]: [...(prev[countryId] || []),  pilot].sort((a, b) => pilotName(a).localeCompare(pilotName(b))) }));
            setCountryPilots(prev => ({ ...prev, [countryId]: (prev[countryId] || []).filter(p => p.id !== pilot.id) }));
        } catch { alert('Failed to remove pilot'); }
        finally { setMovingPilot(null); }
    };

    const handleAssignAll = async (countryId: string) => {
        const all = availablePilots[countryId] || [];
        if (all.length === 0) return;
        setBulkAssigning(countryId);
        try {
            await Promise.all(all.map(p => apiClient.post(`/regions/countries/${countryId}/pilots`, { personnelId: p.id })));
            setCountryPilots(prev  => ({ ...prev,  [countryId]: [...(prev[countryId] || []), ...all].sort((a, b) => pilotName(a).localeCompare(pilotName(b))) }));
            setAvailablePilots(prev => ({ ...prev, [countryId]: [] }));
        } catch { alert('Failed to assign all pilots'); }
        finally { setBulkAssigning(null); }
    };

    const handleRemoveAll = async (countryId: string) => {
        const all = countryPilots[countryId] || [];
        if (all.length === 0) return;
        setBulkAssigning(countryId);
        try {
            await Promise.all(all.map(p => apiClient.delete(`/regions/countries/${countryId}/pilots/${p.id}`)));
            setAvailablePilots(prev  => ({ ...prev,  [countryId]: [...(prev[countryId] || []), ...all].sort((a, b) => pilotName(a).localeCompare(pilotName(b))) }));
            setCountryPilots(prev => ({ ...prev, [countryId]: [] }));
        } catch { alert('Failed to remove all pilots'); }
        finally { setBulkAssigning(null); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader className="w-6 h-6 animate-spin mr-3" />
                Loading regions…
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header + global bulk actions */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            Geographic Coverage
                        </div>
                        <h2 className="text-xl font-semibold text-white">Regions &amp; Countries</h2>
                        <p className="text-sm text-slate-400">Manage operating regions, activate countries, and assign pilots.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleBulkStatus('ENABLED')}
                            disabled={bulkWorking}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                        >
                            <Zap className="w-4 h-4" />
                            Activate All
                        </button>
                        <button
                            onClick={() => handleBulkStatus('DISABLED')}
                            disabled={bulkWorking}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                        >
                            <ZapOff className="w-4 h-4" />
                            Deactivate All
                        </button>
                    </div>
                </div>
            </div>

            {/* Region sections */}
            {regions.map(region => {
                const regionCountries = countries.filter((c: any) => c.region_id === region.id);
                const enabledCount = regionCountries.filter((c: any) => c.status === 'ENABLED').length;

                return (
                    <div key={region.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg backdrop-blur-sm">
                        {/* Region header */}
                        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <Globe className="w-4 h-4 text-slate-400" />
                                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">{region.name}</h3>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                    {enabledCount}/{regionCountries.length} active
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleBulkStatus('ENABLED', region.id)}
                                    disabled={bulkWorking}
                                    className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/15 transition disabled:opacity-40"
                                >
                                    Activate All
                                </button>
                                <button
                                    onClick={() => handleBulkStatus('DISABLED', region.id)}
                                    disabled={bulkWorking}
                                    className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-1 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/15 transition disabled:opacity-40"
                                >
                                    Deactivate All
                                </button>
                            </div>
                        </div>

                        {/* Country rows */}
                        <div className="divide-y divide-white/5">
                            {regionCountries.length === 0 && (
                                <p className="px-6 py-4 text-sm text-slate-500 italic">No countries in this region.</p>
                            )}
                            {regionCountries.map((country: any) => {
                                const isoCode    = country.iso_code || country.isoCode;
                                const isExpanded = expandedCountry === country.id;
                                const assigned   = countryPilots[country.id]   || [];
                                const available  = availablePilots[country.id] || [];

                                return (
                                    <div key={country.id}>
                                        {/* Country row */}
                                        <div className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.03] transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl leading-none w-7 text-center">{isoToFlag(isoCode)}</span>
                                                <div>
                                                    <span className="text-sm font-semibold text-white">{country.name}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] text-slate-500">{country.currency}</span>
                                                        <span className="text-[11px] text-slate-600">·</span>
                                                        <span className="text-[11px] text-slate-500">{country.units_of_measurement}</span>
                                                        {assigned.length > 0 && !isExpanded && (
                                                            <>
                                                                <span className="text-[11px] text-slate-600">·</span>
                                                                <span className="text-[11px] text-blue-400 font-semibold">{assigned.length} pilot{assigned.length !== 1 ? 's' : ''}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                                {/* Status pill */}
                                                {country.status === 'ENABLED' ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Off
                                                    </span>
                                                )}

                                                {/* Pilots button */}
                                                <button
                                                    onClick={() => handleExpandCountry(country.id)}
                                                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all
                                                        ${isExpanded
                                                            ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                                                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                                                >
                                                    <Users className="w-3.5 h-3.5" />
                                                    Pilots
                                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>

                                                {/* Enable/disable toggle */}
                                                <button
                                                    onClick={() => handleToggleStatus(country)}
                                                    disabled={togglingId === country.id || isoCode === 'US'}
                                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                                                        ${country.status === 'ENABLED' ? 'bg-blue-600' : 'bg-white/10'}
                                                        ${(togglingId === country.id || isoCode === 'US') ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                >
                                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                        ${country.status === 'ENABLED' ? 'translate-x-4' : 'translate-x-0'}`}
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Pilot assignment panel */}
                                        {isExpanded && (
                                            <div className="border-t border-blue-500/15 bg-blue-500/[0.04] px-6 py-5">
                                                {loadingPilots === country.id ? (
                                                    <div className="flex items-center justify-center py-8 text-slate-400">
                                                        <Loader className="w-5 h-5 animate-spin mr-2" />
                                                        Loading pilots…
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-4">

                                                        {/* LEFT — Assigned */}
                                                        <div className="rounded-xl border border-white/10 bg-slate-900/70 overflow-hidden">
                                                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                                                <div className="flex items-center gap-2">
                                                                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                                                                        Assigned ({assigned.length})
                                                                    </span>
                                                                </div>
                                                                {assigned.length > 0 && (
                                                                    <button
                                                                        onClick={() => handleRemoveAll(country.id)}
                                                                        disabled={bulkAssigning === country.id}
                                                                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-lg bg-rose-500/8 hover:bg-rose-500/15 transition disabled:opacity-40"
                                                                    >
                                                                        {bulkAssigning === country.id ? '…' : 'Remove All'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                                                                {assigned.length === 0 ? (
                                                                    <div className="flex flex-col items-center justify-center py-8 text-slate-600 text-xs">
                                                                        <Users className="w-6 h-6 mb-1 opacity-40" />
                                                                        No pilots assigned
                                                                    </div>
                                                                ) : assigned.map(pilot => (
                                                                    <div key={pilot.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] group transition-colors">
                                                                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center text-xs font-black text-blue-300 flex-shrink-0">
                                                                            {pilotName(pilot).charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-semibold text-white truncate">{pilotName(pilot)}</p>
                                                                            <p className="text-[10px] text-slate-500 truncate">{pilot.email}</p>
                                                                        </div>
                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${roleBadge(pilot.role)}`}>
                                                                            {pilot.role}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => handleRemovePilot(country.id, pilot)}
                                                                            disabled={movingPilot === pilot.id}
                                                                            title="Remove from country"
                                                                            className="ml-1 p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                                        >
                                                                            {movingPilot === pilot.id
                                                                                ? <Loader className="w-3 h-3 animate-spin" />
                                                                                : <UserMinus className="w-3 h-3" />
                                                                            }
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* RIGHT — Available */}
                                                        <div className="rounded-xl border border-white/10 bg-slate-900/70 overflow-hidden">
                                                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                                                <div className="flex items-center gap-2">
                                                                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
                                                                        Available ({available.length})
                                                                    </span>
                                                                </div>
                                                                {available.length > 0 && (
                                                                    <button
                                                                        onClick={() => handleAssignAll(country.id)}
                                                                        disabled={bulkAssigning === country.id}
                                                                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-lg bg-emerald-500/8 hover:bg-emerald-500/15 transition disabled:opacity-40"
                                                                    >
                                                                        {bulkAssigning === country.id ? '…' : 'Assign All'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                                                                {available.length === 0 ? (
                                                                    <div className="flex flex-col items-center justify-center py-8 text-slate-600 text-xs">
                                                                        <CheckCircle className="w-6 h-6 mb-1 opacity-40" />
                                                                        All pilots assigned
                                                                    </div>
                                                                ) : available.map(pilot => (
                                                                    <button
                                                                        key={pilot.id}
                                                                        onClick={() => handleAssignPilot(country.id, pilot)}
                                                                        disabled={movingPilot === pilot.id}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-500/[0.06] transition-colors text-left group"
                                                                    >
                                                                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black text-slate-400 flex-shrink-0 group-hover:bg-emerald-500/15 group-hover:text-emerald-300 transition-colors">
                                                                            {pilotName(pilot).charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-semibold text-slate-300 truncate group-hover:text-white transition-colors">{pilotName(pilot)}</p>
                                                                            <p className="text-[10px] text-slate-600 truncate">{pilot.email}</p>
                                                                        </div>
                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${roleBadge(pilot.role)}`}>
                                                                            {pilot.role}
                                                                        </span>
                                                                        {movingPilot === pilot.id
                                                                            ? <Loader className="w-3 h-3 text-emerald-400 animate-spin flex-shrink-0" />
                                                                            : <UserPlus className="w-3 h-3 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                                                                        }
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default RegionConfig;
