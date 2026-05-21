import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isoToFlag } from '../utils/countryFlag';
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
    ArrowRight, Briefcase, Building2, ChevronDown, ChevronRight, Clock, Edit2, ExternalLink, Filter, LayoutGrid, Link as LinkIcon, Loader2, Layers, MapPin, MoreVertical, Receipt, RefreshCw, Search, Target, Zap, Plane, List, Grid3X3, BarChart3, Activity, Mail, UserPlus, UserCheck, BrainCircuit, RotateCcw, ClipboardList
} from 'lucide-react';
import ProjectInvoiceView from './ProjectInvoiceView';
import { Deployment, DeploymentStatus, DeploymentType, DailyLog, Personnel, DeploymentFile, UserAccount, Country } from '../types';
import CalendarView from './CalendarView';
import AssetTracker from './AssetTracker';
import WorkItemChecklist from './WorkItemChecklist';
import ClientForm from './ClientForm';
import StakeholderForm from './StakeholderForm';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import IndustryReportsHub from '../../modules/ai-reporting/IndustryReportsHub';
import { isAdmin } from '../utils/roleUtils';
import AxisIntelligencePanel from './admin/AxisIntelligencePanel';
import { FlightDataUpload } from './FlightDataUpload';
import WeatherDashboard from './WeatherDashboard';
import MissionForecastPanel from './MissionForecastPanel';
import PilotPerformanceSnapshot from './PilotPerformanceSnapshot';
import ClientCompletionTimeline from './ClientCompletionTimeline';
import { useMission } from '../context/MissionContext';
import { useIndustry } from '../context/IndustryContext';
import { MissionSessionPanel } from './MissionSessionPanel';
import { SolarBlockMap } from './SolarBlockMap';
import LBDBlockTracker from './LBDBlockTracker';
import LBDDocumentGrid from './LBDDocumentGrid';
import { ThermalHotspotMap } from './ThermalHotspotMap';
import DailyFieldReportsTab from './DailyFieldReportsTab';
import AssignmentsTab from './AssignmentsTab';

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

// ── Interest Inquiry Panel ─────────────────────────────────────────────────────
interface ManualRecipient { id: string; name: string; email: string; isManual: true; dailyPay: number; }

