import React, { useState, useEffect, useRef } from 'react';
import {
    Users, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw,
    ChevronDown, Globe, Award, Briefcase, Phone, Mail, MapPin,
    ExternalLink, MessageSquare, Loader2, Filter, Plane,
    Share2, Copy, Check, QrCode, X, Trash2
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { useCountry } from '../context/CountryContext';

interface Application {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    country?: string;
    city?: string;
    years_exp?: number;
    certifications?: string[];
    specializations?: string[];
    drone_equipment?: string[];      // array — multi-select
    bio?: string;
    portfolio_url?: string;
    terrestrial_thermal?: boolean;
    travel_distance_km?: number;
    status: 'pending' | 'approved' | 'rejected' | 'waitlisted';
    admin_notes?: string;
    created_at: string;
    reviewed_at?: string;
}

const STATUS_CONFIG = {
    pending:    { label: 'Pending',    bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/30',  icon: Clock },
    approved:   { label: 'Approved',   bg: 'bg-emerald-500/15',text: 'text-emerald-300',border: 'border-emerald-500/30',icon: CheckCircle },
    rejected:   { label: 'Rejected',   bg: 'bg-red-500/15',    text: 'text-red-300',    border: 'border-red-500/30',    icon: XCircle },
    waitlisted: { label: 'Waitlisted', bg: 'bg-slate-500/15',  text: 'text-slate-300',  border: 'border-slate-500/30',  icon: AlertCircle },
};

const COUNTRY_FLAGS: Record<string, string> = {
    US:'🇺🇸', MX:'🇲🇽', CA:'🇨🇦', BR:'🇧🇷', GB:'🇬🇧', AU:'🇦🇺',
    FR:'🇫🇷', DE:'🇩🇪', ES:'🇪🇸', JP:'🇯🇵', KR:'🇰🇷', IN:'🇮🇳',
    AE:'🇦🇪', SG:'🇸🇬', ZA:'🇿🇦', NG:'🇳🇬', CL:'🇨🇱', CO:'🇨🇴',
    AR:'🇦🇷', NL:'🇳🇱',
};

export const PilotNetworkAdmin: React.FC = () => {
    const { activeCountryId } = useCountry();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'waitlisted'>('pending');
    const [selected, setSelected] = useState<Application | null>(null);
    const [notes, setNotes] = useState('');
    const [updating, setUpdating] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ message: string; outcome: string } | null>(null);
    const [error, setError] = useState('');
    const [showShare, setShowShare] = useState(false);
    const [copied, setCopied] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const shareRef = useRef<HTMLDivElement>(null);

    const SIGNUP_URL = 'https://axisplatform.app/join';

    const copyLink = () => {
        navigator.clipboard.writeText(SIGNUP_URL).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Close share popover on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
                setShowShare(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const params = activeCountryId ? { countryId: activeCountryId } : {};
            const res = await apiClient.get('/pilot-network/applications', { params });
            setApplications(res.data.data || []);
        } catch (e) {
            setError('Failed to load applications.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchApplications(); }, [activeCountryId]);

    const [outcome, setOutcome] = useState<{ status: string; name: string } | null>(null);

    const updateStatus = async (id: string, status: string) => {
        setUpdating(true);
        try {
            const app = applications.find(a => a.id === id);
            await apiClient.put(`/pilot-network/applications/${id}/status`, { status, adminNotes: notes });
            setApplications(prev => prev.map(a => a.id === id ? { ...a, status: status as any, admin_notes: notes } : a));
            if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: status as any, admin_notes: notes } : null);
            setOutcome({ status, name: app?.full_name || 'Applicant' });
            setTimeout(() => setOutcome(null), 6000);
        } catch (e) {
            alert('Failed to update status.');
        } finally {
            setUpdating(false);
        }
    };

    const syncProfile = async (id: string) => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await apiClient.post(`/pilot-network/applications/${id}/sync-profile`);
            setSyncResult({ message: res.data.message, outcome: res.data.outcome });
            setTimeout(() => setSyncResult(null), 7000);
        } catch (e: any) {
            alert(e.response?.data?.message || 'Sync failed.');
        } finally {
            setSyncing(false);
        }
    };

    const deleteApplication = async (id: string, name: string) => {
        if (!window.confirm(`Permanently delete ${name}'s application? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/pilot-network/applications/${id}`);
            setApplications(prev => prev.filter(a => a.id !== id));
            setSelected(null);
        } catch (e: any) {
            alert(e.response?.data?.message || 'Failed to delete application.');
        } finally {
            setDeleting(false);
        }
    };

    const filtered = applications.filter(a => filter === 'all' || a.status === filter);

    const counts = {
        all: applications.length,
        pending: applications.filter(a => a.status === 'pending').length,
        approved: applications.filter(a => a.status === 'approved').length,
        rejected: applications.filter(a => a.status === 'rejected').length,
        waitlisted: applications.filter(a => a.status === 'waitlisted').length,
    };

    return (
        <div className="flex flex-col bg-slate-950" style={{ minHeight: '100%' }}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Plane className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-wider">Pilot Network Applications</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{counts.pending} pending review · {counts.approved} approved</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">

                    {/* Share Link Button + Popover */}
                    <div className="relative" ref={shareRef}>
                        <button
                            onClick={() => setShowShare(s => !s)}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
                        >
                            <Share2 className="w-3.5 h-3.5" /> Share Signup Link
                        </button>

                        {showShare && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <Plane className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-black text-white">Pilot Signup Link</span>
                                    </div>
                                    <button onClick={() => setShowShare(false)} className="text-slate-500 hover:text-white">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* QR Code */}
                                <div className="flex justify-center py-4 bg-white mx-4 mt-4 rounded-xl">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(SIGNUP_URL)}&color=0f172a&bgcolor=ffffff`}
                                        alt="QR Code for pilot signup"
                                        className="w-40 h-40"
                                    />
                                </div>

                                {/* URL + Copy */}
                                <div className="px-4 py-4 space-y-3">
                                    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
                                        <span className="text-xs text-slate-300 flex-1 truncate font-mono">{SIGNUP_URL}</span>
                                        <button
                                            onClick={copyLink}
                                            className={`shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-all ${
                                                copied
                                                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
                                            }`}
                                        >
                                            {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                                        </button>
                                    </div>

                                    {/* Share via */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <a
                                            href={`mailto:?subject=Join the Axis Pilot Network&body=Apply to join the Axis Pilot Network:%0A${SIGNUP_URL}`}
                                            className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 hover:bg-slate-700 font-semibold transition-colors"
                                        >
                                            <Mail className="w-3.5 h-3.5" /> Email
                                        </a>
                                        <a
                                            href={`https://wa.me/?text=${encodeURIComponent('Join the Axis Pilot Network: ' + SIGNUP_URL)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 hover:bg-slate-700 font-semibold transition-colors"
                                        >
                                            <span className="text-base leading-none">💬</span> WhatsApp
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <a
                        href="/join"
                        target="_blank"
                        style={{ color: '#ffffff' }}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white hover:bg-slate-700 transition-colors font-semibold"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> View Public Page
                    </a>
                    <button
                        onClick={fetchApplications}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>
            </div>

            {/* Outcome toast */}
            {outcome && (
                <div className={`mx-6 mt-4 flex items-start gap-3 p-4 rounded-xl border animate-pulse-once ${
                    outcome.status === 'approved'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : outcome.status === 'rejected'
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-slate-800 border-slate-700'
                }`}>
                    <div className={`text-xl shrink-0 ${outcome.status === 'approved' ? 'text-emerald-400' : outcome.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                        {outcome.status === 'approved' ? '✓' : outcome.status === 'rejected' ? '✕' : '⟳'}
                    </div>
                    <div>
                        <p className={`text-sm font-bold ${outcome.status === 'approved' ? 'text-emerald-300' : outcome.status === 'rejected' ? 'text-red-300' : 'text-slate-200'}`}>
                            {outcome.status === 'approved'
                                ? `${outcome.name} has been approved`
                                : outcome.status === 'rejected'
                                ? `${outcome.name}'s application has been rejected`
                                : `${outcome.name} has been ${outcome.status}`}
                        </p>
                        {outcome.status === 'approved' && (
                            <p className="text-xs text-slate-400 mt-0.5">
                                Their application data has been pre-filled into a Pilot profile under <strong className="text-slate-200">Personnel → Pilots</strong>. Review and complete the profile there.
                            </p>
                        )}
                        {outcome.status === 'rejected' && (
                            <p className="text-xs text-slate-400 mt-0.5">Application marked as rejected. No personnel record was created.</p>
                        )}
                    </div>
                    <button onClick={() => setOutcome(null)} className="ml-auto text-slate-600 hover:text-slate-300 shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-1 px-6 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0 overflow-x-auto">
                {(['all', 'pending', 'approved', 'waitlisted', 'rejected'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            filter === tab
                                ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                    >
                        {tab === 'all' ? <Filter className="w-3 h-3" /> : null}
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{counts[tab]}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* List */}
                <div className="w-[380px] shrink-0 border-r border-slate-800 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                            <Users className="w-8 h-8 mb-2" />
                            <p className="text-xs">No {filter !== 'all' ? filter : ''} applications</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {filtered.map(app => {
                                const sc = STATUS_CONFIG[app.status];
                                const isSelected = selected?.id === app.id;
                                return (
                                    <button
                                        key={app.id}
                                        onClick={() => { setSelected(app); setNotes(app.admin_notes || ''); }}
                                        className={`w-full text-left px-4 py-4 transition-colors hover:bg-slate-900 ${isSelected ? 'bg-slate-900 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{app.full_name}</p>
                                                <p className="text-xs text-slate-400 truncate">{app.email}</p>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    {app.country && (
                                                        <span className="text-xs text-slate-400">{COUNTRY_FLAGS[app.country] || '🌍'} {app.city || app.country}</span>
                                                    )}
                                                    {app.years_exp !== undefined && (
                                                        <span className="text-xs text-slate-500">{app.years_exp}yr exp</span>
                                                    )}
                                                </div>
                                                {(app.specializations || []).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {(app.specializations || []).slice(0, 2).map(s => (
                                                            <span key={s} className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20 font-semibold">{s}</span>
                                                        ))}
                                                        {(app.specializations || []).length > 2 && (
                                                            <span className="text-[9px] text-slate-500">+{(app.specializations || []).length - 2}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="shrink-0">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                                                    {sc.label}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-2">
                                            {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {selected ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Applicant Header */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-black text-white">{selected.full_name}</h3>
                                <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selected.email}</span>
                                    {selected.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selected.phone}</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    {selected.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selected.city}</span>}
                                    {selected.country && <span>{COUNTRY_FLAGS[selected.country] || '🌍'} {selected.country}</span>}
                                    {selected.years_exp !== undefined && <span><Briefcase className="w-3 h-3 inline mr-1" />{selected.years_exp} years exp</span>}
                                </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black uppercase ${STATUS_CONFIG[selected.status].bg} ${STATUS_CONFIG[selected.status].text} ${STATUS_CONFIG[selected.status].border}`}>
                                {selected.status}
                            </div>
                        </div>

                        {/* Terrestrial Thermal */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border ${
                            selected.terrestrial_thermal
                                ? 'bg-orange-500/10 border-orange-500/30'
                                : 'bg-slate-900 border-slate-800'
                        }`}>
                            <div>
                                <p className={`text-sm font-bold ${selected.terrestrial_thermal ? 'text-orange-300' : 'text-slate-500'}`}>
                                    Terrestrial Thermal Scanning
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">Ground-level thermal inspections</p>
                            </div>
                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                                selected.terrestrial_thermal
                                    ? 'bg-orange-500/20 border-orange-500/30 text-orange-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}>
                                {selected.terrestrial_thermal ? '✓ Willing' : 'Not Selected'}
                            </span>
                        </div>

                        {/* Travel Distance */}
                        {selected.travel_distance_km != null && (
                            <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-900 border-slate-800">
                                <div>
                                    <p className="text-sm font-bold text-slate-200">Willing to Travel</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Maximum travel distance for missions</p>
                                </div>
                                <span className="text-sm font-black text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg">
                                    {selected.travel_distance_km >= 500 ? '500+ km' : `${selected.travel_distance_km} km`}
                                </span>
                            </div>
                        )}

                        {/* Equipment — array */}
                        {(selected.drone_equipment || []).length > 0 && (
                            <InfoCard title="Equipment" icon={<Plane className="w-3.5 h-3.5 text-blue-400" />}>
                                <div className="flex flex-wrap gap-2">
                                    {(Array.isArray(selected.drone_equipment) ? selected.drone_equipment : [selected.drone_equipment]).filter(Boolean).map(e => (
                                        <span key={e} className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg font-semibold">{e}</span>
                                    ))}
                                </div>
                            </InfoCard>
                        )}

                        {/* Certs */}
                        {(selected.certifications || []).length > 0 && (
                            <InfoCard title="Certifications" icon={<Award className="w-3.5 h-3.5 text-emerald-400" />}>
                                <div className="flex flex-wrap gap-2">
                                    {(selected.certifications || []).map(c => (
                                        <span key={c} className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg font-semibold">{c}</span>
                                    ))}
                                </div>
                            </InfoCard>
                        )}

                        {/* Specializations */}
                        {(selected.specializations || []).length > 0 && (
                            <InfoCard title="Specializations" icon={<Briefcase className="w-3.5 h-3.5 text-violet-400" />}>
                                <div className="flex flex-wrap gap-2">
                                    {(selected.specializations || []).map(s => (
                                        <span key={s} className="text-xs px-2.5 py-1 bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-lg font-semibold">{s}</span>
                                    ))}
                                </div>
                            </InfoCard>
                        )}

                        {/* Bio */}
                        {selected.bio && (
                            <InfoCard title="About" icon={<MessageSquare className="w-3.5 h-3.5 text-amber-400" />}>
                                <p className="text-sm text-slate-300 leading-relaxed">{selected.bio}</p>
                            </InfoCard>
                        )}

                        {/* Portfolio */}
                        {selected.portfolio_url && (
                            <InfoCard title="Portfolio / Website" icon={<Globe className="w-3.5 h-3.5 text-cyan-400" />}>
                                <a href={selected.portfolio_url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1.5">
                                    {selected.portfolio_url} <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </InfoCard>
                        )}

                        {/* Admin Actions */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                            {/* Sync to Pilot Profile */}
                            <div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Pilot Profile Sync</p>
                                {syncResult && (
                                    <div className={`flex items-center gap-2 p-2.5 rounded-xl mb-2 text-xs font-semibold border ${
                                        syncResult.outcome === 'created'
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                            : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                    }`}>
                                        <span>{syncResult.outcome === 'created' ? '✓ Profile created' : '✓ Profile updated'}</span>
                                        <span className="text-slate-500 font-normal ml-1">— {syncResult.message}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => syncProfile(selected.id)}
                                    disabled={syncing}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all"
                                >
                                    {syncing
                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                                        : <><RefreshCw className="w-3.5 h-3.5" /> Sync to Pilot Profile</>}
                                </button>
                                <p className="text-[10px] text-slate-600 mt-1.5 text-center">Pushes all application data → Personnel dashboard</p>
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                                <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-3">Review Decision</h4>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Admin Notes (optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Notes for internal records..."
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => updateStatus(selected.id, 'approved')}
                                    disabled={updating || selected.status === 'approved'}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all"
                                >
                                    {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                    Approve
                                </button>
                                <button
                                    onClick={() => updateStatus(selected.id, 'waitlisted')}
                                    disabled={updating || selected.status === 'waitlisted'}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 font-bold rounded-xl text-xs transition-all"
                                >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Waitlist
                                </button>
                                <button
                                    onClick={() => updateStatus(selected.id, 'rejected')}
                                    disabled={updating || selected.status === 'rejected'}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-50 text-red-300 font-bold rounded-xl text-xs transition-all"
                                >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Reject
                                </button>
                                <button
                                    onClick={() => updateStatus(selected.id, 'pending')}
                                    disabled={updating || selected.status === 'pending'}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-50 text-amber-300 font-bold rounded-xl text-xs transition-all"
                                >
                                    <Clock className="w-3.5 h-3.5" />
                                    Reset Pending
                                </button>
                            </div>
                            </div>

                            {/* Danger Zone — Delete */}
                            <div className="border-t border-slate-800 pt-4">
                                <button
                                    onClick={() => deleteApplication(selected.id, selected.full_name)}
                                    disabled={deleting}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 disabled:opacity-50 text-red-400 font-bold rounded-xl text-xs transition-all"
                                >
                                    {deleting
                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</>
                                        : <><Trash2 className="w-3.5 h-3.5" /> Delete Application</>}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-600">
                        <div className="text-center">
                            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">Select an application to review</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
            {icon}
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
        </div>
        <div className="p-4">{children}</div>
    </div>
);
