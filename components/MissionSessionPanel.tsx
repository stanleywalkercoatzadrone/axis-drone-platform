/**
 * MissionSessionPanel.tsx
 * Phase 5+ — Admin dashboard: session history, partial invoicing, manual overrides, timeline.
 * Supports inline editing of individual sessions.
 */
import React, { useState, useEffect } from 'react';
import apiClient from '../src/services/apiClient';
import {
    Play, Receipt, CloudSun, CheckCircle2,
    Clock, AlertTriangle, Edit3, Save, X,
    ChevronDown, ChevronUp, Pencil
} from 'lucide-react';

interface Props {
    missionId: string;
    missionTitle: string;
    tenantId?: string;
}

type Session = {
    id: string;
    session_number: number;
    session_date: string;
    start_time: string;
    end_time: string | null;
    completion_percent: number;
    status: string;
    weather_stop: boolean;
    billable: boolean;
    invoice_id: string | null;
    payment_status: string;
    notes: string;
    pilot_name?: string;
};

type MissionInfo = {
    mission_status_v2: string;
    completion_percent: number;
    billing_status: string;
    total_sessions: number;
    allow_partial_invoice: boolean;
};

type SessionEdit = {
    completion_percent: number;
    notes: string;
    billable: boolean;
    status: string;
    weather_stop: boolean;
    end_time: string;
};

const SESSION_STATUSES = ['in_progress', 'completed', 'paused_weather', 'cancelled'];