const InterestInquiryPanel: React.FC<{ deployment: any; personnel: Personnel[] }> = ({ deployment, personnel }) => {
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

    // AI email draft state
    const [aiBody, setAiBody] = useState<string | null>(null);
    const [aiSubject, setAiSubject] = useState<string | null>(null);
    const [additionalNote, setAdditionalNote] = useState('');
    const [aiError, setAiError] = useState<string | null>(null);

    // Job context for AI generation
    const [jobRole, setJobRole] = useState<'pilot' | 'lbd' | 'both'>('pilot');
    const [postToLinkedIn, setPostToLinkedIn] = useState(false);

    // Step 2: pilots who received an inquiry for this mission
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

    // Auto-load recipients on mount
    useEffect(() => { loadInquiryRecipients(); }, [deployment.id]);

    const filtered = personnel.filter(p =>
        !search || (p as any).fullName.toLowerCase().includes(search.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(search.toLowerCase())
    );

    const addManualEmails = () => {
        // Accept comma / semicolon / space / newline-separated list
        const raw = manualInput.trim();
        if (!raw) return;
        const candidates = raw.split(/[,;\s\n]+/).map(s => s.trim()).filter(Boolean);
        let added = 0;
        const newEntries: ManualRecipient[] = [];
        const newIds: string[] = [];
        for (const email of candidates) {
            if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) continue;
            if (manualRecipients.some(r => r.email === email)) continue;
            if (newEntries.some(r => r.email === email)) continue;
            const id = `manual-${Date.now()}-${added}`;
            newEntries.push({ id, name: email.split('@')[0], email, isManual: true, dailyPay: 400 });
            newIds.push(id);
            added++;
        }
        if (newEntries.length) {
            setManualRecipients(prev => [...prev, ...newEntries]);
            setSelectedIds(prev => { const n = new Set(prev); newIds.forEach(id => n.add(id)); return n; });
        }
        setManualInput('');
    };

    // Combined list: DB pilots + manual entries
    const allRecipients = [
        ...filtered,
        ...manualRecipients,
    ];

    // Preview recipients (selected pilots + selected manual)
    const previewRecipients = [
        ...personnel.filter(p => selectedIds.has(p.id)),
        ...manualRecipients.filter(r => selectedIds.has(r.id)),
    ];

    const togglePilot = (id: string) => setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const selectAll = () => setSelectedIds(new Set(filtered.map(p => p.id)));
    const clearAll = () => setSelectedIds(new Set());

    const handleGenerate = async () => {
        setGenerating(true);
        setAiError(null);
        try {
            // Auto-compute average pay rate: selected DB pilots + $400 fallback for manual recipients
            const selectedPilots = personnel.filter(p => selectedIds.has(p.id));
            const selectedManuals = manualRecipients.filter(r => selectedIds.has(r.id));
            const pilotRates = selectedPilots.map(p => p.dailyPayRate).filter((r): r is number => !!r && r > 0);
            const manualRates = selectedManuals.map(r => r.dailyPay);
            const allRates = [...pilotRates, ...manualRates];
            const avgRate = allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 400;

            const res = await apiClient.post(`/deployments/${deployment.id}/interest-inquiry/generate`, {
                payRate:       avgRate,
                personnelRole: jobRole,
            });
            setAiBody(res.data.body || '');
            setAiSubject(res.data.subject || null);
        } catch (e: any) {
            setAiError(e?.response?.data?.message || 'AI generation failed. Try again.');
        } finally {
            setGenerating(false);
        }
    };

    const handleSend = async () => {
        const allSelected = [
            ...personnel.filter(p => selectedIds.has(p.id)),
            ...manualRecipients.filter(r => selectedIds.has(r.id)),
        ];
        if (allSelected.length === 0) return;
        setSending(true);
        setResults([]);
        try {
            const pilotIds = personnel.filter(p => selectedIds.has(p.id)).map(p => p.id);

            const res = await apiClient.post(`/deployments/${deployment.id}/interest-inquiry`, {
                personnelIds:      pilotIds,
                manualEmails:      manualRecipients.filter(r => selectedIds.has(r.id)).map(r => ({ name: r.name, email: r.email, dailyPay: r.dailyPay ?? 400 })),
                customMessage:     additionalNote,
                aiGeneratedBody:   aiBody   || null,
                aiGeneratedSubject: aiSubject || null,
                postToLinkedIn:    postToLinkedIn,
            });
            setResults(res.data.results || []);
            setSent(true);
            // Immediately load recipients list for Step 2
            setLoadingRecipients(true);
            try {
                const rr = await apiClient.get(`/deployments/${deployment.id}/interest-inquiry/recipients`);
                setInquiryRecipients(rr.data.data || []);
            } catch { setInquiryRecipients([]); }
            finally { setLoadingRecipients(false); }
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to send inquiries');
        } finally {
            setSending(false);
            setShowPreview(false);
        }
    };

    const handleNotifyNotSelected = async () => {
        if (!inquiryRecipients) return;
        const targets = inquiryRecipients.filter(r => !r.assigned);
        if (targets.length === 0) return;
        if (!confirm(`Send "Not Selected" notices to ${targets.length} pilot${targets.length !== 1 ? 's' : ''} who received an inquiry but were not assigned to this mission?`)) return;
        setNotifyingNotSelected(true);
        setNotifyResults([]);
        try {
            const res = await apiClient.post(`/deployments/${deployment.id}/interest-inquiry/not-selected`, {
                personnelIds: targets.map(r => r.pilotId),
            });
            setNotifyResults(res.data.results || []);
            // Refresh recipients
            const rr = await apiClient.get(`/deployments/${deployment.id}/interest-inquiry/recipients`);
            setInquiryRecipients(rr.data.data || []);
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to send notices');
        } finally {
            setNotifyingNotSelected(false);
        }
    };

    const previewLines = [
        deployment.title                 && `Mission: ${deployment.title}`,
        deployment.siteName              && `Site: ${deployment.siteName}`,
        deployment.date                  && `Date: ${deployment.date}`,
        deployment.location              && `Location: ${deployment.location}`,
        deployment.type                  && `Type: ${deployment.type}`,
        deployment.industry              && `Industry: ${deployment.industry}`,
        deployment.estimatedDurationDays && `Est. Duration: ${deployment.estimatedDurationDays} day${deployment.estimatedDurationDays > 1 ? 's' : ''}`,
    ].filter(Boolean) as string[];

    return (
        <div className="h-full overflow-y-auto bg-slate-950 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base">Pilot Interest Inquiry</h3>
                        <p className="text-xs text-slate-400">Set job type &amp; pay, let AI write the email, select recipients, send.</p>
                    </div>
                </div>
                {/* AI Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all disabled:opacity-60 bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-600 hover:to-indigo-600 text-white shadow-md shadow-violet-900/40 flex-shrink-0"
                >
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                    {generating ? 'Generating…' : aiBody ? 'Regenerate with AI' : '✨ Write with AI'}
                </button>
            </div>

            {/* Job Context Strip — tells AI what kind of work and what pay to mention */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 flex flex-wrap gap-5 items-end">
                {/* Job Role Selector */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Job Type</label>
                    <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden text-[11px] font-bold">
                        {([
                            { value: 'pilot', label: '🚁 Flying / Pilot' },
                            { value: 'lbd',   label: '🔍 LBD Scanning' },
                            { value: 'both',  label: '⚡ Both' },
                        ] as const).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setJobRole(opt.value)}
                                className={`px-3 py-2 transition-colors whitespace-nowrap ${
                                    jobRole === opt.value
                                        ? 'bg-violet-600 text-white'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <p className="text-[10px] text-slate-600 italic flex-1 self-end pb-0.5">
                    Job type helps AI describe the work accurately. Each pilot's pay rate from their profile is used automatically.
                </p>
            </div>

            {/* AI Error */}
            {aiError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                    <XCircle className="w-4 h-4 flex-shrink-0" /> {aiError}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Pilot multi-select + Manual Email */}
                <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Recipients</span>
                        <div className="flex items-center gap-2">
                            <button onClick={selectAll} className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors">All</button>
                            <span className="text-slate-600">·</span>
                            <button onClick={clearAll} className="text-[10px] font-bold text-slate-400 hover:text-slate-300 transition-colors">Clear</button>
                            {selectedIds.size > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                    {selectedIds.size} selected
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="p-3 border-b border-slate-700/40">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pilots & technicians..."
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-slate-800/80">
                        {allRecipients.map(p => {
                            const isSelected = selectedIds.has(p.id);
                            const isManual = (p as any).isManual;
                            return (
                                <div key={p.id} className={`flex items-center gap-2 px-3 py-2 transition-colors ${isSelected ? 'bg-violet-500/10' : 'hover:bg-slate-800/50'}`}>
                                    <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => togglePilot(p.id)} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-slate-200 truncate">{(p as any).fullName || (p as any).name}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{p.email || 'No email on file'}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {isManual && (
                                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                                    $400/day
                                                </span>
                                            )}
                                            {!isManual && (p as any).dailyPayRate ? (
                                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                                    ${Number((p as any).dailyPayRate).toLocaleString()}/day
                                                </span>
                                            ) : null}
                                            {isManual && (
                                                <button onClick={() => {
                                                    setManualRecipients(prev => prev.filter(r => r.id !== p.id));
                                                    setSelectedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
                                                }} className="text-slate-600 hover:text-red-400 transition-colors ml-1"><XCircle className="w-3.5 h-3.5" /></button>
                                            )}
                                        </div>
                                    </label>
                                    {/* Not-Selected buttons removed — use Step 2 below after crew is selected */}
                                </div>
                            );
                        })}
                        {allRecipients.length === 0 && <p className="text-xs text-slate-500 text-center py-8">No pilots found</p>}
                    </div>

                    {/* Manual email add — supports bulk paste */}
                    <div className="p-3 border-t border-slate-700/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Add Emails Manually</p>
                            <p className="text-[10px] text-slate-600 italic">comma, space or newline separated</p>
                        </div>
                        <div className="flex gap-2">
                            <textarea
                                value={manualInput}
                                onChange={e => setManualInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addManualEmails())}
                                placeholder={`pilot@example.com, crew@example.com\nOr paste a list...`}
                                rows={2}
                                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-none"
                            />
                            <button
                                onClick={addManualEmails}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0 self-stretch"
                            >+ Add</button>
                        </div>
                        {manualRecipients.length > 0 && (
                            <p className="text-[10px] text-slate-600">
                                {manualRecipients.length} manual email{manualRecipients.length !== 1 ? 's' : ''} added · all default to <span className="text-amber-400 font-bold">$400/day</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: Email compose area */}
                <div className="flex flex-col gap-4">
                    {/* Mission detail summary (always shown) */}
                    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-800/40 border-b border-slate-700/60 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mission Data Included in Email</span>
                        </div>
                        <div className="p-3.5 space-y-1">
                            {previewLines.map((line, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                    <span className="text-emerald-500/70">✓</span>
                                    <span className="text-slate-300">{line}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI-generated email body — editable */}
                    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden flex flex-col flex-1 min-h-[180px]">
                        <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {aiBody ? (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 flex items-center gap-1">
                                        <BrainCircuit className="w-3 h-3" /> AI-Written Email Body
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email Body</span>
                                )}
                            </div>
                            {aiBody && (
                                <button onClick={() => { setAiBody(null); setAiSubject(null); }}
                                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3" /> Reset
                                </button>
                            )}
                        </div>
                        {aiBody !== null ? (
                            <textarea value={aiBody} onChange={e => setAiBody(e.target.value)} rows={8}
                                className="flex-1 w-full bg-transparent p-4 text-xs text-slate-200 resize-none focus:outline-none leading-relaxed"
                                placeholder="AI email body will appear here..." />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                                <BrainCircuit className="w-8 h-8 text-slate-700" />
                                <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                                    Click <strong className="text-violet-400">✨ Write with AI</strong> to generate a professional email explaining the mission
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Additional admin note */}
                    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-700/60">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Additional Note <span className="font-normal text-slate-600">(optional)</span></span>
                        </div>
                        <textarea value={additionalNote} onChange={e => setAdditionalNote(e.target.value)} rows={2}
                            placeholder="Any extra context to include..."
                            className="w-full bg-transparent p-3 text-xs text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none" />
                    </div>

                    {/* Send / Preview button */}
                    <button onClick={() => { setPreviewIdx(0); setShowPreview(true); }} disabled={selectedIds.size === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg shadow-violet-500/20">
                        <Eye className="w-4 h-4" />
                        {`Preview & Send to ${selectedIds.size || 0} Recipient${selectedIds.size !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>

            {/* ── Email Preview Modal ── */}
            {showPreview && previewRecipients.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowPreview(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
                            <div>
                                <h3 className="font-bold text-white text-sm">Email Preview</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Recipient {previewIdx + 1} of {previewRecipients.length}: <span className="text-violet-400 font-bold">{previewRecipients[previewIdx]?.email}</span>
                                </p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="text-slate-500 hover:text-white transition-colors"><XCircle className="w-5 h-5" /></button>
                        </div>

                        {/* Recipient nav */}
                        {previewRecipients.length > 1 && (
                            <div className="flex gap-1.5 px-5 py-2.5 border-b border-slate-800 flex-wrap">
                                {previewRecipients.map((r, i) => (
                                    <button key={r.id || r.email} onClick={() => setPreviewIdx(i)}
                                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                                            i === previewIdx ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                        }`}>
                                        {(r as any).fullName || (r as any).name || r.email}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Email preview body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-4">
                            {/* Subject */}
                            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Subject</p>
                                <p className="text-sm font-semibold text-white">
                                    {aiSubject || `Mission Opportunity — ${deployment.title}`}
                                </p>
                            </div>
                            {/* To */}
                            <div className="flex gap-3 text-xs">
                                <span className="text-slate-500 font-bold w-6 shrink-0">To:</span>
                                <span className="text-slate-300">{previewRecipients[previewIdx]?.email}</span>
                            </div>
                            {/* Body */}
                            <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Email Body</p>
                                {aiBody ? (
                                    <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                                        {aiBody.replace(/\[Name\]/gi, (previewRecipients[previewIdx] as any)?.fullName || (previewRecipients[previewIdx] as any)?.name || 'Pilot')}
                                    </pre>
                                ) : (
                                    <div className="space-y-2 text-xs text-slate-400">
                                        <p>Hi {(previewRecipients[previewIdx] as any)?.fullName || (previewRecipients[previewIdx] as any)?.name || 'Pilot'},</p>
                                        <p>We have an upcoming mission opportunity:</p>
                                        {previewLines.map((l, i) => <p key={i} className="text-slate-300">• {l}</p>)}
                                        {additionalNote && <p className="mt-2 text-slate-300">{additionalNote}</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* LinkedIn Blast Toggle */}
                        <div className="px-5 py-4 border-t border-slate-700/60 bg-slate-800/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                                    in
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">LinkedIn Blast</p>
                                    <p className="text-[10px] text-slate-400">Post this opportunity to the authorized LinkedIn feed</p>
                                </div>
                            </div>
                            <button onClick={() => setPostToLinkedIn(!postToLinkedIn)} 
                                className={`w-10 h-5 rounded-full relative transition-colors border border-transparent focus:outline-none ${postToLinkedIn ? 'bg-blue-600' : 'bg-slate-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${postToLinkedIn ? 'left-[1.3rem]' : 'left-[0.125rem]'}`} />
                            </button>
                        </div>

                        {/* Footer actions */}
                        <div className="flex gap-3 px-5 py-4 border-t border-slate-700/60">
                            <button onClick={() => setShowPreview(false)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleSend} disabled={sending}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg disabled:opacity-50">
                                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                {sending ? 'Sending…' : `Confirm & Send to ${selectedIds.size}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 1 Send Results ── */}
            {sent && results.length > 0 && (
                <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Inquiry Sent — {results.filter(r => r.status === 'sent').length} of {results.length} delivered
                        </span>
                        <button onClick={() => { setSent(false); setResults([]); setSelectedIds(new Set()); setAiBody(null); setAiSubject(null); setAdditionalNote(''); }}
                            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> New Inquiry
                        </button>
                    </div>
                    <div className="p-4 flex flex-wrap gap-2">
                        {results.map(r => (
                            <div key={r.pilotId} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                r.status === 'sent'    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                r.status === 'skipped' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                                {r.status === 'sent' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {r.pilotName}
                                {r.reason && <span className="opacity-60 font-normal ml-1">· {r.reason}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Step 2: Notify Not Selected ── */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-700/60 flex items-center justify-between gap-3">
                    <div>
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Step 2 · Notify Not Selected</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            After crew is assigned — notify pilots who received an inquiry but weren't selected.
                        </p>
                    </div>
                    <button
                        onClick={loadInquiryRecipients}
                        disabled={loadingRecipients}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                        {loadingRecipients ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Refresh
                    </button>
                </div>

                {loadingRecipients && (
                    <div className="flex items-center gap-2 p-4 text-xs text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading inquiry history…
                    </div>
                )}


                {inquiryRecipients && !loadingRecipients && (
                    <>
                        {inquiryRecipients.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-6">No inquiry emails have been sent for this mission yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-800/80">
                                {inquiryRecipients.map(r => (
                                    <div key={r.pilotId} className={`flex items-center gap-3 px-4 py-2.5 ${r.assigned ? 'opacity-50' : ''}`}>
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.assigned ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-200 truncate">{r.pilotName}</p>
                                            <p className="text-[10px] text-slate-500">
                                                Inquiry sent {new Date(r.sentAt).toLocaleDateString()}
                                                {r.assigned && <span className="ml-2 text-emerald-400 font-bold">· Assigned to mission</span>}
                                            </p>
                                        </div>
                                        {r.assigned ? (
                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex-shrink-0">
                                                Selected ✓
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex-shrink-0">
                                                Not assigned
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Bulk notify button — only for non-assigned recipients */}
                        {inquiryRecipients.filter(r => !r.assigned).length > 0 && (
                            <div className="px-4 py-3 border-t border-slate-700/60 flex items-center justify-between gap-3">
                                <p className="text-[10px] text-slate-500">
                                    <span className="text-amber-400 font-bold">{inquiryRecipients.filter(r => !r.assigned).length}</span> pilot{inquiryRecipients.filter(r => !r.assigned).length !== 1 ? 's' : ''} to notify
                                </p>
                                <button
                                    onClick={handleNotifyNotSelected}
                                    disabled={notifyingNotSelected}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-400 text-xs font-bold rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                                >
                                    {notifyingNotSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    {notifyingNotSelected ? 'Sending…' : 'Send Not Selected Notices'}
                                </button>
                            </div>
                        )}

                        {/* After sending notify results */}
                        {notifyResults.length > 0 && (
                            <div className="px-4 pb-4 flex flex-wrap gap-2">
                                {notifyResults.map(r => (
                                    <div key={r.pilotId} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border ${
                                        r.status === 'sent' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                                    }`}>
                                        {r.status === 'sent' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                        {r.pilotName}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="px-4 pb-3 flex justify-end">
                            <button onClick={loadInquiryRecipients} disabled={loadingRecipients}
                                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" /> Refresh
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};


const DeploymentTracker: React.FC<{ forcedStatus?: DeploymentStatus; industryFilter?: string; countryFilter?: string | null; countryIsoCode?: string | null }> = ({ forcedStatus, industryFilter, countryFilter, countryIsoCode }) => {
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const { mission, setActiveMission } = useMission();
    const { currentIndustry } = useIndustry();
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
    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'kanban'>(() => (sessionStorage.getItem('dt_viewMode') as any) || 'kanban');

    // Lifecycle Transition Logic
    const getNextAllowedStatuses = (current: DeploymentStatus): DeploymentStatus[] => {
        const allowed: Record<string, DeploymentStatus[]> = {
            [DeploymentStatus.DRAFT]:      [DeploymentStatus.SCHEDULED, DeploymentStatus.ARCHIVED],
            [DeploymentStatus.SCHEDULED]:  [DeploymentStatus.COMPLETED, DeploymentStatus.CANCELLED, DeploymentStatus.DELAYED, DeploymentStatus.DRAFT],
            [DeploymentStatus.ACTIVE]:     [DeploymentStatus.COMPLETED, DeploymentStatus.CANCELLED],   // legacy — hidden in Kanban but kept for data integrity
            [DeploymentStatus.REVIEW]:     [DeploymentStatus.COMPLETED],                               // legacy — hidden in Kanban but kept for data integrity
            [DeploymentStatus.COMPLETED]:  [DeploymentStatus.ARCHIVED],
            [DeploymentStatus.ARCHIVED]:   [] // Terminal
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
    // Email composer state
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [emailModalTab, setEmailModalTab] = useState<'preview' | 'edit'>('preview');

    const [activeModalTab, setActiveModalTab] = useState<'logs' | 'files' | 'financials' | 'team' | 'site-assets' | 'assignments' | 'checklist' | 'ai-reports' | 'weather' | 'axis-intel' | 'forecast' | 'sessions' | 'solar' | 'thermal' | 'field-reports' | 'orthomosaic' | 'blocks'>('logs');
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

    // Mission-level expenses (linked to mission_expenses table)
    const [missionExpenses, setMissionExpenses] = useState<any[]>([]);
    const [loadingMissionExpenses, setLoadingMissionExpenses] = useState(false);
    const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const [expenseForm, setExpenseForm] = useState({
        category: 'Other', description: '', amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        vendor: '', notes: ''
    });
    const EXPENSE_CATEGORIES = ['Fuel', 'Lodging', 'Equipment', 'Travel', 'Software', 'Subcontractor', 'Other'];

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
        if (!selectedDeployment || !newLog.technicianId || newLog.dailyPay == null) return;
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
        // Wait for IndustryContext to hydrate from localStorage (it starts as null)
        // before fetching, so we don't get a flash of all missions then filter.
        if (currentIndustry === null) return;
        fetchDeployments();
        fetchPersonnel();
        fetchAllUsers();
        fetchClients();
        fetchSites();
        fetchCountries();
    }, [currentIndustry, countryFilter]);

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
            const params = new URLSearchParams();
            if (currentIndustry) params.append('industryKey', currentIndustry);
            if (countryFilter) params.append('country_id', countryFilter);
            const url = params.toString() ? `/deployments?${params.toString()}` : '/deployments';
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
            const params = new URLSearchParams();
            if (countryFilter) params.append('country_id', countryFilter);
            const url = params.toString() ? `/personnel?${params.toString()}` : '/personnel';
            const response = await apiClient.get(url);
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
            fetchMissionExpenses(deployment.id);
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
        // Fetch fresh deployment data with daily logs AND files AND pilot reports
        try {
            const [deployResponse, filesResponse, pilotReportsResponse, assignmentsResponse] = await Promise.all([
                apiClient.get(`/deployments/${deployment.id}`),
                apiClient.get(`/deployments/${deployment.id}/files`),
                apiClient.get(`/deployments/${deployment.id}/pilot-reports`).catch(() => ({ data: { data: [] } })),
                apiClient.get(`/deployments/${deployment.id}/assignments`).catch(() => ({ data: { data: [] } })),
            ]);

            const freshDeployment = deployResponse.data.data;
            setSelectedDeployment({
                ...freshDeployment,
                files: filesResponse.data.data,
                pilotReports: pilotReportsResponse.data.data || [],
                assignments: assignmentsResponse.data.data || [],
            });

            // If the deployment has a siteId, pre-fetch assets
            if (freshDeployment.siteId) {
                fetchSiteAssets(freshDeployment.siteId);
            }

            // Fetch client stakeholders if we have a client ID
            if (freshDeployment.clientId) {
                fetchClientStakeholders(freshDeployment.clientId);
            }

            setActiveModalTab(user?.role === 'pilot_technician' ? 'files' : 'financials');
            if (freshDeployment.id) fetchMissionExpenses(freshDeployment.id);
            // Sync active mission context platform-wide
            setActiveMission({
                id: freshDeployment.id,
                title: freshDeployment.title || freshDeployment.name || null,
                status: freshDeployment.mission_status_v2 || freshDeployment.status || null,
            });
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

                // Use native fetch instead of apiClient to guarantee multipart/form-data content-type.
                // apiClient has a default Content-Type: application/json that survives axios interceptors
                // in the production bundle — native fetch auto-sets the correct multipart boundary.
                const token = sessionStorage.getItem('skylens_token');
                const fetchResponse = await fetch(`/api/deployments/${selectedDeployment.id}/files`, {
                    method: 'POST',
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: formData
                });
                if (!fetchResponse.ok) {
                    const errData = await fetchResponse.json().catch(() => ({ message: `HTTP ${fetchResponse.status}` }));
                    throw new Error(errData.message || `HTTP ${fetchResponse.status}`);
                }
                const responseData = await fetchResponse.json();
                if (responseData.success) {
                    const newFile = responseData.data;
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
            // Re-fetch this specific deployment so technicianIds reflects deployment_personnel correctly
            const [depRes, filesRes] = await Promise.all([
                apiClient.get(`/deployments/${selectedDeployment.id}`),
                apiClient.get(`/deployments/${selectedDeployment.id}/files`)
            ]);
            const fresh = depRes.data.data;
            setSelectedDeployment({ ...fresh, files: filesRes.data.data });
            setDeployments(prev => prev.map(d => d.id === fresh.id ? { ...d, technicianIds: fresh.technicianIds } : d));
        } catch (err: any) {
            console.error('Error assigning personnel:', err);
            alert(err.message);
        }
    };

    const handleUnassignPersonnel = async (personnelId: string) => {
        if (!selectedDeployment) return;
        try {
            await apiClient.delete(`/deployments/${selectedDeployment.id}/personnel/${personnelId}`);
            // Re-fetch to reflect removal
            const [depRes, filesRes] = await Promise.all([
                apiClient.get(`/deployments/${selectedDeployment.id}`),
                apiClient.get(`/deployments/${selectedDeployment.id}/files`)
            ]);
            const fresh = depRes.data.data;
            setSelectedDeployment({ ...fresh, files: filesRes.data.data });
            setDeployments(prev => prev.map(d => d.id === fresh.id ? { ...d, technicianIds: fresh.technicianIds } : d));
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

    /** True when a mission's financials are finalized (no further changes expected) */
    const isMissionClosed = (d: Deployment) =>
        d.status === 'Completed' || d.status === 'Archived';

    // ── Mission Expense Handlers ─────────────────────────────────────────────
    const fetchMissionExpenses = async (deploymentId: string) => {
        setLoadingMissionExpenses(true);
        try {
            const res = await apiClient.get(`/deployments/${deploymentId}/expenses`);
            setMissionExpenses(res.data.data || []);
        } catch (e) { console.error('[fetchMissionExpenses]', e); }
        finally { setLoadingMissionExpenses(false); }
    };

    const handleSaveExpense = async () => {
        if (!selectedDeployment || !expenseForm.description || !expenseForm.amount) return;
        try {
            if (editingExpenseId) {
                // Edit existing
                const res = await apiClient.put(`/deployments/${selectedDeployment.id}/expenses/${editingExpenseId}`, {
                    ...expenseForm, amount: parseFloat(expenseForm.amount)
                });
                setMissionExpenses(prev => prev.map(e => e.id === editingExpenseId ? res.data.data : e));
            } else {
                // Add new
                const res = await apiClient.post(`/deployments/${selectedDeployment.id}/expenses`, {
                    ...expenseForm, amount: parseFloat(expenseForm.amount)
                });
                setMissionExpenses(prev => [res.data.data, ...prev]);
            }
            setShowAddExpenseForm(false);
            setEditingExpenseId(null);
            setExpenseForm({ category: 'Other', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], vendor: '', notes: '' });
        } catch (e) { console.error('[handleSaveExpense]', e); }
    };

    const handleDeleteExpense = async (expId: string) => {
        if (!selectedDeployment || !confirm('Delete this expense?')) return;
        try {
            await apiClient.delete(`/deployments/${selectedDeployment.id}/expenses/${expId}`);
            setMissionExpenses(prev => prev.filter(e => e.id !== expId));
        } catch (e) { console.error('[handleDeleteExpense]', e); }
    };

    const handleStartEditExpense = (exp: any) => {
        setEditingExpenseId(exp.id);
        setExpenseForm({
            category: exp.category || 'Other',
            description: exp.description || '',
            amount: String(exp.amount || ''),
            expense_date: exp.expense_date ? String(exp.expense_date).split('T')[0] : new Date().toISOString().split('T')[0],
            vendor: exp.vendor || '',
            notes: exp.notes || ''
        });
        setShowAddExpenseForm(true);
    };

    const [editingDeploymentId, setEditingDeploymentId] = useState<string | null>(null);

    // City autocomplete state
    const [citySuggestions, setCitySuggestions] = useState<Array<{ name: string; admin1: string; country_code: string; lat: number; lon: number }>>([]);
    const [citySearching, setCitySearching] = useState(false);
    const citySearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCityInput = (value: string) => {
        setNewDeployment({ ...newDeployment, location: value, latitude: undefined as any, longitude: undefined as any } as any);
        if (citySearchTimer.current) clearTimeout(citySearchTimer.current);
        if (value.length < 2) { setCitySuggestions([]); return; }
        citySearchTimer.current = setTimeout(async () => {
            setCitySearching(true);
            try {
                const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=6&language=en&format=json`);
                const data = await res.json();
                setCitySuggestions((data.results || []).map((r: any) => ({
                    name: r.name,
                    admin1: r.admin1 || '',
                    country_code: r.country_code || '',
                    lat: r.latitude,
                    lon: r.longitude,
                })));
            } catch { setCitySuggestions([]); }
            finally { setCitySearching(false); }
        }, 300);
    };

    const handleCitySelect = (city: { name: string; admin1: string; country_code: string; lat: number; lon: number }) => {
        // Build location as "City, State" — include state/region if available
        const locationLabel = city.admin1 ? `${city.name}, ${city.admin1}` : city.name;
        setNewDeployment({
            ...newDeployment,
            location: locationLabel,
            state: city.admin1,
            latitude: city.lat,
            longitude: city.lon,
        } as any);
        setCitySuggestions([]);
    };

    const [newDeployment, setNewDeployment] = useState<Partial<Deployment>>({
        type: DeploymentType.ROUTINE,
        status: DeploymentStatus.SCHEDULED,
        date: new Date().toISOString().split('T')[0],
        clientId: '',
        countryId: '' // Add country support
    });

    const handleEditMission = async (deployment: Deployment) => {
        setEditingDeploymentId(deployment.id);
        let initLat = (deployment as any).latitude ?? undefined;
        let initLon = (deployment as any).longitude ?? undefined;

        // Auto-geocode from existing location text if no coords stored
        if ((!initLat || !initLon) && deployment.location) {
            try {
                const searchTerm = String(deployment.location).split(',')[0].trim();
                if (searchTerm.length >= 2) {
                    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`);
                    const geoData = await geoRes.json();
                    if (geoData.results?.length > 0) {
                        initLat = geoData.results[0].latitude;
                        initLon = geoData.results[0].longitude;
                    }
                }
            } catch (_) { /* non-fatal */ }
        }

        setNewDeployment({
            title: deployment.title,
            type: deployment.type,
            status: deployment.status,
            siteName: deployment.siteName,
            date: String(deployment.date).split('T')[0],
            location: deployment.location,
            state: (deployment as any).state || '',
            notes: deployment.notes,
            daysOnSite: deployment.daysOnSite,
            pilotsNeeded: (deployment as any).pilotsNeeded || '',
            clientId: deployment.clientId,
            countryId: deployment.countryId,
            latitude: initLat,
            longitude: initLon,
        } as any);
        setIsAddModalOpen(true);
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
                    pilotsNeeded: (newDeployment as any).pilotsNeeded || null,
                    clientId: newDeployment.clientId,
                    countryId: newDeployment.countryId,
                    industryKey: currentIndustry || null,
                    latitude: (newDeployment as any).latitude || undefined,
                    longitude: (newDeployment as any).longitude || undefined,
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
                    pilotsNeeded: (newDeployment as any).pilotsNeeded || null,
                    clientId: newDeployment.clientId,
                    countryId: newDeployment.countryId,
                    industryKey: currentIndustry || null,
                    latitude: (newDeployment as any).latitude || undefined,
                    longitude: (newDeployment as any).longitude || undefined,
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
        // Build default email template for preview/editing
        const dep = selectedDeployment;
        const targetIds = specificPersonnelIds && specificPersonnelIds.length > 0
            ? specificPersonnelIds
            : Array.from(selectedPersonnelForInvoice);

        // Determine sample pilot name for preview
        const isSingle = targetIds.length === 1;
        const samplePilot = isSingle
            ? (personnel.find(p => String(p.id) === String(targetIds[0]))?.fullName || '[Pilot Name]')
            : '[Pilot Name]';
        const sampleAmount = isSingle
            ? (() => {
                const logs = (dep.dailyLogs || []).filter(l => String(l.technicianId) === String(targetIds[0]));
                return logs.reduce((s, l) => s + (l.dailyPay || 0) + (l.bonusPay || 0), 0);
            })()
            : null;

        const defaultSubject = `Invoice Ready: ${dep.title}`;
        const defaultBody = `Hi {PILOT_NAME},

An invoice has been generated for your recent mission:

  Mission: ${dep.title}
  Site: ${dep.siteName || dep.siteName || 'N/A'}
  Total Amount: {AMOUNT}

Please click the link below to view and acknowledge your invoice:

  {INVOICE_LINK}

If you have any questions, please reach out to operations.`;

        setEmailSubject(defaultSubject);
        setEmailBody(defaultBody);
        setEmailModalTab('preview');
        setPendingInvoiceIds(specificPersonnelIds || []);
        setShowInvoiceNoteModal(true);
    };

    const handleConfirmSendInvoices = async () => {
        if (!selectedDeployment) return;
        setShowInvoiceNoteModal(false);

        // Determine the target list
        const idsToUse = pendingInvoiceIds && pendingInvoiceIds.length > 0
            ? pendingInvoiceIds
            : Array.from(selectedPersonnelForInvoice);

        const isSelective = idsToUse.length > 0;

        try {
            const payload = isSelective
                ? { personnelIds: idsToUse, sendToPilots, adminNote: invoiceNote.trim() || undefined, emailSubject: emailSubject.trim() || undefined, emailBody: emailBody.trim() || undefined }
                : { sendToPilots, adminNote: invoiceNote.trim() || undefined, emailSubject: emailSubject.trim() || undefined, emailBody: emailBody.trim() || undefined };

            const response = await apiClient.post(`/deployments/${selectedDeployment.id}/invoices/send`, payload);
            setInvoiceNote('');
            setEmailSubject('');
            setEmailBody('');
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
        // Country filter logic:
        // - If mission has a country_id set: only show if it matches the selected country
        // - If mission has NO country_id (null/untagged): show under US only, hide for all other countries
        if (countryFilter) {
            if (d.countryId) {
                // Explicitly tagged — strict match
                if (String(d.countryId) !== String(countryFilter)) return false;
            } else {
                // Untagged mission — only show under United States (all existing missions are US-based)
                if (countryIsoCode !== 'US') return false;
            }
        }

        // Only filter by client/site/country when BOTH the filter and the deployment field have values
        if (mission.client && mission.client !== "" && d.clientId && String(d.clientId) !== String(mission.client)) return false;
        if (mission.site && mission.site !== "" && d.siteId && String(d.siteId) !== String(mission.site)) return false;
        if (mission.country && mission.country !== "" && d.countryId && String(d.countryId) !== String(mission.country)) return false;
        const search = searchQuery.toLowerCase().trim();
        const matchesSearch = !search ||
            (d.title || '').toLowerCase().includes(search) ||
            (d.siteName || '').toLowerCase().includes(search) ||
            (d.clientName || '').toLowerCase().includes(search) ||
            (String(d.id || '')).toLowerCase().includes(search);
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

    // Calculate Terminal Metrics — scoped to filtered (country-aware) deployments
    const totalMissionsCount = filteredDeployments.length;
    const totalFleetSpend = filteredDeployments.reduce((sum, d) => sum + getTotalCost(d), 0);
    const totalDataAssets = filteredDeployments.reduce((sum, d) => sum + (d.fileCount || 0), 0);
    const groundTeamCount = personnel.length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ── Email Composer Modal ── */}
            {showInvoiceNoteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="bg-slate-900 px-6 py-4 flex items-start justify-between gap-4 shrink-0">
                            <div>
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-sky-400" />
                                    Compose Invoice Email
                                </h3>
                                <p className="text-slate-400 text-xs mt-0.5">
                                    {(() => {
                                        const ids = pendingInvoiceIds && pendingInvoiceIds.length > 0 ? pendingInvoiceIds : Array.from(selectedPersonnelForInvoice);
                                        if (ids.length === 1) {
                                            const p = personnel.find(px => String(px.id) === String(ids[0]));
                                            return `To: ${p?.fullName || 'pilot'} · ${p?.email || ''}`;
                                        }
                                        return ids.length > 0 ? `Sending to ${ids.length} pilots` : 'Sending to all eligible pilots';
                                    })()}
                                    {!sendToPilots && ' · Generating only (not emailing)'}
                                </p>
                            </div>
                            <button onClick={() => { setShowInvoiceNoteModal(false); setPendingInvoiceIds(undefined); }} className="text-slate-400 hover:text-white transition-colors mt-0.5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tab bar */}
                        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
                            <button
                                onClick={() => setEmailModalTab('preview')}
                                className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 ${emailModalTab === 'preview' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                👁 Preview
                            </button>
                            <button
                                onClick={() => setEmailModalTab('edit')}
                                className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 ${emailModalTab === 'edit' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                ✏️ Edit
                            </button>
                            <div className="flex-1" />
                            <div className="flex items-center px-4 gap-2 text-[11px] text-slate-400 font-mono">
                                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{'{PILOT_NAME}'}</span>
                                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{'{AMOUNT}'}</span>
                                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{'{INVOICE_LINK}'}</span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                            {emailModalTab === 'edit' ? (
                                <div className="p-6 space-y-4">
                                    {/* Subject */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subject Line</label>
                                        <input
                                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50"
                                            value={emailSubject}
                                            onChange={e => setEmailSubject(e.target.value)}
                                            placeholder="Email subject..."
                                        />
                                    </div>
                                    {/* Body */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                            Body
                                            <span className="ml-2 text-slate-400 normal-case font-normal">— use tokens above for pilot-specific values</span>
                                        </label>
                                        <textarea
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 leading-relaxed"
                                            rows={16}
                                            value={emailBody}
                                            onChange={e => setEmailBody(e.target.value)}
                                            placeholder="Email body..."
                                        />
                                    </div>
                                    {/* Note (still appended at the end if filled) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                            Ops Note <span className="font-normal text-slate-400">(appended in a blue callout box)</span>
                                        </label>
                                        <textarea
                                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50"
                                            rows={3}
                                            placeholder="Optional note from operations..."
                                            value={invoiceNote}
                                            onChange={e => setInvoiceNote(e.target.value)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* Preview tab — renders the email as it will look */
                                <div className="p-6">
                                    {/* Email chrome mock */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        {/* From / To / Subject row */}
                                        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 space-y-1 text-sm">
                                            <div className="flex gap-2 text-slate-500">
                                                <span className="font-semibold w-16 shrink-0">From:</span>
                                                <span className="text-slate-700">Coatzadrone Admin &lt;admin@coatzadroneusa.com&gt;</span>
                                            </div>
                                            <div className="flex gap-2 text-slate-500">
                                                <span className="font-semibold w-16 shrink-0">To:</span>
                                                <span className="text-slate-700">
                                                    {(() => {
                                                        const ids = pendingInvoiceIds && pendingInvoiceIds.length > 0 ? pendingInvoiceIds : Array.from(selectedPersonnelForInvoice);
                                                        if (ids.length === 1) {
                                                            const p = personnel.find(px => String(px.id) === String(ids[0]));
                                                            return p ? `${(p as any).fullName} <${p.email || 'no-email'}>` : 'Pilot';
                                                        }
                                                        return ids.length > 0 ? `${ids.length} pilots` : 'All eligible pilots';
                                                    })()}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 text-slate-500">
                                                <span className="font-semibold w-16 shrink-0">Subject:</span>
                                                <span className="text-slate-900 font-semibold">{emailSubject || '(no subject)'}</span>
                                            </div>
                                        </div>
                                        {/* Email body rendered */}
                                        <div className="bg-white px-8 py-6 font-sans">
                                            <div className="max-w-xl mx-auto space-y-4 text-sm text-slate-700 leading-relaxed">
                                                {emailBody.split('\n').map((line, i) => {
                                                    // Highlight tokens
                                                    const highlighted = line
                                                        .replace(/\{PILOT_NAME\}/g, '<span class="font-bold text-blue-700">[Pilot Name]</span>')
                                                        .replace(/\{AMOUNT\}/g, '<span class="font-bold text-emerald-600">[$Amount]</span>')
                                                        .replace(/\{INVOICE_LINK\}/g, '<a class="text-blue-600 underline" href="#">[Invoice Link]</a>');
                                                    return line.trim() === ''
                                                        ? <div key={i} className="h-2" />
                                                        : <p key={i} dangerouslySetInnerHTML={{ __html: highlighted }} />;
                                                })}
                                                {/* Ops note preview */}
                                                {invoiceNote.trim() && (
                                                    <div style={{ backgroundColor: '#f0f9ff', borderLeft: '4px solid #0ea5e9', padding: '14px 16px', marginTop: '16px', borderRadius: '4px' }}>
                                                        <p style={{ margin: 0, fontSize: '13px', color: '#0c4a6e', fontWeight: 600 }}>Note from Operations:</p>
                                                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>{invoiceNote}</p>
                                                    </div>
                                                )}
                                                {/* CTA button preview */}
                                                <div className="pt-2">
                                                    <span style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 20px', textDecoration: 'none', borderRadius: '5px', display: 'inline-block', fontSize: '13px', fontWeight: 600 }}>
                                                        View Invoice →
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-3 text-center">Tokens like <code className="bg-slate-100 px-1 rounded">{'{PILOT_NAME}'}</code> are replaced with real values per pilot before sending.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-200 px-6 py-4 flex items-center gap-3 bg-slate-50 shrink-0">
                            <button
                                onClick={() => { setShowInvoiceNoteModal(false); setInvoiceNote(''); setPendingInvoiceIds(undefined); }}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <div className="flex-1" />
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="sendToPilotsModal"
                                    checked={sendToPilots}
                                    onChange={e => setSendToPilots(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="sendToPilotsModal" className="text-sm text-slate-600 cursor-pointer select-none">Send email</label>
                            </div>
                            <button
                                onClick={handleConfirmSendInvoices}
                                className="px-7 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md flex items-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                {sendToPilots ? 'Send Invoices' : 'Generate Only'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-white">
                        {countryIsoCode ? `${isoToFlag(countryIsoCode)} Missions` : 'Missions'}
                    </h2>
                    <p className="text-sm text-slate-400">
                        {countryFilter
                            ? `${filteredDeployments.length} mission${filteredDeployments.length !== 1 ? 's' : ''} · ${countryIsoCode ?? 'regional'} operations`
                            : 'Manage fleet deployments, crew assignments, and logistics.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-white/10">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            title="Kanban Board"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            title="Calendar View"
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                    </div>

                    {user?.role !== 'pilot_technician' && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-sky-600 text-white text-xs md:text-sm font-semibold rounded-lg hover:bg-sky-500 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> Schedule Mission
                        </button>
                    )}
                </div>
            </div>

            {/* Terminal Metrics Grid — hidden for pilots */}
            {user?.role !== 'pilot_technician' && <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">


                <div className="bg-slate-900/60 backdrop-blur p-4 rounded-xl border border-white/10 shadow-sm">
                    <div className="flex items-center gap-2 mb-1 md:mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <BarChart3 className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Fleet Spend</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        {/* Yellow if any open mission contributes to this total */}
                        {(() => {
                            const pendingSpend = filteredDeployments.filter(d => !isMissionClosed(d)).reduce((s, d) => s + getTotalCost(d), 0);
                            const closedSpend  = filteredDeployments.filter(d =>  isMissionClosed(d)).reduce((s, d) => s + getTotalCost(d), 0);
                            return (
                                <>
                                    {closedSpend > 0 && (
                                        <span className="text-2xl font-bold text-white">${closedSpend.toLocaleString()}</span>
                                    )}
                                    {pendingSpend > 0 && (
                                        <span className={`text-2xl font-bold text-amber-400 ${closedSpend > 0 ? 'text-lg' : ''}`} title="Includes costs from open missions">
                                            {closedSpend > 0 ? `+$${pendingSpend.toLocaleString()}` : `$${pendingSpend.toLocaleString()}`}
                                        </span>
                                    )}
                                    {pendingSpend === 0 && closedSpend === 0 && <span className="text-2xl font-bold text-white">$0</span>}
                                    <span className="text-[10px] font-medium text-slate-500">USD</span>
                                    {pendingSpend > 0 && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">pending</span>}
                                </>
                            );
                        })()}
                    </div>
                </div>

                <div className="bg-slate-900/60 backdrop-blur p-4 rounded-xl border border-white/10 shadow-sm">
                    <div className="flex items-center gap-2 mb-1 md:mb-2">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                            <Zap className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Assets</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-white">{totalDataAssets}</span>
                        <span className="text-[10px] font-medium text-slate-500">FILES</span>
                    </div>
                </div>

                <div className="bg-slate-900/60 backdrop-blur p-4 rounded-xl border border-white/10 shadow-sm">
                    <div className="flex items-center gap-2 mb-1 md:mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                            <Users className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ground Team</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-white">{groundTeamCount}</span>
                        <span className="text-[10px] font-medium text-slate-500">ACTIVE</span>
                    </div>
                </div>
            </div>}

            {viewMode === 'calendar' ? (
                <CalendarView
                    deployments={filteredDeployments}
                    onDeploymentClick={handleViewDetails}
                    onDayClick={handleDayClick}
                    pilotReports={filteredDeployments.flatMap((d: any) => d.pilotReports || [])}
                />
            ) : viewMode === 'kanban' ? (
                <div className="flex gap-4 overflow-x-auto min-h-[600px] h-full pt-2 pb-6 pl-1 mi-scrollbar">
                    {[
                        { id: DeploymentStatus.SCHEDULED, label: 'Dispatched', color: '#f59e0b' },
                        { id: DeploymentStatus.COMPLETED, label: 'Delivered',  color: '#10b981' }
                    ].map(col => {
                        const colMissions = filteredDeployments.filter(d => d.status === col.id);
                        return (
                            <div key={col.id} className="flex-1 min-w-[280px] md:min-w-[320px] max-w-[400px] bg-slate-900/50 backdrop-blur rounded-xl border border-white/5 flex flex-col overflow-hidden h-[calc(100vh-280px)]">
                                <div className="px-4 py-3 border-b border-white/5 bg-slate-800/30 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm shadow-black/50" style={{ backgroundColor: col.color }} />
                                        <h3 className="font-semibold text-white/90 uppercase tracking-wider text-xs">{col.label}</h3>
                                    </div>
                                    <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                                        {colMissions.length}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 mi-scrollbar">
                                    {colMissions.map(deploy => (
                                        <div
                                            key={deploy.id}
                                            onClick={() => handleViewDetails(deploy)}
                                            className="bg-slate-800/90 border border-white/10 rounded-lg p-3.5 cursor-pointer hover:border-sky-500/50 hover:bg-slate-700 transition-all shadow-sm group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono text-[10px] text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded border border-sky-400/20">
                                                    {deploy.id ? deploy.id.split('-')[0].toUpperCase() : 'N/A'}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                                    <Calendar className="w-3 h-3" />
                                                    {deploy.date || 'TBD'}
                                                </div>
                                            </div>
                                            <h4 className="font-bold text-sm text-white leading-snug group-hover:text-sky-400 transition-colors">
                                                {deploy.title}
                                            </h4>
                                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                {deploy.clientName} {deploy.siteName ? `— ${deploy.siteName}` : ''}
                                            </p>
                                            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] font-medium text-slate-400">
                                                <div className="flex -space-x-1">
                                                    {deploy.personnelCount > 0 && (
                                                        <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-white/5">
                                                            <Users className="w-3 h-3 text-emerald-400" /> {deploy.personnelCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {deploy.fileCount > 0 && (
                                                        <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                                                            <Upload className="w-3 h-3 text-sky-400" /> {deploy.fileCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {colMissions.length === 0 && (
                                        <div className="flex-1 flex flex-col items-center justify-center py-8 opacity-40">
                                            <Box className="w-8 h-8 text-slate-500 mb-2" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Empty</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-slate-900/70 backdrop-blur rounded-xl border border-white/10 shadow-sm overflow-hidden min-h-[600px] flex flex-col text-white">
                    {/* Filters */}
                    <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center bg-slate-800 p-1 rounded-lg">
                            {(forcedStatus ? [forcedStatus] : ['All', DeploymentStatus.SCHEDULED, DeploymentStatus.ACTIVE, DeploymentStatus.COMPLETED]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => !forcedStatus && setStatusFilter(status as any)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === status
                                        ? 'bg-slate-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                        } ${forcedStatus ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search missions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Mission Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-2">
                        {filteredDeployments.map((deploy) => (
                            <div 
                                key={deploy.id} 
                                onClick={() => handleViewDetails(deploy)}
                                className="group relative bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-5 hover:bg-slate-800/80 hover:border-sky-500/40 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-sky-500/10"
                            >
                                {/* Glowing accent line */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/20 to-transparent group-hover:via-sky-400/60 transition-colors" />

                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="font-mono text-[9px] text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 uppercase tracking-widest">
                                                {deploy.id ? deploy.id.split('-')[0] : 'N/A'}
                                            </span>
                                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusColor(deploy.status)}`}>
                                                {deploy.status === DeploymentStatus.ACTIVE && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1" />}
                                                {deploy.status}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors truncate">{deploy.title}</h3>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate">{deploy.type}</p>
                                    </div>
                                    <div className="flex-shrink-0 text-right max-w-[100px]">
                                        {(() => {
                                            const clientName = deploy.clientName || clients.find((c: any) => c.id === deploy.clientId)?.name;
                                            return clientName ? (
                                                <div className="inline-flex items-center gap-1.5 text-[9px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">
                                                    <Building2 className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{clientName}</span>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="space-y-3 mb-5">
                                    <div className="flex items-start gap-2.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-slate-300 truncate">{deploy.siteName || 'Unknown Site'}</p>
                                            {deploy.location && <p className="text-[10px] text-slate-500 truncate">{deploy.location}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-slate-300">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        <span className="text-xs font-medium">{deploy.date}</span>
                                    </div>
                                    <div className="flex items-center gap-5 pt-1">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                                            <span className="text-xs font-bold text-slate-300">{deploy.fileCount || 0} <span className="font-normal text-[10px] text-slate-500 uppercase tracking-widest ml-0.5">Files</span></span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-slate-500" />
                                            <span className="text-xs font-bold text-slate-300">{deploy.personnelCount || 0} <span className="font-normal text-[10px] text-slate-500 uppercase tracking-widest ml-0.5">Crew</span></span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="pt-4 border-t border-slate-700/50 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-1.5">
                                        {deploy.status === DeploymentStatus.ACTIVE && (
                                            <>
                                                <button onClick={() => { setSelectedDeployment(deploy); setIsLogModalOpen(true); setActiveModalTab('files'); }} className="p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors group/btn relative" title="Upload Data">
                                                    <Upload className="w-4 h-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                                                </button>
                                                <button onClick={() => handleAIRegisteredScan(deploy)} className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors group/btn" title="AI Scan">
                                                    <BrainCircuit className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                                {isAdmin(user) && (
                                                    <button onClick={() => handleStatusChange(deploy.id, DeploymentStatus.COMPLETED)} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Mark Mission Complete">
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <button onClick={() => handleViewFinancials(deploy)} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="View Financials">
                                            <DollarSign className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => handleViewDetails(deploy)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors" title="Mission Details">
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                        {isAdmin(user) && (
                                            <button onClick={() => handleDeleteDeployment(deploy.id, deploy.title)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Mission">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>


                        {filteredDeployments.length === 0 && (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Plane className="w-5 h-5 text-slate-500" />
                                </div>
                                <h3 className="text-sm font-medium text-white">No missions found</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {user?.role === 'pilot_technician'
                                        ? "You don't have any assigned missions yet."
                                        : "Check your search terms or schedule a new mission."}
                                </p>
                                {user?.role !== 'pilot_technician' && (
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="mt-4 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-500 transition-colors shadow-sm"
                                    >
                                        Schedule Mission
                                    </button>
                                )}
                            </div>
                        )}
                </div>
            )}


            {/* Mission Details Modal */}
            {
                isLogModalOpen && selectedDeployment && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsLogModalOpen(false)}>
                    <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl animate-in zoom-in-95 duration-200 h-[85vh] flex flex-col text-white border border-white/10" onClick={e => e.stopPropagation()}>
                            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        Mission Details
                                        <button
                                            onClick={() => handleEditMission(selectedDeployment)}
                                            className="ml-2 p-1 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
                                            title="Edit Mission Details"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>

                                        {/* Status Transitions */}
                                        <div className="ml-4 flex items-center gap-2">
                                            {selectedDeployment.status !== DeploymentStatus.COMPLETED ? (
                                                <button
                                                    onClick={() => handleStatusChange(selectedDeployment.id, DeploymentStatus.COMPLETED)}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 hover:bg-emerald-500/20 transition-all shadow-sm group"
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                                    Complete Mission
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleStatusChange(selectedDeployment.id, DeploymentStatus.ACTIVE)}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition-all shadow-sm group"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
                                                    Uncomplete
                                                </button>
                                            )}
                                        </div>
                                    </h3>
                                    <p className="text-sm text-slate-400">{selectedDeployment.title} — {selectedDeployment.siteName}</p>
                                </div>
                                <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-white">
                                    &times;
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-white/10 px-6 overflow-x-auto overscroll-contain scrollbar-hide" onWheel={e => e.stopPropagation()}>
                                {user?.role === 'pilot_technician' ? (
                                    <>
                                        <button
                                            onClick={() => setActiveModalTab('files')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModalTab === 'files' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4" />
                                                Mission Documents
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setActiveModalTab('assignments')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModalTab === 'assignments' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <ClipboardList className="w-4 h-4" />
                                                My Assignments
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setActiveModalTab('field-reports')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeModalTab === 'field-reports' ? 'border-green-500 text-green-400 bg-green-500/5' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Field Reports
                                        </button>
                                        <button
                                            onClick={() => setActiveModalTab('blocks')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModalTab === 'blocks' ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Grid3X3 className="w-4 h-4" />
                                                Block Grid
                                            </div>
                                        </button>
                                    </>
                                ) : (
                                    <>

                                        {/* Field Reports */}
                                        <button
                                            onClick={() => setActiveModalTab('field-reports')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeModalTab === 'field-reports' ? 'border-green-500 text-green-400 bg-green-500/5' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            Field Reports
                                        </button>

                                        {/* Mission Documents & Assets */}
                                        <button
                                            onClick={() => setActiveModalTab('files')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModalTab === 'files' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-4 h-4" />
                                                Mission Documents
                                            </div>
                                        </button>

                                        {/* Team */}
                                        <button
                                            onClick={() => setActiveModalTab('team')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModalTab === 'team' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Team
                                            </div>
                                        </button>



                                        {/* Assignments */}
                                        <button
                                            onClick={() => setActiveModalTab('assignments')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModalTab === 'assignments' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Target className="w-4 h-4" />
                                                Assignments
                                            </div>
                                        </button>

                                        {/* Weather */}
                                        <button
                                            onClick={() => setActiveModalTab('weather')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeModalTab === 'weather' ? 'border-sky-500 text-sky-400 bg-sky-500/5' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                                        >
                                            <Cloud className="w-4 h-4" />
                                            Weather
                                        </button>

                                        {/* Finance (Pilot Pay + Expenses) — visible to all non-pilot roles */}
                                        {user?.role !== 'pilot_technician' && (
                                            <button
                                                onClick={() => { setActiveModalTab('financials'); if (selectedDeployment) fetchMissionExpenses(selectedDeployment.id); }}
                                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                                    activeModalTab === 'financials'
                                                        ? 'border-amber-400 text-amber-400'
                                                        : isMissionClosed(selectedDeployment)
                                                            ? 'border-transparent text-emerald-400/70 hover:text-emerald-300'
                                                            : 'border-transparent text-amber-500/70 hover:text-amber-400'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4" />
                                                    Finance
                                                    {!isMissionClosed(selectedDeployment) && getTotalCost(selectedDeployment) > 0 && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                            ${getTotalCost(selectedDeployment).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        )}

                                        {/* Block Grid — visible to admin + pilots */}
                                        <button
                                            onClick={() => setActiveModalTab('blocks')}
                                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeModalTab === 'blocks' ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Grid3X3 className="w-4 h-4" />
                                                Block Grid
                                            </div>
                                        </button>
                                    </>
                                )}
                            </div>

                            <div
                                id="mission-modal-body"
                                className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-900/50"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                {activeModalTab === 'checklist' ? (
                                    <div className="p-6">
                                        <WorkItemChecklist scopeType="mission" scopeId={selectedDeployment.id} />
                                    </div>
                                ) : activeModalTab === 'field-reports' ? (
                                    <div className="p-6">
                                        <DailyFieldReportsTab deploymentId={selectedDeployment.id} />
                                    </div>
                                ) : activeModalTab === 'files' ? (
                                    <div className="p-6 space-y-6">
                                        {/* Files / Assets Content */}
                                        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50/50 hover:border-blue-300 transition-all">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                                <Upload className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-slate-900">
                                                {user?.role === 'pilot_technician' ? 'Upload Mission Documents' : 'Upload Mission Assets'}
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

                                        {/* ── LBD Block Grid — visible to all roles ── */}
                                        <div className="border-t border-slate-700/40 pt-6">
                                            <LBDDocumentGrid
                                                deploymentId={selectedDeployment.id}
                                                userRole={user?.role}
                                            />
                                        </div>

                                        {/* ── LBD Upload + Admin Controls (admin only) ── */}
                                        {isAdmin(user) && (
                                            <div className="border-t border-slate-700/40 pt-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                                                        <Grid3X3 className="w-4 h-4 text-orange-400" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white">Block Import &amp; Assignment</h4>
                                                        <p className="text-[11px] text-slate-500">Upload CSV/XLSX to create blocks · Assign pilots to individual blocks</p>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                                    <LBDBlockTracker
                                                        deploymentId={selectedDeployment.id}
                                                        personnel={personnel}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Mission Document Ingest (admin only) ── */}
                                        {user?.role !== 'client' && user?.role !== 'client_user' && user?.role !== 'customer' && (
                                            <div className="border-t border-slate-100 pt-6">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <svg className="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                                                    <h4 className="text-sm font-bold text-slate-900">Mission Document Ingest</h4>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700">KML + Params</span>
                                                </div>
                                                <p className="text-xs text-slate-400 mb-3">Upload KML flight paths and parameter docs to auto-populate AI reports</p>
                                                <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950">
                                                    <FlightDataUpload
                                                        deploymentId={selectedDeployment.id}
                                                        deploymentTitle={selectedDeployment.title}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Performance Snapshot — Pilot View Only */}
                                        {user?.role === 'pilot_technician' && (
                                            <div className="border-t border-slate-100 pt-6 pb-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <BarChart3 className="w-4 h-4 text-violet-500" />
                                                    <h4 className="text-sm font-bold text-slate-900">Performance Snapshot</h4>
                                                </div>
                                                <PilotPerformanceSnapshot
                                                    missionId={selectedDeployment.id}
                                                    missionTitle={selectedDeployment.title}
                                                />
                                            </div>
                                        )}

                                        {/* Projected Completion Timeline — Client View */}
                                        {user?.role === 'client' && (
                                            <div className="border-t border-slate-100 pt-6 pb-4">
                                                <ClientCompletionTimeline
                                                    missionId={selectedDeployment.id}
                                                    missionTitle={selectedDeployment.title}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : activeModalTab === 'orthomosaic' ? (
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                                    <Grid3X3 className="w-5 h-5 text-sky-400" />
                                                    Orthomosaic Processing Status
                                                </h4>
                                                <p className="text-xs text-slate-400">Monitor photogrammetry jobs and pipeline stages for this mission.</p>
                                            </div>
                                            <a 
                                                href="/intelligence/orthomosaic" 
                                                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-white/10 hover:bg-slate-700 transition-all flex items-center gap-1.5"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Full Module
                                            </a>
                                        </div>
                                        
                                        <div className="bg-slate-950/50 rounded-xl border border-white/5 p-4">
                                            <div>Processing Jobs module is currently unavailable.</div>
                                        </div>
                                    </div>
                                ) : activeModalTab === 'financials' ? (
                                    <>
                                        <div className="p-6 space-y-6 mission-cost-report">
                                            {/* ── PILOT PAY (Daily Logs) — merged here ── */}
                                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                        <DollarSign className="w-4 h-4 text-blue-500" />
                                                        Pilot Pay — Daily Logs
                                                    </h4>
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                                        isMissionClosed(selectedDeployment)
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {isMissionClosed(selectedDeployment) ? `Total: $${getTotalCost(selectedDeployment).toLocaleString()}` : `Accruing: $${getTotalCost(selectedDeployment).toLocaleString()} est.`}
                                                    </span>
                                                </div>
                                                <div className="p-6 space-y-6">
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
                                                                    <button onClick={() => handleDeleteDay(day)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete entire day">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="p-4 space-y-4">
                                                                <div className="space-y-2">
                                                                    <div className="space-y-2">
                                                                        {(selectedDeployment.dailyLogs?.filter(l => String(l.date).split('T')[0] === day) || []).map(log => {
                                                                            const personName = personnel.find(p => String(p.id) === String(log.technicianId))?.fullName || `Pilot #${String(log.technicianId).slice(0, 8)}`;
                                                                            const totalPay = (editingLogId === log.id ? editForm.dailyPay + editForm.bonusPay : (log.dailyPay || 0) + (log.bonusPay || 0));
                                                                            return (
                                                                                <div key={log.id} className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded border border-slate-100">
                                                                                    <div className="flex items-center gap-3 flex-1">
                                                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">{personName.charAt(0)}</div>
                                                                                        <div className="flex-1">
                                                                                            <span className="font-medium text-slate-700 block">{personName}</span>
                                                                                            {editingLogId === log.id ? (
                                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                                    <div className="flex items-center gap-1">
                                                                                                        <span className="text-[10px] text-slate-400 uppercase">Rate:</span>
                                                                                                        <input type="number" className="w-20 px-1 py-0.5 text-xs border rounded" value={editForm.dailyPay} onChange={e => setEditForm({ ...editForm, dailyPay: parseFloat(e.target.value) || 0 })} />
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-1">
                                                                                                        <span className="text-[10px] text-emerald-500 uppercase">Bonus:</span>
                                                                                                        <input type="number" className="w-20 px-1 py-0.5 text-xs border rounded" value={editForm.bonusPay} onChange={e => setEditForm({ ...editForm, bonusPay: parseFloat(e.target.value) || 0 })} />
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                                                                    <span>Daily: ${log.dailyPay?.toLocaleString() || 0}</span>
                                                                                                    {(log.bonusPay || 0) > 0 && (<><span>•</span><span className="text-emerald-600 font-medium">Bonus: ${log.bonusPay?.toLocaleString()}</span></>)}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded border border-emerald-100 min-w-[80px] text-center">${totalPay.toLocaleString()}</span>
                                                                                        {editingLogId === log.id ? (
                                                                                            <>
                                                                                                <button onClick={() => saveEditLog(log.id)} className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Save"><Check className="w-4 h-4" /></button>
                                                                                                <button onClick={cancelEditLog} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors" title="Cancel"><X className="w-4 h-4" /></button>
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <button onClick={() => startEditLog(log)} className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                                                                                <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Remove"><Trash2 className="w-4 h-4" /></button>
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
                                                                        <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Add Pilot to This Day</h5>
                                                                        <div className="grid grid-cols-12 gap-2">
                                                                            <div className="col-span-5">
                                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pilot/Technician</label>
                                                                                <select className="w-full px-2 py-1.5 text-sm text-slate-800 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500/20 outline-none bg-white" value={newLog.technicianId || ''} onChange={e => { const sel = personnel.find(p => String(p.id) === String(e.target.value)); setNewLog({ ...newLog, technicianId: e.target.value, dailyPay: sel?.dailyPayRate || 0 }); }}>
                                                                                    <option value="">Select...</option>
                                                                                    {personnel.filter(p => p.status === 'Active' || p.status === 'Inactive' || p.status === 'On Leave').filter(p => !selectedDeployment.dailyLogs?.some(log => String(log.date).split('T')[0] === String(day).split('T')[0] && String(log.technicianId) === String(p.id))).map(person => (
                                                                                        <option key={person.id} value={person.id}>{person.fullName} ({person.role})</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div className="col-span-2">
                                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Daily Rate</label>
                                                                                <input type="number" className="w-full px-2 py-1.5 text-sm text-slate-800 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500/20 outline-none bg-white" placeholder="0" value={newLog.dailyPay ?? ''} onChange={e => setNewLog({ ...newLog, dailyPay: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                                                                            </div>
                                                                            <div className="col-span-2">
                                                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bonus Pay</label>
                                                                                <input type="number" className="w-full px-2 py-1.5 text-sm text-slate-800 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500/20 outline-none bg-white" placeholder="0" value={newLog.bonusPay ?? ''} onChange={e => setNewLog({ ...newLog, bonusPay: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                                                                            </div>
                                                                            <div className="col-span-3 flex items-end gap-1">
                                                                                <button type="button" onClick={e => { e.preventDefault(); handleAddLog(day); }} disabled={!newLog.technicianId || newLog.dailyPay == null} className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"><Plus className="w-3 h-3" /> Day</button>
                                                                                <button type="button" onClick={e => { e.preventDefault(); handleAddPilotToAllDays(); }} disabled={!newLog.technicianId || newLog.dailyPay == null} className="flex-1 px-2 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1" title="Add this pilot to every day"><Calendar className="w-3 h-3" /> All Days</button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {/* Add Extra Day */}
                                                    <div className="pt-4 border-t border-slate-200">
                                                        {isAddingExtraDay ? (
                                                            <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-4 animate-in fade-in slide-in-from-top-2">
                                                                <h4 className="text-sm font-bold text-slate-900 mb-2">Add Non-Consecutive Day</h4>
                                                                <div className="flex items-end gap-3">
                                                                    <div className="flex-1">
                                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Select Date</label>
                                                                        <input type="date" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" value={extraDayDate} onChange={e => setExtraDayDate(e.target.value)} />
                                                                    </div>
                                                                    <button onClick={confirmAddExtraDay} disabled={!extraDayDate} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Confirm Day</button>
                                                                    <button onClick={() => setIsAddingExtraDay(false)} className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setIsAddingExtraDay(true)} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-bold uppercase tracking-wider hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add Extra Day (Out of Range)</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* ── PENDING BANNER — shown when mission is still open ── */}
                                            {!isMissionClosed(selectedDeployment) && (
                                                <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending — Mission Open</p>
                                                        <p className="text-[11px] text-amber-400/70 mt-0.5">
                                                            Costs shown in <span className="font-bold text-amber-400">yellow</span> are provisional until this mission is marked <strong>Completed</strong> or <strong>Archived</strong>.
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-bold">Accrued So Far</p>
                                                        <p className="text-xl font-black text-amber-400">${getTotalCost(selectedDeployment).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            )}
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
                                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Pilot Cost</p>
                                                            <p className={`text-2xl font-bold ${
                                                                isMissionClosed(selectedDeployment) ? 'text-emerald-600' : 'text-amber-400'
                                                            }`}>
                                                                ${getTotalCost(selectedDeployment).toLocaleString()}
                                                                {!isMissionClosed(selectedDeployment) && (
                                                                    <span className="text-xs font-normal text-amber-400/60 ml-1">est.</span>
                                                                )}
                                                            </p>
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
                                                                            <p className={`text-xl font-bold ${
                                                                                isMissionClosed(selectedDeployment) ? 'text-emerald-600' : 'text-amber-400'
                                                                            }`}>
                                                                                ${totalPay.toLocaleString()}
                                                                                {!isMissionClosed(selectedDeployment) && (
                                                                                    <span className="ml-1 text-[9px] font-bold text-amber-500/70 uppercase tracking-wider">pending</span>
                                                                                )}
                                                                            </p>
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

                                        {/* ── Mission Expenses Panel ─────────────────────────────────── */}
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                        <Receipt className="w-4 h-4 text-blue-500" />
                                                        Mission Expenses
                                                        {!isMissionClosed(selectedDeployment) && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider">
                                                                Pending until mission closes
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {isMissionClosed(selectedDeployment)
                                                            ? 'Finalized — mission is closed.'
                                                            : 'Expenses are marked pending until this mission is Completed or Archived.'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => { setShowAddExpenseForm(v => !v); setEditingExpenseId(null); setExpenseForm({ category: 'Other', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], vendor: '', notes: '' }); }}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Add Expense
                                                </button>
                                            </div>

                                            {/* Add / Edit Form */}
                                            {showAddExpenseForm && (
                                                <div className="px-6 py-4 bg-blue-50/50 border-b border-blue-100 animate-in fade-in slide-in-from-top-1">
                                                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">
                                                        {editingExpenseId ? 'Edit Expense' : 'New Expense'}
                                                    </p>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                                                            <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 bg-white">
                                                                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="md:col-span-2">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Description *</label>
                                                            <input value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Hotel — Site A" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Amount ($) *</label>
                                                            <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Date</label>
                                                            <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vendor</label>
                                                            <input value={expenseForm.vendor} onChange={e => setExpenseForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Vendor name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notes</label>
                                                            <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 mt-3">
                                                        <button onClick={() => { setShowAddExpenseForm(false); setEditingExpenseId(null); }} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                                                        <button onClick={handleSaveExpense} disabled={!expenseForm.description || !expenseForm.amount} className="px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors">
                                                            {editingExpenseId ? 'Save Changes' : 'Add Expense'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Expenses List */}
                                            {loadingMissionExpenses ? (
                                                <div className="px-6 py-8 flex items-center justify-center text-slate-400 gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading expenses…
                                                </div>
                                            ) : missionExpenses.length === 0 ? (
                                                <div className="px-6 py-8 text-center text-slate-400 text-sm italic">
                                                    No expenses recorded for this mission yet.
                                                </div>
                                            ) : (
                                                <div>
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-50 border-b border-slate-100">
                                                            <tr className="text-slate-500 uppercase tracking-wider font-bold">
                                                                <th className="px-5 py-3 text-left">Category</th>
                                                                <th className="px-4 py-3 text-left">Description</th>
                                                                <th className="px-4 py-3 text-left">Vendor</th>
                                                                <th className="px-4 py-3 text-left">Date</th>
                                                                <th className="px-4 py-3 text-left">Status</th>
                                                                <th className="px-4 py-3 text-right">Amount</th>
                                                                <th className="px-4 py-3" />
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {missionExpenses.map(exp => (
                                                                <tr key={exp.id} className={`hover:bg-slate-50/60 transition-colors ${editingExpenseId === exp.id ? 'bg-blue-50/40' : ''}`}>
                                                                    <td className="px-5 py-3">
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{exp.category}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{exp.description || '—'}</td>
                                                                    <td className="px-4 py-3 text-slate-500">{exp.vendor || '—'}</td>
                                                                    <td className="px-4 py-3 font-mono text-slate-500">{exp.expense_date ? String(exp.expense_date).split('T')[0] : '—'}</td>
                                                                    <td className="px-4 py-3">
                                                                        {exp.status === 'confirmed' ? (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Confirmed</span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pending</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-black text-slate-900">${Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <button onClick={() => handleStartEditExpense(exp)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors rounded" title="Edit">
                                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button onClick={() => handleDeleteExpense(exp.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded" title="Delete">
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="border-t border-slate-200 bg-slate-50/80">
                                                            <tr>
                                                                <td colSpan={5} className="px-5 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">
                                                                    {isMissionClosed(selectedDeployment) ? 'Total Confirmed' : 'Total (Pending)'}
                                                                </td>
                                                                <td className={`px-4 py-3 text-right text-base font-black ${isMissionClosed(selectedDeployment) ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                    ${missionExpenses.reduce((s, e) => s + Number(e.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td />
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            )}
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
                                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <Plane className="w-4 h-4 text-blue-500" />
                                                    Flight Crew (Pilots/Techs)
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDeployment.technicianIds || []).map(techId => {
                                                        const p = personnel.find(per => per.id === techId);
                                                        if (!p) return null;
                                                        return (
                                                            <div key={techId} className="flex items-center justify-between p-3 bg-slate-800 border border-white/10 rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                                        {(p as any).fullName.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-white">{(p as any).fullName}</p>
                                                                        <div className="flex items-center gap-2">
                                                                            <p className="text-[10px] text-slate-500 font-bold uppercase">{p.role}</p>
                                                                            {calculateDistance(p.homeAddress, selectedDeployment.location) && (
                                                                                <span className="text-[10px] font-medium text-sky-400 bg-sky-500/10 px-1.5 rounded border border-sky-500/20">
                                                                                    {calculateDistance(p.homeAddress, selectedDeployment.location)} mi
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleNotifyAssignment(techId, 'CREW', (p as any).fullName)}
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
                                                        <p className="text-xs text-slate-500 italic bg-slate-800 p-4 rounded-lg border border-white/10 border-dashed text-center">No flight crew assigned.</p>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    <select
                                                        className="w-full px-3 py-2 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/30 outline-none"
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
                                                                        {(p as any).fullName} ({p.role}) {dist ? `- ${dist} mi` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Client Stakeholders */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                        <Briefcase className="w-4 h-4 text-purple-600" />
                                                        Client Stakeholders
                                                    </h4>
                                                    {selectedDeployment.clientName && (
                                                        <span className="text-xs font-semibold text-purple-300 bg-purple-900/30 px-2 py-1 rounded border border-purple-500/30">
                                                            {selectedDeployment.clientName}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    {(selectedDeployment.monitoringTeam || []).filter(u => u.missionRole === 'Client' || u.missionRole === 'Site Contact' || u.role === 'client_user').map(u => (
                                                        <div key={u.id} className={`flex items-center justify-between p-3 bg-slate-800 border rounded-lg ${u.missionRole === 'Site Contact' ? 'border-purple-500/40' : 'border-white/10'}`}>
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.missionRole === 'Site Contact' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600'}`}>
                                                                    {u.fullName.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-medium text-white">{u.fullName}</p>
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
                                                        <p className="text-xs text-slate-500 italic bg-slate-800 p-4 rounded-lg border border-white/10 border-dashed text-center">No client stakeholders assigned.</p>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    <select
                                                        className="w-full px-3 py-2 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500/30 outline-none"
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
                                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                                    Mission Monitoring (Control)
                                                </h4>
                                                <div className="space-y-2">
                                                    {(selectedDeployment.monitoringTeam || []).map(u => (
                                                        <div key={u.id} className="flex items-center justify-between p-3 bg-slate-800 border border-white/10 rounded-lg">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                                                    {u.fullName.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-white">{u.fullName}</p>
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
                                                        <p className="text-xs text-slate-500 italic bg-slate-800 p-4 rounded-lg border border-white/10 border-dashed text-center">No monitoring team assigned.</p>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    <select
                                                        className="w-full px-3 py-2 text-sm bg-slate-900 text-white border border-white/10 rounded-lg focus:ring-2 focus:ring-emerald-500/30 outline-none"
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
                                ) : activeModalTab === 'assignments' ? (
                                    <div className="p-6 bg-slate-900/50 min-h-full">
                                        <AssignmentsTab
                                            missionId={selectedDeployment.id}
                                            personnel={personnel}
                                            isAdmin={!!isAdmin(user)}
                                        />
                                    </div>
                                ) : activeModalTab === 'ai-reports' ? (
                                    <div className="h-full overflow-y-auto">
                                        <IndustryReportsHub
                                            missionId={selectedDeployment.id}
                                            missionTitle={selectedDeployment.title}
                                            missionSiteName={selectedDeployment.siteName}
                                            missionClientName={selectedDeployment.clientName}
                                            defaultIndustry={industryFilter ? (industryFilter.toLowerCase() as any) : undefined}
                                            singleIndustry={!!industryFilter}
                                        />
                                    </div>
                                ) : activeModalTab === 'weather' ? (
                                    <div className="h-full overflow-y-auto bg-slate-950">
                                        <div className="p-6">
                                            <WeatherDashboard
                                                initialLocation={
                                                    selectedDeployment.location ||
                                                    selectedDeployment.siteName ||
                                                    undefined
                                                }
                                            />
                                        </div>
                                    </div>
                                ) : activeModalTab === 'axis-intel' && isAdmin(user) ? (
                                    <div className="h-full overflow-y-auto bg-slate-950">
                                        <AxisIntelligencePanel
                                            missionId={selectedDeployment.id}
                                            missionTitle={selectedDeployment.title}
                                        />
                                    </div>
                                ) : activeModalTab === 'forecast' && isAdmin(user) ? (
                                    <div className="h-full overflow-y-auto bg-slate-950">
                                        <MissionForecastPanel
                                            missionId={selectedDeployment.id}
                                            missionTitle={selectedDeployment.title}
                                        />
                                    </div>
                                ) : activeModalTab === 'sessions' ? (
                                    <div className="h-full overflow-y-auto bg-slate-950 p-6">
                                        <MissionSessionPanel
                                            missionId={selectedDeployment.id}
                                            missionTitle={selectedDeployment.title}
                                        />
                                    </div>
                                ) : activeModalTab === 'solar' ? (
                                    <div className="h-full overflow-y-auto bg-slate-950">
                                        {/* LBD Block Tracker — progress table + CSV upload */}
                                        <div className="p-6 border-b border-slate-800">
                                            <LBDBlockTracker
                                                deploymentId={selectedDeployment.id}
                                                personnel={personnel}
                                            />
                                        </div>
                                        {/* Solar Block Map — geographic visual */}
                                        <div className="p-6">
                                            <SolarBlockMap deploymentId={selectedDeployment.id} />
                                        </div>
                                    </div>
                                ) : activeModalTab === 'thermal' ? (
                                    <div className="h-full overflow-y-auto bg-slate-950 p-6">
                                        <ThermalHotspotMap deploymentId={selectedDeployment.id} />
                                    </div>
                                ) : activeModalTab === 'blocks' ? (
                                    <div className="h-full overflow-y-auto bg-slate-950 p-6 space-y-6">
                                        {/* LBD Block Grid — interactive for pilots, read-only for others */}
                                        <LBDDocumentGrid
                                            deploymentId={selectedDeployment.id}
                                            userRole={user?.role}
                                        />
                                        {/* Block Import & Assignment — admin only */}
                                        {isAdmin(user) && (
                                            <div className="border-t border-slate-800 pt-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                                                        <Grid3X3 className="w-4 h-4 text-orange-400" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white">Block Import & Assignment</h4>
                                                        <p className="text-[11px] text-slate-500">Upload CSV/XLSX to create blocks · Assign pilots to individual blocks</p>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                                    <LBDBlockTracker
                                                        deploymentId={selectedDeployment.id}
                                                        personnel={personnel}
                                                    />
                                                </div>
                                            </div>
                                        )}
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

                                    {/* Site Name */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Site / Project Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Nevada Solar Array — Block C"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                                            value={newDeployment.siteName || ''}
                                            onChange={(e) => setNewDeployment({ ...newDeployment, siteName: e.target.value, siteId: undefined })}
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
                                        <div className="col-span-2 grid grid-cols-2 gap-3">
                                            {/* City — autocomplete */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">City</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        autoComplete="off"
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                                        value={newDeployment.location || ''}
                                                        onChange={e => handleCityInput(e.target.value)}
                                                        onBlur={() => setTimeout(() => setCitySuggestions([]), 200)}
                                                        placeholder="Start typing a city…"
                                                    />
                                                    {citySearching && (
                                                        <div className="absolute right-3 top-2.5 text-slate-400 text-xs">…</div>
                                                    )}
                                                    {citySuggestions.length > 0 && (
                                                        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-sm">
                                                            {citySuggestions.map((city, i) => (
                                                                <li
                                                                    key={i}
                                                                    onMouseDown={() => handleCitySelect(city)}
                                                                    className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                                >
                                                                    <span className="font-semibold text-slate-800">{city.name}</span>
                                                                    {city.admin1 && <span className="text-slate-500">, {city.admin1}</span>}
                                                                    <span className="ml-1 text-xs text-slate-400">{city.country_code}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                            {/* State — auto-filled from city selection */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">State / Region</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none bg-slate-50"
                                                    value={(newDeployment as any).state || ''}
                                                    onChange={e => setNewDeployment({ ...newDeployment, state: e.target.value } as any)}
                                                    placeholder="Auto-filled from city"
                                                />
                                            </div>
                                        </div>
                                        {/* Coordinates — auto-filled + editable */}
                                        {((newDeployment as any).latitude || (newDeployment as any).longitude) && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">📍 Coordinates (auto-resolved)</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input
                                                        type="number" step="any"
                                                        className="w-full px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm text-emerald-800 outline-none"
                                                        value={(newDeployment as any).latitude ?? ''}
                                                        onChange={e => setNewDeployment({ ...newDeployment, latitude: parseFloat(e.target.value) } as any)}
                                                        placeholder="Latitude"
                                                    />
                                                    <input
                                                        type="number" step="any"
                                                        className="w-full px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm text-emerald-800 outline-none"
                                                        value={(newDeployment as any).longitude ?? ''}
                                                        onChange={e => setNewDeployment({ ...newDeployment, longitude: parseFloat(e.target.value) } as any)}
                                                        placeholder="Longitude"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* GPS Coordinates — required for weather forecasting */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                            Site Coordinates <span className="text-amber-500 normal-case font-normal">(required for weather forecast)</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none"
                                                placeholder="Latitude  e.g. 33.4484"
                                                value={(newDeployment as any).latitude ?? ''}
                                                onChange={e => setNewDeployment({ ...newDeployment, latitude: e.target.value } as any)}
                                            />
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none"
                                                placeholder="Longitude  e.g. -112.0740"
                                                value={(newDeployment as any).longitude ?? ''}
                                                onChange={e => setNewDeployment({ ...newDeployment, longitude: e.target.value } as any)}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">Used by the AI Mission Forecaster for weather analysis. Find coordinates at maps.google.com.</p>
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
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Pilots / Technicians Needed</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 outline-none"
                                            placeholder="e.g. 3"
                                            value={(newDeployment as any).pilotsNeeded || ''}
                                            onChange={e => setNewDeployment({ ...newDeployment, pilotsNeeded: parseInt(e.target.value) } as any)}
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
