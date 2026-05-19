/**
 * PilotComplianceView.tsx
 * Self-service panel for pilots to:
 *  - View / update their banking / direct-deposit info
 *  - Upload compliance documents with Gemini AI auto-detection
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Landmark, FileText, UploadCloud, CheckCircle, AlertCircle,
    Loader2, Eye, ShieldCheck, Calendar, RefreshCw, Download,
    CreditCard, Lock, Building2, Hash, AlertTriangle, X, Sparkles,
    BadgeCheck, ClipboardList, MapPin, Phone, Navigation, Pencil
} from 'lucide-react';
import apiClient from '../../../services/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BankingInfo {
    bank_name: string;
    account_number: string;
    routing_number: string;
    account_type: string;
    updated_at?: string;
}

interface PilotDocument {
    id: string;
    name: string;
    url: string;
    category: string;
    expirationDate?: string;
    aiMetadata?: {
        documentType?: string;
        expirationDate?: string;
        holderName?: string;
        issuer?: string;
        confidence?: number;
    };
    createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mask(val: string, show = 4) {
    if (!val) return '—';
    return '•'.repeat(Math.max(0, val.length - show)) + val.slice(-show);
}

function expiryColor(dateStr?: string) {
    if (!dateStr) return 'text-slate-500';
    const d = new Date(dateStr);
    const days = (d.getTime() - Date.now()) / 86400000;
    if (days < 0)   return 'text-red-400';
    if (days < 30)  return 'text-orange-400';
    if (days < 90)  return 'text-yellow-400';
    return 'text-emerald-400';
}

function expiryLabel(dateStr?: string) {
    if (!dateStr) return 'No expiry';
    const d = new Date(dateStr);
    const days = Math.round((d.getTime() - Date.now()) / 86400000);
    if (days < 0)   return `Expired ${Math.abs(days)}d ago`;
    if (days === 0) return 'Expires today';
    if (days < 30)  return `Expires in ${days}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Profile Section ───────────────────────────────────────────────────────────

const ProfileSection: React.FC = () => {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [toast, setToast]     = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
    const [form, setForm]       = useState({ homeAddress: '', mailingAddress: '', sameAsHome: true, phone: '', maxTravelDistance: 50 });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/pilot/secure/me/profile');
            const d = r.data.data;
            setProfile(d);
            if (d) setForm({
                homeAddress: d.homeAddress || '',
                mailingAddress: '',
                sameAsHome: true,
                phone: d.phone || '',
                maxTravelDistance: d.maxTravelDistance || 50,
            });
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await apiClient.patch('/pilot/secure/me/profile', {
                homeAddress: form.homeAddress,
                phone: form.phone,
                maxTravelDistance: form.maxTravelDistance,
            });
            setToast({ type: 'ok', msg: 'Profile updated.' });
            setEditing(false);
            load();
        } catch {
            setToast({ type: 'err', msg: 'Failed to save. Try again.' });
        } finally { setSaving(false); }
    };

    const travelLabel = (mi: number) => {
        if (mi >= 500) return 'Nationwide';
        if (mi >= 200) return `${mi} mi — Regional`;
        if (mi >= 100) return `${mi} mi — Multi-state`;
        return `${mi} mi — Local`;
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <MapPin size={16} className="text-sky-400" />
                </div>
                <div className="flex-1">
                    <h2 className="text-sm font-black text-slate-100">Address &amp; Travel</h2>
                    <p className="text-[10px] text-slate-500">Residential address &amp; deployment radius</p>
                </div>
                {!editing && !loading && (
                    <button onClick={() => setEditing(true)}
                        className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-sky-400 transition-colors uppercase tracking-wider">
                        <Pencil size={11} /> Edit
                    </button>
                )}
            </div>

            <div className="p-5">
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-2"><Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading…</span></div>
                ) : !editing ? (
                    /* Read-only */
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <MapPin size={10} className="text-slate-500" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Residential Address</span>
                                </div>
                                <p className="text-sm text-slate-200 font-medium">{profile?.homeAddress || <span className="text-slate-600 italic">Not set</span>}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Phone size={10} className="text-slate-500" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Phone</span>
                                    </div>
                                    <p className="text-sm text-slate-200 font-medium font-mono">{profile?.phone || <span className="text-slate-600 italic">Not set</span>}</p>
                                </div>
                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Navigation size={10} className="text-slate-500" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Travel Radius</span>
                                    </div>
                                    <p className="text-sm text-slate-200 font-medium">{travelLabel(profile?.maxTravelDistance || 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Edit form */
                    <div className="space-y-4">
                        {/* Residential address */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Residential Address</label>
                            <textarea
                                value={form.homeAddress}
                                onChange={e => setForm(f => ({ ...f, homeAddress: e.target.value }))}
                                placeholder="Street, City, State, ZIP"
                                rows={2}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors resize-none"
                            />
                        </div>

                        {/* Mailing address toggle */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Mailing Address</label>
                                <button
                                    onClick={() => setForm(f => ({ ...f, sameAsHome: !f.sameAsHome }))}
                                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all ${
                                        form.sameAsHome
                                            ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-500'
                                    }`}>
                                    {form.sameAsHome ? '✓ Same as Residential' : 'Different'}
                                </button>
                            </div>
                            {!form.sameAsHome && (
                                <textarea
                                    value={form.mailingAddress}
                                    onChange={e => setForm(f => ({ ...f, mailingAddress: e.target.value }))}
                                    placeholder="Mailing address if different"
                                    rows={2}
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors resize-none"
                                />
                            )}
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+1 (555) 000-0000"
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                            />
                        </div>

                        {/* Travel radius slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Max Travel Distance</label>
                                <span className="text-xs font-black text-sky-400">{travelLabel(form.maxTravelDistance)}</span>
                            </div>
                            <input
                                type="range"
                                min={25} max={500} step={25}
                                value={form.maxTravelDistance}
                                onChange={e => setForm(f => ({ ...f, maxTravelDistance: Number(e.target.value) }))}
                                className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-sky-500"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                                <span>25 mi</span><span>250 mi</span><span>Nationwide</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 text-xs font-black rounded-xl transition-all">Cancel</button>
                            <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5">
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                )}

                {toast && (
                    <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${toast.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {toast.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                        {toast.msg}
                        <button onClick={() => setToast(null)} className="ml-auto"><X size={12} /></button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Onboarding Section ───────────────────────────────────────────────────────

interface OnboardingDoc {
    id: string;
    type: string;
    name: string;
    status: 'pending' | 'completed';
    completedAt?: string;
    templateUrl?: string;
}

interface OnboardingPkg {
    id: string;
    status: string;
    token: string;
    createdAt: string;
    expiresAt?: string;
    documents: OnboardingDoc[];
}

const OnboardingSection: React.FC = () => {
    const [pkg, setPkg]           = useState<OnboardingPkg | null>(null);
    const [loading, setLoading]   = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [toast, setToast]       = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/pilot/secure/me/onboarding');
            setPkg(r.data.data || null);
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const uploadDoc = async (docId: string, file: File) => {
        if (!pkg) return;
        setUploadingId(docId);
        try {
            const fd = new FormData();
            fd.append('document', file);
            fd.append('documentId', docId);
            await apiClient.post(`/onboarding/portal/${pkg.token}/upload`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setToast({ type: 'ok', msg: `${file.name} uploaded successfully.` });
            setPkg(p => p ? {
                ...p,
                documents: p.documents.map(d =>
                    d.id === docId ? { ...d, status: 'completed', completedAt: new Date().toISOString() } : d
                )
            } : null);
        } catch (e: any) {
            setToast({ type: 'err', msg: e?.response?.data?.message || 'Upload failed.' });
        } finally { setUploadingId(null); }
    };

    if (loading) return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-2 text-slate-500">
            <Loader2 size={15} className="animate-spin" /><span className="text-xs">Loading onboarding…</span>
        </div>
    );

    if (!pkg) return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <BadgeCheck size={16} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-sm font-black text-slate-100">Onboarding</h2>
                    <p className="text-[10px] text-slate-500">No onboarding package assigned yet</p>
                </div>
            </div>
        </div>
    );

    const completed = pkg.documents.filter(d => d.status === 'completed').length;
    const total = pkg.documents.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allDone = completed === total && total > 0;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <ClipboardList size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                    <h2 className="text-sm font-black text-slate-100">Onboarding Documents</h2>
                    <p className="text-[10px] text-slate-500">Required docs — download, sign &amp; upload</p>
                </div>
                <button onClick={load} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="p-5 space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progress</span>
                        <span className="text-[10px] font-black text-slate-400">{completed} / {total} completed</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                            className="h-2 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: allDone ? '#10b981' : 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }}
                        />
                    </div>
                </div>

                {/* All done banner */}
                {allDone && (
                    <div className="flex items-center gap-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
                        <BadgeCheck size={18} className="text-emerald-400 shrink-0" />
                        <div>
                            <p className="text-xs font-black text-emerald-300">Onboarding Complete!</p>
                            <p className="text-[10px] text-emerald-400/70">All required documents submitted. Our team will review shortly.</p>
                        </div>
                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${toast.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {toast.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                        {toast.msg}
                        <button onClick={() => setToast(null)} className="ml-auto"><X size={12} /></button>
                    </div>
                )}

                {/* Document list */}
                <div className="space-y-2">
                    {pkg.documents.map(doc => {
                        const done = doc.status === 'completed';
                        const isUploading = uploadingId === doc.id;
                        return (
                            <div key={doc.id} className={`flex items-start gap-3 rounded-xl p-3 border transition-all ${
                                done ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-slate-800/50 border-slate-700/50'
                            }`}>
                                <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'
                                }`}>
                                    {done ? <CheckCircle size={13} /> : <FileText size={13} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-bold truncate ${done ? 'text-emerald-300' : 'text-slate-200'}`}>{doc.name}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        {done
                                            ? `Submitted ${doc.completedAt ? new Date(doc.completedAt).toLocaleDateString() : ''}`
                                            : 'Download template → sign → upload'}
                                    </p>
                                    {doc.templateUrl && !done && (
                                        <a href={doc.templateUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-400 hover:text-blue-300">
                                            <Download size={9} /> Download Template
                                        </a>
                                    )}
                                </div>
                                {!done && (
                                    <label className={`shrink-0 cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                                        isUploading
                                            ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
                                            : 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20'
                                    }`}>
                                        {isUploading ? <Loader2 size={11} className="animate-spin" /> : <UploadCloud size={11} />}
                                        {isUploading ? 'Uploading…' : 'Upload'}
                                        <input type="file" className="hidden" disabled={!!uploadingId}
                                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(doc.id, f); }} />
                                    </label>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ── Banking Section ───────────────────────────────────────────────────────────

const BankingSection: React.FC = () => {
    const [info, setInfo]         = useState<BankingInfo | null>(null);
    const [loading, setLoading]   = useState(true);
    const [editing, setEditing]   = useState(false);
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
    const [form, setForm]         = useState({ bankName: '', accountNumber: '', routingNumber: '', accountType: 'checking' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/pilot/secure/me/banking');
            const d = r.data.data;
            setInfo(d);
            if (d) setForm({ bankName: d.bank_name || '', accountNumber: d.account_number || '', routingNumber: d.routing_number || '', accountType: d.account_type || 'checking' });
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await apiClient.post('/pilot/secure/me/banking', form);
            setToast({ type: 'ok', msg: 'Direct deposit info saved.' });
            setEditing(false);
            load();
        } catch {
            setToast({ type: 'err', msg: 'Failed to save. Please try again.' });
        } finally { setSaving(false); }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/80">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Landmark size={16} className="text-blue-400" />
                </div>
                <div className="flex-1">
                    <h2 className="text-sm font-black text-slate-100">Direct Deposit</h2>
                    <p className="text-[10px] text-slate-500">Secure banking & payment routing</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <Lock size={10} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Encrypted</span>
                </div>
            </div>

            <div className="p-5">
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-4"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading...</span></div>
                ) : !editing && info ? (
                    /* ── Read-only view ── */
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { icon: Building2, label: 'Bank', value: info.bank_name },
                                { icon: CreditCard, label: 'Account Type', value: info.account_type?.charAt(0).toUpperCase() + info.account_type?.slice(1) },
                                { icon: Hash, label: 'Account Number', value: mask(info.account_number) },
                                { icon: Hash, label: 'Routing Number', value: mask(info.routing_number, 4) },
                            ].map(({ icon: Icon, label, value }) => (
                                <div key={label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Icon size={10} className="text-slate-500" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-100 font-mono">{value || '—'}</p>
                                </div>
                            ))}
                        </div>
                        {info.updated_at && (
                            <p className="text-[10px] text-slate-600 mt-1">Last updated {new Date(info.updated_at).toLocaleDateString()}</p>
                        )}
                        <button onClick={() => setEditing(true)} className="w-full mt-2 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-black rounded-xl transition-all uppercase tracking-wider">
                            Update Banking Info
                        </button>
                    </div>
                ) : editing || !info ? (
                    /* ── Edit form ── */
                    <div className="space-y-3">
                        {[
                            { key: 'bankName', label: 'Bank Name', placeholder: 'e.g. Chase, Wells Fargo', type: 'text' },
                            { key: 'accountNumber', label: 'Account Number', placeholder: '••••••••••', type: 'text' },
                            { key: 'routingNumber', label: 'Routing Number', placeholder: '9-digit ABA number', type: 'text' },
                        ].map(({ key, label, placeholder, type }) => (
                            <div key={key}>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                                <input
                                    type={type}
                                    value={(form as any)[key]}
                                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                    placeholder={placeholder}
                                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                                />
                            </div>
                        ))}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Account Type</label>
                            <div className="flex gap-2">
                                {['checking', 'savings'].map(t => (
                                    <button key={t} onClick={() => setForm(f => ({ ...f, accountType: t }))}
                                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${form.accountType === t ? 'bg-blue-600/15 border-blue-500/30 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex items-start gap-2">
                            <Lock size={11} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-400/80">Banking data is encrypted at rest and only accessible by authorized payroll administrators.</p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            {info && <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 text-xs font-black rounded-xl transition-all">Cancel</button>}
                            <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5">
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                                {saving ? 'Saving…' : 'Save Securely'}
                            </button>
                        </div>
                    </div>
                ) : null}

                {/* Toast */}
                {toast && (
                    <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${toast.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {toast.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                        {toast.msg}
                        <button onClick={() => setToast(null)} className="ml-auto"><X size={12} /></button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Documents Section ─────────────────────────────────────────────────────────

const DocumentsSection: React.FC = () => {
    const [docs, setDocs]           = useState<PilotDocument[]>([]);
    const [loading, setLoading]     = useState(true);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
    const [aiResult, setAiResult]   = useState<any>(null);
    const fileRef                   = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver]   = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiClient.get('/pilot/secure/me/documents');
            setDocs(r.data.data || []);
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const upload = async (file: File) => {
        setUploading(true);
        setAiResult(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const r = await apiClient.post('/pilot/secure/me/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (r.data.document?.aiResult) setAiResult(r.data.document.aiResult);
            setToast({ type: 'ok', msg: `${file.name} uploaded & analyzed.` });
            load();
        } catch (e: any) {
            setToast({ type: 'err', msg: e?.response?.data?.message || 'Upload failed.' });
        } finally { setUploading(false); }
    };

    const handleFile = (file?: File | null) => { if (file) upload(file); };

    const docTypeColor = (type?: string) => {
        const t = (type || '').toLowerCase();
        if (t.includes('license') || t.includes('faa')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        if (t.includes('insurance') || t.includes('cert')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (t.includes('id') || t.includes('passport')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        if (t.includes('medical')) return 'text-red-400 bg-red-500/10 border-red-500/20';
        return 'text-slate-400 bg-slate-700/50 border-slate-600/30';
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/80">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <FileText size={16} className="text-violet-400" />
                </div>
                <div className="flex-1">
                    <h2 className="text-sm font-black text-slate-100">Compliance Documents</h2>
                    <p className="text-[10px] text-slate-500">Licenses, certificates &amp; ID — AI auto-detected</p>
                </div>
                <button onClick={load} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="p-5 space-y-4">
                {/* Drop Zone */}
                <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                    onClick={() => fileRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-violet-500/60 bg-violet-500/5' : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'}`}
                >
                    <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                        onChange={e => handleFile(e.target.files?.[0])} />
                    {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                                <Loader2 size={28} className="animate-spin text-violet-400" />
                                <Sparkles size={12} className="absolute -top-1 -right-1 text-yellow-400 animate-pulse" />
                            </div>
                            <p className="text-sm font-bold text-violet-300">AI analyzing document…</p>
                            <p className="text-[10px] text-slate-500">Gemini Vision is classifying document type, expiry & holder info</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-1">
                                <UploadCloud size={20} className="text-violet-400" />
                            </div>
                            <p className="text-sm font-bold text-slate-200">Drop document here or <span className="text-violet-400">browse</span></p>
                            <p className="text-[10px] text-slate-500">PDF, JPG, PNG, DOC — Gemini AI auto-detects type, expiry &amp; name</p>
                        </div>
                    )}
                </div>

                {/* AI Result Banner */}
                {aiResult && (
                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={13} className="text-violet-400" />
                            <span className="text-xs font-black text-violet-300 uppercase tracking-wider">AI Detection Result</span>
                            <span className="ml-auto text-[9px] text-violet-400/60 font-bold">{Math.round((aiResult.confidence || 0) * 100)}% confidence</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {aiResult.documentType && <div><span className="text-slate-500">Type:</span> <span className="text-slate-200 font-bold">{aiResult.documentType}</span></div>}
                            {aiResult.holderName && <div><span className="text-slate-500">Holder:</span> <span className="text-slate-200 font-bold">{aiResult.holderName}</span></div>}
                            {aiResult.issuer && <div><span className="text-slate-500">Issuer:</span> <span className="text-slate-200 font-bold">{aiResult.issuer}</span></div>}
                            {aiResult.expirationDate && <div><span className="text-slate-500">Expires:</span> <span className={`font-bold ${expiryColor(aiResult.expirationDate)}`}>{expiryLabel(aiResult.expirationDate)}</span></div>}
                        </div>
                        <button onClick={() => setAiResult(null)} className="text-[10px] text-slate-600 hover:text-slate-400 mt-1">Dismiss</button>
                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${toast.type === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {toast.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                        {toast.msg}
                        <button onClick={() => setToast(null)} className="ml-auto"><X size={12} /></button>
                    </div>
                )}

                {/* Document List */}
                {loading ? (
                    <div className="flex items-center gap-2 text-slate-500 py-2"><Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading documents…</span></div>
                ) : docs.length === 0 ? (
                    <div className="text-center py-6 text-slate-600">
                        <FileText size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-bold">No documents uploaded yet</p>
                        <p className="text-[10px] mt-0.5">Upload your FAA license, certifications, and ID above</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{docs.length} Document{docs.length !== 1 ? 's' : ''} on File</p>
                        {docs.map(doc => {
                            const type = doc.aiMetadata?.documentType || doc.category || 'Document';
                            const cls = docTypeColor(type);
                            const expiry = doc.expirationDate || doc.aiMetadata?.expirationDate;
                            return (
                                <div key={doc.id} className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 hover:border-slate-600 transition-colors group">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${cls}`}>
                                        <FileText size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-200 truncate">{doc.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wide ${cls}`}>{type}</span>
                                            {expiry && (
                                                <span className={`text-[9px] font-bold flex items-center gap-0.5 ${expiryColor(expiry)}`}>
                                                    <Calendar size={8} />{expiryLabel(expiry)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {doc.url && (
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                                className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                                                <Eye size={13} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Expiry warnings */}
                        {docs.filter(d => {
                            const exp = d.expirationDate || d.aiMetadata?.expirationDate;
                            if (!exp) return false;
                            return (new Date(exp).getTime() - Date.now()) / 86400000 < 60;
                        }).length > 0 && (
                            <div className="flex items-start gap-2 bg-orange-500/5 border border-orange-500/15 rounded-xl p-3 mt-2">
                                <AlertTriangle size={13} className="text-orange-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-orange-400/80 font-medium">
                                    One or more documents expire within 60 days. Upload renewed versions above to stay compliant.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main View ─────────────────────────────────────────────────────────────────

const PilotComplianceView: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-y-auto">
            {/* Page header */}
            <div className="px-6 pt-8 pb-4 shrink-0">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg">
                        <ShieldCheck size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Personal Hub</h1>
                        <p className="text-[11px] text-slate-500">Banking &amp; document self-service portal</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 pb-8 space-y-5">
                <OnboardingSection />
                <ProfileSection />
                <BankingSection />
                <DocumentsSection />
            </div>
        </div>
    );
};

export default PilotComplianceView;
