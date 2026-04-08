import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useIndustry } from '../../context/IndustryContext';
import { KPIBar } from '../widgets/KPIBar';
import { WeatherWidget } from '../widgets/WeatherWidget';
import { AxisPerformanceTab } from '../../src/components/personnel/AxisPerformanceTab';
import apiClient from '../../src/services/apiClient';
import { WorkItem } from '../../types';
import {
    Activity, ArrowRight, Clock, AlertCircle, CheckCircle2, CheckSquare, BarChart3,
    CloudSun, Calendar, Play, Square, PauseCircle, RotateCcw, Receipt, Zap, FileText, Send,
    Grid3X3, Layers, ChevronDown, ChevronUp, Flame, Thermometer, X
} from 'lucide-react';
import { format } from 'date-fns';

/* ─────────────────────────────────────────────────────────────────────────────
   Phase 4: Session Controls sub-component
───────────────────────────────────────────────────────────────────────────── */
const MissionSessionControls: React.FC<{ mission: any; onRefresh: () => void }> = ({ mission, onRefresh }) => {
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [pct, setPct] = useState(50);
    const [notes, setNotes] = useState('');
    const [showEndForm, setShowEndForm] = useState(false);

    const missionStatus = mission.mission_status_v2 || 'assigned';
    const completion = mission.completion_percent || 0;

    useEffect(() => {
        apiClient.get(`/sessions/${mission.id}`)
            .then(r => setSessions(r.data.data || []))
            .catch(() => { });
    }, [mission.id, loading]);

    const call = async (path: string, body?: object) => {
        setLoading(true);
        try {
            await apiClient.post(`/sessions/${mission.id}/${path}`, body || {});
            onRefresh();
        } catch (e: any) {
            alert(e?.response?.data?.message || e.message);
        } finally {
            setLoading(false);
            setShowEndForm(false);
        }
    };

    const billingBadge: Record<string, string> = {
        not_billable: 'bg-slate-700 text-slate-300',
        ready_for_invoice: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        invoiced: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        paid: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    {mission.title}
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 ml-1">
                        Session #{mission.total_sessions || 0}
                    </span>
                </h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${billingBadge[mission.billing_status || 'not_billable'] || 'bg-slate-700 text-slate-400'}`}>
                    {(mission.billing_status || 'not_billable').replace(/_/g, ' ')}
                </span>
            </div>

            <div className="p-5 space-y-4">
                {/* Progress Bar */}
                <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Mission Progress</span>
                        <span className="font-bold text-white">{completion}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(completion, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Session Action Buttons */}
                <div className="flex flex-wrap gap-2">
                    {missionStatus === 'assigned' && (
                        <button
                            onClick={() => call('start')}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                        >
                            <Play className="w-3.5 h-3.5" /> START SESSION
                        </button>
                    )}
                    {missionStatus === 'in_progress' && !showEndForm && (
                        <>
                            <button
                                onClick={() => setShowEndForm(true)}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                                <Square className="w-3.5 h-3.5" /> END SESSION
                            </button>
                            <button
                                onClick={() => call('pause-weather', { notes: 'Weather stop' })}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                                <PauseCircle className="w-3.5 h-3.5" /> PAUSE – WEATHER
                            </button>
                        </>
                    )}
                    {missionStatus === 'awaiting_return' && (
                        <button
                            onClick={() => call('resume')}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> RESUME MISSION
                        </button>
                    )}
                    {(missionStatus === 'partially_completed' || missionStatus === 'completed') && (
                        <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {missionStatus === 'completed' ? 'COMPLETED' : 'PARTIALLY COMPLETED'}
                        </span>
                    )}
                </div>

                {/* End Session Form */}
                {showEndForm && (
                    <div className="bg-slate-800 rounded-lg p-4 space-y-3 border border-slate-700">
                        <p className="text-xs font-semibold text-slate-300">End Session — Enter completion %</p>
                        <div className="flex items-center gap-3">
                            <input
                                type="range" min={0} max={100} value={pct}
                                onChange={e => setPct(Number(e.target.value))}
                                className="flex-1 accent-blue-500"
                            />
                            <span className="text-white font-bold text-sm w-12 text-right">{pct}%</span>
                        </div>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Session notes (optional)..."
                            rows={2}
                            className="w-full bg-slate-700 text-slate-200 text-xs rounded-md px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => call('end', { completion_percent: pct, notes })}
                                disabled={loading}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                            >
                                CONFIRM END SESSION
                            </button>
                            <button onClick={() => setShowEndForm(false)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg">
                                CANCEL
                            </button>
                        </div>
                    </div>
                )}

                {/* Session History */}
                {sessions.length > 0 && (
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Session History</p>
                        <div className="space-y-1.5">
                            {sessions.map((s: any) => (
                                <div key={s.id} className="flex items-center justify-between text-xs px-3 py-2 bg-slate-800/60 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        {s.weather_stop ? (
                                            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                                        ) : (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        )}
                                        <span className="text-slate-300">Session {s.session_number} — {s.session_date || 'Today'}</span>
                                        {s.weather_stop && <span className="text-amber-400 text-[10px] font-bold">WEATHER STOP</span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <span>{s.completion_percent}%</span>
                                        {s.invoice_id && <Receipt className="w-3 h-3 text-blue-400" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


/* ─────────────────────────────────────────────────────────────────────────────
   Daily Field Report submission cards (one per active mission)
───────────────────────────────────────────────────────────────────────────── */
const todayISO = () => new Date().toISOString().split('T')[0];

const DailyReportCards: React.FC<{ missions: any[] }> = ({ missions }) => {
    const [forms, setForms] = useState<Record<string, {
        reportDate: string;
        missionsFlownCount: string;
        blocksCompleted: string;
        hoursWorked: string;
        weatherConditions: string;
        issuesEncountered: string;
        notes: string;
        aiDraft: string;
        aiLoading: boolean;
        aiGenerated: boolean;
        submitting: boolean;
        submitted: boolean;
        error: string | null;
    }>>({});

    const getForm = (id: string) => forms[id] ?? {
        reportDate: todayISO(),
        missionsFlownCount: '', blocksCompleted: '', hoursWorked: '',
        weatherConditions: '', issuesEncountered: '', notes: '',
        aiDraft: '', aiLoading: false, aiGenerated: false,
        submitting: false, submitted: false, error: null,
    };

    const setField = (id: string, field: string, value: string | boolean) =>
        setForms(prev => ({ ...prev, [id]: { ...getForm(id), [field]: value } }));

    const generateAIDraft = async (missionId: string) => {
        const f = getForm(missionId);
        setField(missionId, 'aiLoading', true);
        try {
            const res = await apiClient.post(`/pilot/secure/missions/${missionId}/gen-ai-report`, {
                missionsFlownCount: Number(f.missionsFlownCount) || 0,
                blocksCompleted: Number(f.blocksCompleted) || 0,
                hoursWorked: Number(f.hoursWorked) || 0,
                weatherConditions: f.weatherConditions,
                issuesEncountered: f.issuesEncountered,
                notes: f.notes,
                reportDate: f.reportDate,
            });
            const draft = res.data?.aiReport || res.data?.report || '';
            setForms(prev => ({ ...prev, [missionId]: { ...getForm(missionId), aiDraft: draft, aiLoading: false, aiGenerated: true } }));
        } catch {
            // fallback — let pilot type manually
            setForms(prev => ({ ...prev, [missionId]: { ...getForm(missionId), aiLoading: false, aiGenerated: true, aiDraft: '' } }));
        }
    };

    const submit = async (missionId: string) => {
        const f = getForm(missionId);
        setForms(prev => ({ ...prev, [missionId]: { ...getForm(missionId), submitting: true, error: null } }));
        try {
            await apiClient.post(`/pilot/secure/missions/${missionId}/daily-report`, {
                reportDate: f.reportDate,
                missionsFlownCount: Number(f.missionsFlownCount) || 0,
                blocksCompleted: Number(f.blocksCompleted) || 0,
                hoursWorked: Number(f.hoursWorked) || 0,
                weatherConditions: f.weatherConditions,
                issuesEncountered: f.issuesEncountered,
                notes: f.notes,
                aiReportOverride: f.aiDraft || undefined,
            });
            setForms(prev => ({ ...prev, [missionId]: { ...getForm(missionId), submitting: false, submitted: true } }));
        } catch (e: any) {
            setForms(prev => ({ ...prev, [missionId]: {
                ...getForm(missionId), submitting: false,
                error: e?.response?.data?.message || 'Submission failed. Please try again.'
            }}));
        }
    };

    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Submit Daily Field Report</p>
            <div className="space-y-4">
                {missions.map(m => {
                    const f = getForm(m.id);
                    if (f.submitted) return (
                        <div key={m.id} className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-5 flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-emerald-300">Report submitted for {m.title}</p>
                                <p className="text-xs text-emerald-600 mt-0.5">Saved for {f.reportDate}. Check Field Reports tab for details.</p>
                            </div>
                        </div>
                    );

                    return (
                        <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-green-400" />
                                <h4 className="text-sm font-bold text-slate-100">{m.title}</h4>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 ml-auto">
                                    Field Report
                                </span>
                            </div>
                            <div className="p-5 space-y-4">
                                {/* Date — editable for backfill */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                        Report Date <span className="normal-case font-normal text-slate-600">(edit to backfill a missed day)</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={f.reportDate}
                                        max={todayISO()}
                                        onChange={e => setField(m.id, 'reportDate', e.target.value)}
                                        className="px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500/30 outline-none"
                                    />
                                </div>

                                {/* Metrics row */}
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Flights Flown', field: 'missionsFlownCount', placeholder: '0' },
                                        { label: 'Blocks Done', field: 'blocksCompleted', placeholder: '0' },
                                        { label: 'Hours Worked', field: 'hoursWorked', placeholder: '0.0' },
                                    ].map(({ label, field, placeholder }) => (
                                        <div key={field}>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                                            <input
                                                type="number" min="0"
                                                step={field === 'hoursWorked' ? '0.5' : '1'}
                                                placeholder={placeholder}
                                                value={(f as any)[field]}
                                                onChange={e => setField(m.id, field, e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500/50 outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Weather + issues */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Weather Conditions</label>
                                        <input type="text" placeholder="e.g. Clear, 15 mph wind..."
                                            value={f.weatherConditions}
                                            onChange={e => setField(m.id, 'weatherConditions', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500/30 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Issues / Incidents</label>
                                        <input type="text" placeholder="Any issues encountered..."
                                            value={f.issuesEncountered}
                                            onChange={e => setField(m.id, 'issuesEncountered', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500/30 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Notes (optional)</label>
                                    <textarea rows={2} placeholder="Any additional notes..."
                                        value={f.notes}
                                        onChange={e => setField(m.id, 'notes', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-green-500/30 outline-none resize-none"
                                    />
                                </div>

                                {/* AI Report — generate then edit */}
                                <div className="border border-slate-700/50 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Field Report</span>
                                            {f.aiGenerated && <span className="text-[10px] text-blue-400 font-bold ml-1">(editable)</span>}
                                        </div>
                                        <button
                                            onClick={() => generateAIDraft(m.id)}
                                            disabled={f.aiLoading}
                                            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/40 disabled:opacity-50 transition-colors"
                                        >
                                            {f.aiLoading ? (
                                                <><Clock className="w-3 h-3 animate-spin" /> Generating...</>
                                            ) : f.aiGenerated ? (
                                                <><Send className="w-3 h-3" /> Regenerate</>
                                            ) : (
                                                <><Send className="w-3 h-3" /> Generate Draft</>
                                            )}
                                        </button>
                                    </div>
                                    {f.aiGenerated ? (
                                        <textarea
                                            rows={6}
                                            placeholder="AI-generated report will appear here. You can edit it before submitting."
                                            value={f.aiDraft}
                                            onChange={e => setField(m.id, 'aiDraft', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-900 text-slate-200 text-sm leading-relaxed focus:ring-2 focus:ring-blue-500/20 outline-none resize-y"
                                        />
                                    ) : (
                                        <p className="text-xs text-slate-600 italic px-4 py-4">
                                            Click "Generate Draft" to create an AI-written summary based on your entries above. You can edit it before submitting.
                                        </p>
                                    )}
                                </div>

                                {f.error && (
                                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        {f.error}
                                    </div>
                                )}
                                <button
                                    onClick={() => submit(m.id)}
                                    disabled={f.submitting}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
                                >
                                    {f.submitting ? (
                                        <><Clock className="w-4 h-4 animate-spin" /> Submitting...</>
                                    ) : (
                                        <><Send className="w-4 h-4" /> Submit Field Report</>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────────
   My Blocks Tab — Pilot LBD tracking section
───────────────────────────────────────────────────────────────────────────── */
const thermalIcon2 = (flag: string) => {
    if (flag === 'critical') return <Flame className="w-3 h-3 text-red-400" />;
    if (flag === 'hotspot')  return <Thermometer className="w-3 h-3 text-amber-400" />;
    return null;
};

const MyBlocksTab: React.FC = () => {
    const [blocks, setBlocks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
    const [lbdMap, setLbdMap] = useState<Record<string, any[]>>({});
    const [lbdLoading, setLbdLoading] = useState<Record<string, boolean>>({});
    const [modal, setModal] = useState<{ lbd: any; block: any } | null>(null);
    const [modalNotes, setModalNotes] = useState('');
    const [modalThermal, setModalThermal] = useState('normal');
    const [modalSaving, setModalSaving] = useState(false);

    const fetchBlocks = async () => {
        try {
            const res = await apiClient.get('/blocks/my-blocks');
            setBlocks(res.data.data || []);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBlocks(); }, []);

    const toggleBlock = async (blockId: string) => {
        if (expandedBlockId === blockId) { setExpandedBlockId(null); return; }
        setExpandedBlockId(blockId);
        if (!lbdMap[blockId]) {
            setLbdLoading(prev => ({ ...prev, [blockId]: true }));
            try {
                const res = await apiClient.get(`/blocks/${blockId}/lbds?limit=500`);
                setLbdMap(prev => ({ ...prev, [blockId]: res.data.data || [] }));
            } catch { /* silent */ } finally {
                setLbdLoading(prev => ({ ...prev, [blockId]: false }));
            }
        }
    };

    const openModal = (lbd: any, block: any) => {
        setModal({ lbd, block });
        setModalNotes(lbd.notes || '');
        setModalThermal(lbd.thermal_flag || 'normal');
    };

    const saveModal = async (newStatus: 'completed' | 'pending' | 'issue') => {
        if (!modal) return;
        setModalSaving(true);
        try {
            await apiClient.patch(`/blocks/lbds/${modal.lbd.id}`, {
                status: newStatus,
                notes: modalNotes || undefined,
                thermal_flag: modalThermal,
            });
            setLbdMap(prev => ({
                ...prev,
                [modal.block.id]: (prev[modal.block.id] || []).map((l: any) =>
                    l.id === modal.lbd.id ? { ...l, status: newStatus, notes: modalNotes, thermal_flag: modalThermal } : l
                )
            }));
            fetchBlocks();
            setModal(null);
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to update');
        } finally {
            setModalSaving(false);
        }
    };

    if (loading) return (
        <div className="p-6 text-center text-slate-500">
            <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
            Loading your blocks…
        </div>
    );

    if (blocks.length === 0) return null; // Silently hide if no blocks assigned

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Grid3X3 className="w-3.5 h-3.5" /> My Block Assignments
                </p>
                <button onClick={fetchBlocks} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold">
                    Refresh
                </button>
            </div>

            {blocks.map((block: any) => {
                const total     = block.total_lbd_units ?? block.total_lbds ?? 0;
                const completed = block.completed_lbds ?? 0;
                const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
                const isOpen    = expandedBlockId === block.id;
                const lbds      = lbdMap[block.id] || [];

                return (
                    <div key={block.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div
                            className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                            onClick={() => toggleBlock(block.id)}
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                <Layers className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-black text-white text-sm">{block.block_name}</span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        block.status === 'completed'   ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                        block.status === 'in_progress' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                                        'bg-red-500/15 text-red-400 border border-red-500/30'
                                    }`}>{block.status?.replace(/_/g, ' ') || 'pending'}</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {block.mission_title || 'Mission'}{block.site_name ? ` · ${block.site_name}` : ''}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-700'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-slate-300 shrink-0">{completed}/{total} LBDs</span>
                                </div>
                            </div>
                            {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                        </div>

                        {isOpen && (
                            <div className="border-t border-slate-800">
                                {lbdLoading[block.id] ? (
                                    <div className="p-5 text-center text-slate-500 text-sm">
                                        <Clock className="w-4 h-4 animate-spin mx-auto mb-1" /> Loading LBDs…
                                    </div>
                                ) : lbds.length === 0 ? (
                                    <p className="p-4 text-center text-xs text-slate-600 italic">No LBD units found for this block.</p>
                                ) : (
                                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                                        {lbds.map((lbd: any) => (
                                            <div
                                                key={lbd.id}
                                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 cursor-pointer transition-colors active:bg-slate-700/30"
                                                onClick={() => openModal(lbd, block)}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                                                    lbd.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
                                                    lbd.status === 'issue'     ? 'bg-red-500/20 border-red-500' :
                                                    'border-slate-600'
                                                }`}>
                                                    {lbd.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    {lbd.status === 'issue'     && <AlertCircle  className="w-3 h-3 text-red-400" />}
                                                </div>
                                                <span className={`text-xs font-mono font-bold flex-1 ${
                                                    lbd.status === 'completed' ? 'text-emerald-400 line-through' :
                                                    lbd.status === 'issue'     ? 'text-red-400' : 'text-slate-300'
                                                }`}>{lbd.lbd_code}</span>
                                                {thermalIcon2(lbd.thermal_flag)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* LBD Update Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                            <div>
                                <h3 className="font-black text-white text-sm">{modal.lbd.lbd_code}</h3>
                                <p className="text-[11px] text-slate-500">{modal.block.block_name}</p>
                            </div>
                            <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Notes</label>
                                <textarea
                                    rows={3}
                                    value={modalNotes}
                                    onChange={e => setModalNotes(e.target.value)}
                                    placeholder="Add observations or field notes..."
                                    className="w-full px-3 py-2 bg-slate-800 text-slate-200 text-sm border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Thermal Flag</label>
                                <select
                                    value={modalThermal}
                                    onChange={e => setModalThermal(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800 text-slate-200 text-sm border border-slate-700 rounded-xl focus:outline-none"
                                >
                                    <option value="normal">Normal</option>
                                    <option value="hotspot">🔥 Hotspot</option>
                                    <option value="critical">⚠️ Critical</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => saveModal('completed')}
                                    disabled={modalSaving}
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
                                >
                                    {modalSaving ? 'Saving…' : '✓ Mark Complete'}
                                </button>
                                <button
                                    onClick={() => saveModal('issue')}
                                    disabled={modalSaving}
                                    className="px-3 py-2.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 text-sm font-bold rounded-xl border border-red-600/30 transition-colors"
                                >
                                    Issue
                                </button>
                                {modal.lbd.status !== 'pending' && (
                                    <button
                                        onClick={() => saveModal('pending')}
                                        disabled={modalSaving}
                                        className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold rounded-xl transition-colors"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const PilotDashboard: React.FC = () => {
    const { user } = useAuth();
    const { tLabel } = useIndustry();
    const [stats, setStats] = useState({
        pendingTasks: 0,
        inProgressTasks: 0,
        completedThisWeek: 0,
    });
    const [recentTasks, setRecentTasks] = useState<WorkItem[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [assignedMissions, setAssignedMissions] = useState<any[]>([]);

    useEffect(() => {
        fetchPilotData();
        fetchAssignedMissions();
        fetchPilotMetrics();
    }, []);

    const fetchPilotData = async () => {
        try {
            setLoadingTasks(true);
            const response = await apiClient.get('/work-items?assignedTo=me');
            if (response.data.success) {
                const items: WorkItem[] = response.data.data;
                const now = new Date();
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                const pending = items.filter(i => i.status === 'open' || i.status === 'blocked').length;
                const inProgress = items.filter(i => i.status === 'in_progress').length;
                const completed = items.filter(i => i.status === 'done' && i.completedAt && new Date(i.completedAt) > oneWeekAgo).length;

                setStats({
                    pendingTasks: pending,
                    inProgressTasks: inProgress,
                    completedThisWeek: completed
                });

                // Top 3 most urgent/recent open tasks
                const active = items.filter(i => i.status !== 'done')
                    .sort((a, b) => new Date(a.dueDate || '2099-01-01').getTime() - new Date(b.dueDate || '2099-01-01').getTime())
                    .slice(0, 3);
                setRecentTasks(active);
            }
        } catch (error) {
            console.error('Error fetching pilot data:', error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const [pilotMetrics, setPilotMetrics] = useState<any>(null);

    const fetchPilotMetrics = async () => {
        try {
            const res = await apiClient.get(`/pilot-metrics/${user?.id}`);
            if (res.data.success) setPilotMetrics(res.data.data);
        } catch (_) {}
    };

    const fetchAssignedMissions = async () => {
        try {
            const res = await apiClient.get('/deployments');
            if (res.data.success) {
                // Show missions assigned to this pilot (in progress or assigned)
                const myMissions = (res.data.data || []).filter((m: any) =>
                    ['assigned', 'in_progress', 'awaiting_return', 'partially_completed'].includes(m.mission_status_v2 || 'assigned')
                );
                setAssignedMissions(myMissions.slice(0, 5));
            }
        } catch (_) {}
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done': return <CheckCircle2 size={16} className="text-emerald-500" />;
            case 'in_progress': return <Clock size={16} className="text-blue-500" />;
            case 'blocked': return <AlertCircle size={16} className="text-red-500" />;
            default: return <CheckSquare size={16} className="text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Welcome, {user?.fullName?.split(' ')[0] || 'Pilot'}</h2>
                    <p className="text-sm text-slate-400 mt-1">Here is your {tLabel('mission')} summary for {format(new Date(), 'EEEE, MMMM do')}.</p>
                </div>
            </div>

            {assignedMissions.length > 0 && (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Active Mission Sessions</p>
                    <div className="space-y-4">
                        {assignedMissions.map(m => (
                            <MissionSessionControls key={m.id} mission={m} onRefresh={fetchAssignedMissions} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── My Block Assignments ─────────────────────────────────────────────── */}
            <MyBlocksTab />

            {/* ── Daily Field Report Submission ───────────────────────────────────── */}
            {assignedMissions.length > 0 && (
                <DailyReportCards missions={assignedMissions} />
            )}

            {/* Pilot Performance Score — Phase 8 */}
            {pilotMetrics && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-violet-400" />
                            My Axis Performance Score
                        </h3>
                        <span className="text-2xl font-black text-white">{Math.round(pilotMetrics.pilot_score ?? 0)}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-700">
                        {[
                            { label: 'Missions Completed', value: pilotMetrics.missions_completed ?? 0, cls: 'text-emerald-400' },
                            { label: 'Total Sessions',      value: pilotMetrics.sessions_completed ?? 0, cls: 'text-blue-400' },
                            { label: 'Weather Pauses',      value: pilotMetrics.weather_interruptions ?? 0, cls: 'text-amber-400' },
                            { label: 'Faults Detected',     value: pilotMetrics.thermal_faults_detected ?? 0, cls: 'text-red-400' },
                        ].map(m => (
                            <div key={m.label} className="bg-slate-900 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">{m.label}</p>
                                <p className={`text-xl font-black ${m.cls}`}>{m.value}</p>
                            </div>
                        ))}
                    </div>
                    {pilotMetrics.avg_completion_speed > 0 && (
                        <div className="px-5 py-3 text-xs text-slate-500">
                            Avg session length: <span className="text-white font-bold">{Math.round(pilotMetrics.avg_completion_speed)} min</span>
                        </div>
                    )}
                </div>
            )}

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 transition-all flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">To Do</p>
                        <h3 className="text-3xl font-black text-white">{stats.pendingTasks}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                        <CheckSquare className="w-6 h-6 text-slate-400" />
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-blue-500 rounded-xl p-5 hover:border-blue-500/50 transition-all flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Active</p>
                        <h3 className="text-3xl font-black text-white">{stats.inProgressTasks}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-blue-500" />
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-emerald-500 rounded-xl p-5 hover:border-emerald-500/50 transition-all flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Done (7d)</p>
                        <h3 className="text-3xl font-black text-white">{stats.completedThisWeek}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column (Weather & Tasks) */}
                <div className="xl:col-span-1 space-y-6">
                    <WeatherWidget />

                    {/* Pending Tasks Snippet */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                                Upcoming {tLabel('workItem')}s
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-800">
                            {loadingTasks ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-600" />
                                    Loading items...
                                </div>
                            ) : recentTasks.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                                    <p className="text-sm">You have no pending assignments.</p>
                                </div>
                            ) : (
                                recentTasks.map(task => (
                                    <div key={task.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {getStatusIcon(task.status)}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-200 line-clamp-1">{task.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {task.dueDate && (
                                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" /> {format(new Date(task.dueDate), 'MMM d')}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                                                            {task.priority || 'Normal'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {recentTasks.length > 0 && (
                            <div className="p-3 border-t border-slate-800 bg-slate-900/30 text-center">
                                <button className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 w-full mx-auto uppercase tracking-wide">
                                    View All Tasks <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Column (Performance) */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 flex justify-between items-center bg-slate-900/50">
                            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-emerald-400" />
                                Axis Performance Index
                            </h3>
                        </div>
                        <div className="p-6">
                            {user?.id ? (
                                <AxisPerformanceTab pilotId={user.id} />
                            ) : (
                                <div className="text-slate-500 text-center p-8">Unable to load performance metrics...</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PilotDashboard;
