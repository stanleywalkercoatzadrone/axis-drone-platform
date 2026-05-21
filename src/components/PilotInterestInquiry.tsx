/**
 * PilotInterestInquiry.tsx
 * Standalone page for sending Pilot Interest Inquiry emails.
 * Select a mission, compose AI-assisted emails, choose recipients, send.
 */
import React, { useState, useEffect } from 'react';
import {
    Mail, BrainCircuit, Send, XCircle, CheckCircle, Loader2,
    Search, RotateCcw, RefreshCw, Eye, Check, ChevronDown, MapPin
} from 'lucide-react';
import { Personnel } from '../types';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/roleUtils';

// ── Types ────────────────────────────────────────────────────────────────────
interface ManualRecipient {
    id: string; name: string; email: string; isManual: true; dailyPay: number;
}

interface Deployment {
    id: string;
    title?: string;
    siteName?: string;
    date?: string;
    location?: string;
    type?: string;
    industry?: string;
    estimatedDurationDays?: number;
    status?: string;
}

// ── Mission Selector ─────────────────────────────────────────────────────────
const MissionSelector: React.FC<{
    value: string;
    onChange: (id: string, dep: Deployment) => void;
}> = ({ value, onChange }) => {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/deployments?limit=100&status=scheduled,active,review')
            .then(r => setDeployments(r.data?.data || r.data?.deployments || []))
            .catch(() => setDeployments([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#64748b' }} />
            <select
                value={value}
                onChange={e => {
                    const dep = deployments.find(d => d.id === e.target.value);
                    if (dep) onChange(dep.id, dep);
                }}
                disabled={loading}
                className="w-full appearance-none pl-10 pr-10 py-3.5 rounded-xl text-sm font-bold text-white outline-none transition-all"
                style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
                <option value="" style={{ background: '#0f172a' }}>
                    {loading ? 'Loading missions…' : 'Select a mission…'}
                </option>
                {deployments.map(d => (
                    <option key={d.id} value={d.id} style={{ background: '#0f172a' }}>
                        {d.title || d.siteName || 'Unnamed Mission'}
                        {d.location ? ` — ${d.location}` : ''}
                        {d.date ? ` (${d.date})` : ''}
                    </option>
                ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#64748b' }} />
        </div>
    );
};

// ── Main Panel (adapted from InterestInquiryPanel in DeploymentTracker) ──────
const InquiryPanel: React.FC<{ deployment: Deployment; personnel: Personnel[] }> = ({ deployment, personnel }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [manualRecipients, setManualRecipients] = useState<ManualRecipient[]>([]);
    const [manualInput, setManualInput] = useState('');
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [results, setResults] = useState<{ pilotId: string; pilotName: string; status: string; reason?: string }[]>([]);
    const [sent, setSent] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewIdx, setPreviewIdx] = useState(0);
    const [aiBody, setAiBody] = useState<string | null>(null);
    const [aiSubject, setAiSubject] = useState<string | null>(null);
    const [additionalNote, setAdditionalNote] = useState('');
    const [aiError, setAiError] = useState<string | null>(null);
    const [jobRole, setJobRole] = useState<'pilot' | 'lbd' | 'both'>('pilot');
    const [postToLinkedIn, setPostToLinkedIn] = useState(false);
    const [inquiryRecipients, setInquiryRecipients] = useState<{ pilotId: string; pilotName: string; sentAt: string; assigned: boolean }[] | null>(null);
    const [loadingRecipients, setLoadingRecipients] = useState(false);
    const [notifyingNotSelected, setNotifyingNotSelected] = useState(false);
    const [notifyResults, setNotifyResults] = useState<{ pilotId: string; pilotName: string; status: string }[]>([]);

    const loadInquiryRecipients = async () => {
        setLoadingRecipients(true);
        try {
            const res = await apiClient.get(`/deployments/${deployment.id}/interest-inquiry/recipients`);
            setInquiryRecipients(res.data.data || []);
        } catch { setInquiryRecipients([]); }
        finally { setLoadingRecipients(false); }
    };

    useEffect(() => {
        setSelectedIds(new Set());
        setAiBody(null); setAiSubject(null); setSent(false); setResults([]);
        loadInquiryRecipients();
    }, [deployment.id]);

    const filtered = personnel.filter(p =>
        !search || (p as any).fullName?.toLowerCase().includes(search.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(search.toLowerCase())
    );

    const addManualEmails = () => {
        const raw = manualInput.trim();
        if (!raw) return;
        const candidates = raw.split(/[,;\s\n]+/).map(s => s.trim()).filter(Boolean);
        const newEntries: ManualRecipient[] = [];
        const newIds: string[] = [];
        let added = 0;
        for (const email of candidates) {
            if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) continue;
            if (manualRecipients.some(r => r.email === email)) continue;
            if (newEntries.some(r => r.email === email)) continue;
            const id = `manual-${Date.now()}-${added++}`;
            newEntries.push({ id, name: email.split('@')[0], email, isManual: true, dailyPay: 400 });
            newIds.push(id);
        }
        if (newEntries.length) {
            setManualRecipients(prev => [...prev, ...newEntries]);
            setSelectedIds(prev => { const n = new Set(prev); newIds.forEach(id => n.add(id)); return n; });
        }
        setManualInput('');
    };

    const allRecipients = [...filtered, ...manualRecipients];
    const previewRecipients = [
        ...personnel.filter(p => selectedIds.has(p.id)),
        ...manualRecipients.filter(r => selectedIds.has(r.id)),
    ];
    const togglePilot = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
    const selectAll = () => setSelectedIds(new Set(filtered.map(p => p.id)));
    const clearAll = () => setSelectedIds(new Set());

    const handleGenerate = async () => {
        setGenerating(true); setAiError(null);
        try {
            const selectedPilots = personnel.filter(p => selectedIds.has(p.id));
            const selectedManuals = manualRecipients.filter(r => selectedIds.has(r.id));
            const pilotRates = selectedPilots.map(p => p.dailyPayRate).filter((r): r is number => !!r && r > 0);
            const manualRates = selectedManuals.map(r => r.dailyPay);
            const allRates = [...pilotRates, ...manualRates];
            const avgRate = allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 400;
            const res = await apiClient.post(`/deployments/${deployment.id}/interest-inquiry/generate`, {
                payRate: avgRate, personnelRole: jobRole,
            });
            setAiBody(res.data.body || ''); setAiSubject(res.data.subject || null);
        } catch (e: any) {
            setAiError(e?.response?.data?.message || 'AI generation failed. Try again.');
        } finally { setGenerating(false); }
    };

    const handleSend = async () => {
        const allSelected = [...personnel.filter(p => selectedIds.has(p.id)), ...manualRecipients.filter(r => selectedIds.has(r.id))];
        if (!allSelected.length) return;
        setSending(true); setResults([]);
        try {
            const res = await apiClient.post(`/deployments/${deployment.id}/interest-inquiry`, {
                personnelIds: personnel.filter(p => selectedIds.has(p.id)).map(p => p.id),
                manualEmails: manualRecipients.filter(r => selectedIds.has(r.id)).map(r => ({ name: r.name, email: r.email, dailyPay: r.dailyPay ?? 400 })),
                customMessage: additionalNote,
                aiGeneratedBody: aiBody || null,
                aiGeneratedSubject: aiSubject || null,
                postToLinkedIn,
            });
            setResults(res.data.results || []); setSent(true); setShowPreview(false);
            loadInquiryRecipients();
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to send inquiries');
        } finally { setSending(false); }
    };

    const handleNotifyNotSelected = async () => {
        if (!inquiryRecipients) return;
        const targets = inquiryRecipients.filter(r => !r.assigned);
        if (!targets.length) return;
        if (!confirm(`Send "Not Selected" notices to ${targets.length} pilot${targets.length !== 1 ? 's' : ''}?`)) return;
        setNotifyingNotSelected(true); setNotifyResults([]);
        try {
            const res = await apiClient.post(`/deployments/${deployment.id}/interest-inquiry/not-selected`, {
                personnelIds: targets.map(r => r.pilotId),
            });
            setNotifyResults(res.data.results || []);
            loadInquiryRecipients();
        } catch (e: any) { alert(e?.response?.data?.message || 'Failed to send notices'); }
        finally { setNotifyingNotSelected(false); }
    };

    const previewLines = [
        deployment.title && `Mission: ${deployment.title}`,
        deployment.siteName && `Site: ${deployment.siteName}`,
        deployment.date && `Date: ${deployment.date}`,
        deployment.location && `Location: ${deployment.location}`,
        deployment.type && `Type: ${deployment.type}`,
        deployment.industry && `Industry: ${deployment.industry}`,
        deployment.estimatedDurationDays && `Est. Duration: ${deployment.estimatedDurationDays} day${deployment.estimatedDurationDays > 1 ? 's' : ''}`,
    ].filter(Boolean) as string[];

    // ── Render ──
    return (
        <div className="flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                        <Mail className="w-5 h-5" style={{ color: '#a78bfa' }} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base">Pilot Interest Inquiry</h3>
                        <p className="text-xs" style={{ color: '#64748b' }}>Set job type &amp; pay, let AI write the email, select recipients, send.</p>
                    </div>
                </div>
                <button onClick={handleGenerate} disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all disabled:opacity-60 flex-shrink-0 text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                    {generating ? 'Generating…' : aiBody ? 'Regenerate' : '✨ Write with AI'}
                </button>
            </div>

            {/* Job type strip */}
            <div className="flex flex-wrap gap-5 items-end p-4 rounded-xl"
                style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Job Type</label>
                    <div className="flex items-center rounded-lg overflow-hidden text-[11px] font-bold"
                        style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {([
                            { value: 'pilot', label: '🚁 Flying / Pilot' },
                            { value: 'lbd',   label: '🔍 LBD Scanning' },
                            { value: 'both',  label: '⚡ Both' },
                        ] as const).map(opt => (
                            <button key={opt.value} onClick={() => setJobRole(opt.value)}
                                className="px-3 py-2 transition-colors whitespace-nowrap"
                                style={{
                                    background: jobRole === opt.value ? '#7c3aed' : 'transparent',
                                    color: jobRole === opt.value ? 'white' : '#64748b',
                                }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="text-[10px] italic flex-1 self-end pb-0.5" style={{ color: '#334155' }}>
                    Job type helps AI describe the work accurately. Each pilot's pay rate from their profile is used automatically.
                </p>
            </div>

            {/* AI error */}
            {aiError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                    <XCircle className="w-4 h-4 flex-shrink-0" /> {aiError}
                </div>
            )}

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: pilot picker */}
                <div className="rounded-xl overflow-hidden flex flex-col"
                    style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="px-4 py-3 flex items-center justify-between gap-3"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Recipients</span>
                        <div className="flex items-center gap-2">
                            <button onClick={selectAll} className="text-[10px] font-bold transition-colors" style={{ color: '#38bdf8' }}>All</button>
                            <span style={{ color: '#334155' }}>·</span>
                            <button onClick={clearAll} className="text-[10px] font-bold transition-colors" style={{ color: '#64748b' }}>Clear</button>
                            {selectedIds.size > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
                                    {selectedIds.size} selected
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#475569' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search pilots & technicians..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none rounded-lg"
                                style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.07)' }} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto" style={{ maxHeight: 280 }}>
                        {allRecipients.map(p => {
                            const isSelected = selectedIds.has(p.id);
                            const isManual = (p as any).isManual;
                            return (
                                <div key={p.id} onClick={() => togglePilot(p.id)}
                                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
                                    style={{
                                        background: isSelected ? 'rgba(139,92,246,0.08)' : 'transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    }}>
                                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                        style={{
                                            background: isSelected ? '#7c3aed' : 'transparent',
                                            border: `1px solid ${isSelected ? '#7c3aed' : '#334155'}`,
                                        }}>
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-white truncate">{(p as any).fullName || (p as any).name}</p>
                                        <p className="text-[10px] truncate" style={{ color: '#475569' }}>{p.email || 'No email on file'}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {isManual && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', color: '#facc15' }}>
                                                $400/day
                                            </span>
                                        )}
                                        {!isManual && (p as any).dailyPayRate ? (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
                                                ${Number((p as any).dailyPayRate).toLocaleString()}/day
                                            </span>
                                        ) : null}
                                        {isManual && (
                                            <button onClick={e => {
                                                e.stopPropagation();
                                                setManualRecipients(prev => prev.filter(r => r.id !== p.id));
                                                setSelectedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                                            }} className="transition-colors hover:opacity-80 ml-1">
                                                <XCircle className="w-3.5 h-3.5" style={{ color: '#475569' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {allRecipients.length === 0 && (
                            <p className="text-xs text-center py-8" style={{ color: '#334155' }}>No pilots found</p>
                        )}
                    </div>

                    {/* Manual email add */}
                    <div className="p-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#334155' }}>Add Emails Manually</p>
                            <p className="text-[10px] italic" style={{ color: '#1e293b' }}>comma, space or newline separated</p>
                        </div>
                        <div className="flex gap-2">
                            <textarea value={manualInput} onChange={e => setManualInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addManualEmails())}
                                placeholder={`pilot@example.com, crew@example.com`}
                                rows={2}
                                className="flex-1 px-3 py-1.5 text-xs text-white placeholder:text-slate-700 outline-none resize-none rounded-lg"
                                style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.07)' }} />
                            <button onClick={addManualEmails}
                                className="px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0 self-stretch"
                                style={{ background: '#7c3aed' }}>
                                + Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: compose */}
                <div className="flex flex-col gap-4">
                    {/* Mission data preview */}
                    <div className="rounded-xl overflow-hidden"
                        style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="px-4 py-2.5 flex items-center gap-2"
                            style={{ background: 'rgba(30,41,59,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#475569' }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Mission Data Included in Email</span>
                        </div>
                        <div className="p-3.5 space-y-1">
                            {previewLines.length > 0 ? previewLines.map((line, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                    <span style={{ color: 'rgba(34,197,94,0.7)' }}>✓</span>
                                    <span className="text-slate-300">{line}</span>
                                </div>
                            )) : (
                                <p className="text-xs" style={{ color: '#334155' }}>Select a mission above to populate mission data.</p>
                            )}
                        </div>
                    </div>

                    {/* AI email body */}
                    <div className="rounded-xl overflow-hidden flex flex-col flex-1" style={{ minHeight: 180, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex items-center gap-2">
                                {aiBody ? (
                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: '#a78bfa' }}>
                                        <BrainCircuit className="w-3 h-3" /> AI-Written Email Body
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#334155' }}>Email Body</span>
                                )}
                            </div>
                            {aiBody && (
                                <button onClick={() => { setAiBody(null); setAiSubject(null); }}
                                    className="text-[10px] flex items-center gap-1 transition-colors" style={{ color: '#475569' }}>
                                    <RotateCcw className="w-3 h-3" /> Reset
                                </button>
                            )}
                        </div>
                        {aiBody !== null ? (
                            <textarea value={aiBody} onChange={e => setAiBody(e.target.value)} rows={8}
                                className="flex-1 w-full bg-transparent p-4 text-xs text-slate-200 resize-none outline-none leading-relaxed"
                                placeholder="AI email body will appear here..." />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                                <BrainCircuit className="w-8 h-8" style={{ color: '#1e293b' }} />
                                <p className="text-xs max-w-[200px] leading-relaxed" style={{ color: '#334155' }}>
                                    Click <strong style={{ color: '#a78bfa' }}>✨ Write with AI</strong> to generate a professional email explaining the mission
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Additional note */}
                    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#334155' }}>
                                Additional Note <span className="font-normal" style={{ color: '#1e293b' }}>(optional)</span>
                            </span>
                        </div>
                        <textarea value={additionalNote} onChange={e => setAdditionalNote(e.target.value)} rows={2}
                            placeholder="Any extra context to include..."
                            className="w-full bg-transparent p-3 text-xs text-slate-300 placeholder:text-slate-700 resize-none outline-none" />
                    </div>

                    {/* Send button */}
                    <button onClick={() => { setPreviewIdx(0); setShowPreview(true); }}
                        disabled={selectedIds.size === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: selectedIds.size > 0 ? '0 0 30px rgba(124,58,237,0.3)' : 'none' }}>
                        <Eye className="w-4 h-4" />
                        {`Preview & Send to ${selectedIds.size || 0} Recipient${selectedIds.size !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>

            {/* Email Preview Modal */}
            {showPreview && previewRecipients.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setShowPreview(false)}>
                    <div className="rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
                        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            <div>
                                <h3 className="font-bold text-white text-sm">Email Preview</h3>
                                <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>
                                    Recipient {previewIdx + 1} of {previewRecipients.length}:{' '}
                                    <span style={{ color: '#a78bfa', fontWeight: 700 }}>{previewRecipients[previewIdx]?.email}</span>
                                </p>
                            </div>
                            <button onClick={() => setShowPreview(false)} style={{ color: '#475569' }}><XCircle className="w-5 h-5" /></button>
                        </div>

                        {previewRecipients.length > 1 && (
                            <div className="flex gap-1.5 px-5 py-2.5 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {previewRecipients.map((r, i) => (
                                    <button key={r.id || (r as any).email} onClick={() => setPreviewIdx(i)}
                                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                                        style={{
                                            background: i === previewIdx ? '#7c3aed' : 'rgba(30,41,59,0.8)',
                                            color: i === previewIdx ? 'white' : '#64748b',
                                        }}>
                                        {(r as any).fullName || (r as any).name || (r as any).email}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#475569' }}>Subject</p>
                                <p className="text-sm font-semibold text-white">{aiSubject || `Mission Opportunity — ${deployment.title}`}</p>
                            </div>
                            <div className="flex gap-3 text-xs">
                                <span className="font-bold w-6 shrink-0" style={{ color: '#475569' }}>To:</span>
                                <span className="text-slate-300">{previewRecipients[previewIdx]?.email}</span>
                            </div>
                            <div className="rounded-xl p-4" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#334155' }}>Email Body</p>
                                {aiBody ? (
                                    <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                                        {aiBody.replace(/\[Name\]/gi, (previewRecipients[previewIdx] as any)?.fullName || (previewRecipients[previewIdx] as any)?.name || 'Pilot')}
                                    </pre>
                                ) : (
                                    <div className="space-y-2 text-xs text-slate-400">
                                        <p>Hi {(previewRecipients[previewIdx] as any)?.fullName || 'Pilot'},</p>
                                        <p>We have an upcoming mission opportunity:</p>
                                        {previewLines.map((l, i) => <p key={i} className="text-slate-300">• {l}</p>)}
                                        {additionalNote && <p className="mt-2 text-slate-300">{additionalNote}</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* LinkedIn toggle */}
                        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(30,41,59,0.3)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                                    style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.3)', color: '#60a5fa' }}>in</div>
                                <div>
                                    <p className="text-xs font-bold text-white">LinkedIn Blast</p>
                                    <p className="text-[10px]" style={{ color: '#475569' }}>Post this opportunity to the authorized LinkedIn feed</p>
                                </div>
                            </div>
                            <button onClick={() => setPostToLinkedIn(!postToLinkedIn)}
                                className="w-10 h-5 rounded-full relative transition-colors"
                                style={{ background: postToLinkedIn ? '#2563eb' : '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-all"
                                    style={{ left: postToLinkedIn ? '1.3rem' : '0.125rem' }} />
                            </button>
                        </div>

                        <div className="flex gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                            <button onClick={() => setShowPreview(false)}
                                className="flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-colors"
                                style={{ background: 'rgba(30,41,59,0.6)', color: '#94a3b8' }}>Cancel</button>
                            <button onClick={handleSend} disabled={sending}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                {sending ? 'Sending…' : `Confirm & Send to ${selectedIds.size}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send results */}
            {sent && results.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(30,41,59,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                            Inquiry Sent — {results.filter(r => r.status === 'sent').length} of {results.length} delivered
                        </span>
                        <button onClick={() => { setSent(false); setResults([]); setSelectedIds(new Set()); setAiBody(null); setAiSubject(null); setAdditionalNote(''); }}
                            className="text-[10px] flex items-center gap-1 transition-colors" style={{ color: '#475569' }}>
                            <RotateCcw className="w-3 h-3" /> New Inquiry
                        </button>
                    </div>
                    <div className="p-4 flex flex-wrap gap-2">
                        {results.map(r => (
                            <div key={r.pilotId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                                style={{
                                    background: r.status === 'sent' ? 'rgba(34,197,94,0.1)' : r.status === 'skipped' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${r.status === 'sent' ? 'rgba(34,197,94,0.3)' : r.status === 'skipped' ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                    color: r.status === 'sent' ? '#4ade80' : r.status === 'skipped' ? '#facc15' : '#f87171',
                                }}>
                                {r.status === 'sent' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {r.pilotName}
                                {r.reason && <span className="opacity-60 font-normal ml-1">· {r.reason}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 2: Notify Not Selected */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(30,41,59,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Step 2 · Notify Not Selected</span>
                        <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                            After crew is assigned — notify pilots who received an inquiry but weren't selected.
                        </p>
                    </div>
                    <button onClick={loadInquiryRecipients} disabled={loadingRecipients}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                        style={{ background: 'rgba(30,41,59,0.8)', color: '#94a3b8' }}>
                        {loadingRecipients ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Refresh
                    </button>
                </div>

                {loadingRecipients && (
                    <div className="flex items-center gap-2 p-4 text-xs" style={{ color: '#475569' }}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading inquiry history…
                    </div>
                )}

                {inquiryRecipients && !loadingRecipients && (
                    <>
                        {inquiryRecipients.length === 0 ? (
                            <p className="text-xs text-center py-6" style={{ color: '#334155' }}>No inquiry emails have been sent for this mission yet.</p>
                        ) : (
                            <div>
                                {inquiryRecipients.map(r => (
                                    <div key={r.pilotId} className="flex items-center gap-3 px-4 py-2.5"
                                        style={{ opacity: r.assigned ? 0.5 : 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ background: r.assigned ? '#22c55e' : '#facc15' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-white truncate">{r.pilotName}</p>
                                            <p className="text-[10px]" style={{ color: '#475569' }}>
                                                Inquiry sent {new Date(r.sentAt).toLocaleDateString()}
                                                {r.assigned && <span className="ml-2 font-bold" style={{ color: '#4ade80' }}>· Assigned to mission</span>}
                                            </p>
                                        </div>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded flex-shrink-0"
                                            style={r.assigned
                                                ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }
                                                : { background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', color: '#facc15' }}>
                                            {r.assigned ? 'Selected ✓' : 'Not assigned'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {inquiryRecipients.filter(r => !r.assigned).length > 0 && (
                            <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <p className="text-[10px]" style={{ color: '#475569' }}>
                                    <span className="font-bold" style={{ color: '#facc15' }}>{inquiryRecipients.filter(r => !r.assigned).length}</span>{' '}
                                    pilot{inquiryRecipients.filter(r => !r.assigned).length !== 1 ? 's' : ''} to notify
                                </p>
                                <button onClick={handleNotifyNotSelected} disabled={notifyingNotSelected}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                                    style={{ background: 'rgba(225,29,72,0.15)', border: '1px solid rgba(225,29,72,0.3)', color: '#fb7185' }}>
                                    {notifyingNotSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    {notifyingNotSelected ? 'Sending…' : 'Send Not Selected Notices'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ── Page Wrapper ──────────────────────────────────────────────────────────────
const PilotInterestInquiry: React.FC = () => {
    const { user } = useAuth();
    const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [loadingPersonnel, setLoadingPersonnel] = useState(false);

    // Load pilot roster once
    useEffect(() => {
        setLoadingPersonnel(true);
        apiClient.get('/personnel?limit=200')
            .then(r => setPersonnel(r.data?.data || r.data?.personnel || []))
            .catch(() => {})
            .finally(() => setLoadingPersonnel(false));
    }, []);

    if (!isAdmin(user)) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-sm" style={{ color: '#475569' }}>Admin access required.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6 overflow-auto min-h-0">
            {/* Page header */}
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                    <Mail className="w-6 h-6" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Interest Inquiry</h1>
                    <p className="text-xs font-medium uppercase tracking-widest mt-0.5" style={{ color: '#475569' }}>
                        Select a mission · compose AI email · send to pilots
                    </p>
                </div>
            </div>

            {/* Mission selector card */}
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>
                    Mission
                </label>
                <MissionSelector
                    value={selectedDeployment?.id || ''}
                    onChange={(id, dep) => setSelectedDeployment(dep)}
                />
                {!selectedDeployment && (
                    <p className="text-xs mt-2" style={{ color: '#334155' }}>
                        Choose a mission to load its details and start composing the inquiry.
                    </p>
                )}
            </div>

            {/* Panel — only when mission selected */}
            {selectedDeployment ? (
                loadingPersonnel ? (
                    <div className="flex items-center gap-3 justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#7c3aed' }} />
                        <span className="text-sm" style={{ color: '#475569' }}>Loading pilot roster…</span>
                    </div>
                ) : (
                    <InquiryPanel deployment={selectedDeployment} personnel={personnel} />
                )
            ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl"
                    style={{ background: 'rgba(15,23,42,0.4)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                    <Mail className="w-10 h-10" style={{ color: '#1e293b' }} />
                    <p className="text-sm font-bold" style={{ color: '#334155' }}>No mission selected</p>
                    <p className="text-xs" style={{ color: '#1e293b' }}>Pick a mission above to start the inquiry workflow.</p>
                </div>
            )}
        </div>
    );
};

export default PilotInterestInquiry;