export const MissionSessionPanel: React.FC<Props> = ({ missionId, missionTitle }) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [missionInfo, setMissionInfo] = useState<MissionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [invoicing, setInvoicing] = useState(false);
    const [invoiceResult, setInvoiceResult] = useState<any>(null);
    const [overrideMode, setOverrideMode] = useState(false);
    const [overrideData, setOverrideData] = useState<Partial<MissionInfo>>({});
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);

    // Per-session edit state
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<SessionEdit | null>(null);
    const [sessionSaving, setSessionSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sessionsRes, missionRes] = await Promise.all([
                apiClient.get(`/sessions/${missionId}`),
                apiClient.get(`/deployments/${missionId}`)
            ]);
            if (sessionsRes.data.success) setSessions(sessionsRes.data.data || []);
            if (missionRes.data.success) {
                const d = missionRes.data.data;
                setMissionInfo({
                    mission_status_v2: d.mission_status_v2 || 'assigned',
                    completion_percent: d.completion_percent || 0,
                    billing_status: d.billing_status || 'not_billable',
                    total_sessions: d.total_sessions || 0,
                    allow_partial_invoice: d.allow_partial_invoice !== false,
                });
            }
        } catch (_) { } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [missionId]);

    const handleGenerateInvoice = async () => {
        setInvoicing(true);
        try {
            const res = await apiClient.post(`/invoices/missions/${missionId}/partial`);
            setInvoiceResult(res.data);
            fetchData();
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to generate invoice');
        } finally { setInvoicing(false); }
    };

    const handleOverride = async () => {
        setSaving(true);
        try {
            await apiClient.patch(`/sessions/${missionId}/override`, overrideData);
            setOverrideMode(false);
            fetchData();
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Override failed');
        } finally { setSaving(false); }
    };

    const handleCreateSession = async () => {
        setCreating(true);
        try {
            const action = missionInfo?.mission_status_v2 === 'awaiting_return' ? 'resume' : 'start';
            await apiClient.post(`/sessions/${missionId}/${action}`);
            fetchData();
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to create session');
        } finally { setCreating(false); }
    };

    // Open inline editor for a session
    const startEditSession = (s: Session) => {
        setEditingSessionId(s.id);
        setEditDraft({
            completion_percent: s.completion_percent,
            notes: s.notes || '',
            billable: s.billable,
            status: s.status || 'completed',
            weather_stop: s.weather_stop,
            end_time: s.end_time ? new Date(s.end_time).toISOString().slice(0, 16) : '',
        });
    };

    const cancelEditSession = () => {
        setEditingSessionId(null);
        setEditDraft(null);
    };

    const saveEditSession = async (sessionId: string) => {
        if (!editDraft) return;
        setSessionSaving(true);
        try {
            const payload: any = { ...editDraft };
            // Convert local datetime-local format to ISO string or null
            if (payload.end_time) {
                payload.end_time = new Date(payload.end_time).toISOString();
            } else {
                payload.end_time = null;
            }
            await apiClient.patch(`/sessions/${missionId}/session/${sessionId}`, payload);
            setEditingSessionId(null);
            setEditDraft(null);
            fetchData();
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Failed to save session');
        } finally { setSessionSaving(false); }
    };

    const statusColor: Record<string, string> = {
        assigned: 'text-slate-400',
        in_progress: 'text-blue-400',
        awaiting_return: 'text-amber-400',
        partially_completed: 'text-violet-400',
        completed: 'text-emerald-400',
        closed: 'text-slate-500',
    };

    const billingColor: Record<string, string> = {
        not_billable: 'text-slate-400',
        ready_for_invoice: 'text-amber-400',
        invoiced: 'text-blue-400',
        paid: 'text-emerald-400',
    };

    if (loading) return (
        <div className="p-8 text-center text-slate-500">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading sessions...
        </div>
    );

    const unbilledCount = sessions.filter(s => s.billable && !s.invoice_id).length;

    return (
        <div className="space-y-6 p-4">

            {/* Mission Status Bar */}
            {missionInfo && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Status', value: (missionInfo.mission_status_v2 || 'assigned').replace(/_/g, ' '), cls: statusColor[missionInfo.mission_status_v2] || 'text-slate-300' },
                        { label: 'Completion', value: `${missionInfo.completion_percent}%`, cls: 'text-white' },
                        { label: 'Billing', value: (missionInfo.billing_status || '').replace(/_/g, ' '), cls: billingColor[missionInfo.billing_status] || 'text-slate-300' },
                        { label: 'Sessions', value: missionInfo.total_sessions.toString(), cls: 'text-white' },
                    ].map(item => (
                        <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{item.label}</p>
                            <p className={`text-sm font-bold ${item.cls} capitalize`}>{item.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Progress Bar */}
            {missionInfo && (
                <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Overall Progress</span>
                        <span className="font-bold text-white">{missionInfo.completion_percent}%</span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(missionInfo.completion_percent, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Admin Actions */}
            <div className="flex flex-wrap gap-3">
                {/* Partial Invoice */}
                {unbilledCount > 0 && missionInfo?.allow_partial_invoice && (
                    <button
                        onClick={handleGenerateInvoice}
                        disabled={invoicing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                    >
                        <Receipt className="w-4 h-4" />
                        {invoicing ? 'Generating...' : `Generate Partial Invoice (${unbilledCount} session${unbilledCount !== 1 ? 's' : ''})`}
                    </button>
                )}

                {/* Create / Start new session */}
                {missionInfo && (['assigned', 'awaiting_return', 'partially_completed'].includes(missionInfo.mission_status_v2) || !missionInfo.mission_status_v2) && (
                    <button
                        onClick={handleCreateSession}
                        disabled={creating}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                    >
                        <Play className="w-4 h-4" />
                        {creating ? 'Creating...' : missionInfo.mission_status_v2 === 'awaiting_return' ? 'Resume (New Session)' : 'Create Session'}
                    </button>
                )}

                {/* Manual Override */}
                <button
                    onClick={() => { setOverrideMode(!overrideMode); setOverrideData(missionInfo ? { ...missionInfo } : {}); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition-all"
                >
                    <Edit3 className="w-4 h-4" />
                    Mission Override
                </button>
            </div>

            {/* Invoice Success */}
            {invoiceResult?.success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-emerald-300 text-sm">
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Invoice generated for {invoiceResult.data?.sessionCount} session(s). Link: <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">{invoiceResult.data?.link}</code>
                </div>
            )}

            {/* Admin Override Form */}
            {overrideMode && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Mission Override</h4>
                        <button onClick={() => setOverrideMode(false)}><X className="w-4 h-4 text-slate-400" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Mission Status</label>
                            <select
                                value={overrideData.mission_status_v2 || ''}
                                onChange={e => setOverrideData(p => ({ ...p, mission_status_v2: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
                            >
                                {['assigned', 'in_progress', 'paused_weather', 'awaiting_return', 'partially_completed', 'completed', 'closed'].map(s => (
                                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Completion %</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range" min={0} max={100}
                                    value={overrideData.completion_percent || 0}
                                    onChange={e => setOverrideData(p => ({ ...p, completion_percent: Number(e.target.value) }))}
                                    className="flex-1 accent-blue-500"
                                />
                                <span className="text-white font-bold text-sm w-10">{overrideData.completion_percent}%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Billing Status</label>
                            <select
                                value={overrideData.billing_status || ''}
                                onChange={e => setOverrideData(p => ({ ...p, billing_status: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
                            >
                                {['not_billable', 'ready_for_invoice', 'invoiced', 'paid'].map(s => (
                                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={handleOverride}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                        >
                            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'SAVE OVERRIDE'}
                        </button>
                        <button onClick={() => setOverrideMode(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg">CANCEL</button>
                    </div>
                </div>
            )}

            {/* ─── Mission Timeline / Session History ─── */}
            <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                    Session History ({sessions.length})
                </h4>
                {sessions.length === 0 ? (
                    <div className="text-center text-slate-500 py-8 text-sm">No sessions recorded yet.</div>
                ) : (
                    <div className="relative pl-6 space-y-0">
                        {/* Vertical line */}
                        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-700" />

                        {sessions.map((s) => {
                            const isWeather = s.weather_stop;
                            const isActive = !s.end_time;
                            const dot = isActive ? 'bg-blue-500 animate-pulse' : isWeather ? 'bg-amber-500' : 'bg-emerald-500';
                            const isEditing = editingSessionId === s.id;

                            return (
                                <div key={s.id} className="relative flex gap-4 pb-5 last:pb-0">
                                    <div className={`absolute -left-4 mt-1.5 w-3 h-3 rounded-full ${dot} border-2 border-slate-950`} />
                                    <div className={`flex-1 rounded-xl border transition-all ${isEditing ? 'bg-slate-800 border-blue-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>

                                        {/* ── Session Header ── */}
                                        <div className="flex items-start justify-between gap-3 p-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    {isWeather ? (
                                                        <CloudSun className="w-4 h-4 text-amber-400 shrink-0" />
                                                    ) : isActive ? (
                                                        <Play className="w-4 h-4 text-blue-400 shrink-0" />
                                                    ) : (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                    )}
                                                    <span className="text-sm font-semibold text-slate-200">
                                                        Session {s.session_number}
                                                    </span>
                                                    {isActive && <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">ACTIVE</span>}
                                                    {isWeather && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">WEATHER STOP</span>}
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    {s.session_date || 'Today'}
                                                    {s.start_time && ` · ${new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                    {s.end_time && ` → ${new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                    {s.pilot_name && ` · ${s.pilot_name}`}
                                                </p>
                                                {!isEditing && s.notes && <p className="text-xs text-slate-400 mt-1.5 italic">{s.notes}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-white">{s.completion_percent}%</p>
                                                    {s.invoice_id ? (
                                                        <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1 justify-end">
                                                            <Receipt className="w-3 h-3" /> Invoiced
                                                        </span>
                                                    ) : s.billable ? (
                                                        <span className="text-[10px] text-amber-400">Billable</span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500">Non-billable</span>
                                                    )}
                                                </div>
                                                {/* Edit toggle */}
                                                {!s.invoice_id && (
                                                    isEditing ? (
                                                        <button
                                                            onClick={cancelEditSession}
                                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Cancel edit"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => startEditSession(s)}
                                                            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                            title="Edit session"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Inline Edit Form ── */}
                                        {isEditing && editDraft && (
                                            <div className="border-t border-slate-700 p-4 space-y-4 animate-in slide-in-from-top-1 fade-in duration-200">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Completion % */}
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Completion %</label>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="range" min={0} max={100}
                                                                value={editDraft.completion_percent}
                                                                onChange={e => setEditDraft(d => d ? { ...d, completion_percent: Number(e.target.value) } : d)}
                                                                className="flex-1 accent-blue-500"
                                                            />
                                                            <span className="text-white font-bold text-sm w-10 text-right">{editDraft.completion_percent}%</span>
                                                        </div>
                                                    </div>

                                                    {/* Session Status */}
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Session Status</label>
                                                        <select
                                                            value={editDraft.status}
                                                            onChange={e => setEditDraft(d => d ? { ...d, status: e.target.value } : d)}
                                                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
                                                        >
                                                            {SESSION_STATUSES.map(s => (
                                                                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* End Time */}
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">End Time</label>
                                                        <input
                                                            type="datetime-local"
                                                            value={editDraft.end_time}
                                                            onChange={e => setEditDraft(d => d ? { ...d, end_time: e.target.value } : d)}
                                                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
                                                        />
                                                    </div>

                                                    {/* Checkboxes */}
                                                    <div className="flex flex-col gap-3 justify-center">
                                                        <label className="flex items-center gap-3 cursor-pointer group">
                                                            <div
                                                                onClick={() => setEditDraft(d => d ? { ...d, billable: !d.billable } : d)}
                                                                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${editDraft.billable ? 'bg-blue-500' : 'bg-slate-700'}`}
                                                            >
                                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${editDraft.billable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                            </div>
                                                            <span className="text-xs text-slate-300 font-semibold">Billable</span>
                                                        </label>
                                                        <label className="flex items-center gap-3 cursor-pointer group">
                                                            <div
                                                                onClick={() => setEditDraft(d => d ? { ...d, weather_stop: !d.weather_stop } : d)}
                                                                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${editDraft.weather_stop ? 'bg-amber-500' : 'bg-slate-700'}`}
                                                            >
                                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${editDraft.weather_stop ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                            </div>
                                                            <span className="text-xs text-slate-300 font-semibold">Weather Stop</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Notes */}
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Notes</label>
                                                    <textarea
                                                        rows={2}
                                                        value={editDraft.notes}
                                                        onChange={e => setEditDraft(d => d ? { ...d, notes: e.target.value } : d)}
                                                        placeholder="Session notes, observations..."
                                                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
                                                    />
                                                </div>

                                                {/* Save / Cancel */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => saveEditSession(s.id)}
                                                        disabled={sessionSaving}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                                                    >
                                                        <Save className="w-3.5 h-3.5" />
                                                        {sessionSaving ? 'Saving...' : 'Save Changes'}
                                                    </button>
                                                    <button
                                                        onClick={cancelEditSession}
                                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MissionSessionPanel;
