/**
 * MissionOrchestratorPanel.tsx
 * Phase 7 – Admin UI Panel for Mission Orchestration
 * Phase 8 – Integrated into AxisCommandCenter (separate tab)
 *
 * Displays: Mission, Priority Score, Recommended Pilot, Recommended Window,
 *           Predicted Completion, AI Confidence
 * Buttons: Approve Plan, Override Plan, Re-run AI
 * Override opens modal for: start date, end date, pilot assignment
 */
import React, { useEffect, useState, useCallback } from 'react';

interface Orchestration {
    id: string;
    mission_id: string;
    mission_title: string;
    site_name: string;
    mission_status: string;
    industry_key: string;
    recommended_start_date: string | null;
    recommended_end_date: string | null;
    pilot_name: string | null;
    pilot_email: string | null;
    predicted_completion_days: number | null;
    ai_confidence: number | null;
    priority_score: number | null;
    status: string;
    manual_override: boolean;
    override_reason: string | null;
    approved_by_name: string | null;
}

interface OverrideForm {
    start_date: string;
    end_date: string;
    pilot_id: string;
    reason: string;
}

const CONF_COLOR = (v: number) => v >= 80 ? '#22c55e' : v >= 60 ? '#f59e0b' : '#ef4444';
const PRI_COLOR = (v: number) => v >= 75 ? '#22c55e' : v >= 50 ? '#f59e0b' : '#ef4444';

function ConfBar({ value, color }: { value: number; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, background: '#1e293b', borderRadius: 3, height: 6 }}>
                <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ color, fontWeight: 700, fontSize: 11, minWidth: 30 }}>{value}</span>
        </div>
    );
}

function StatusBadge({ status, override }: { status: string; override: boolean }) {
    const map: Record<string, string> = {
        suggested: '#3b82f6',
        approved: '#22c55e',
        overridden: '#f59e0b',
        rejected: '#ef4444',
    };
    const color = override ? '#f59e0b' : (map[status] || '#6b7280');
    return (
        <span style={{
            background: `${color}22`, color, border: `1px solid ${color}44`,
            borderRadius: 6, padding: '2px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const
        }}>
            {override ? '⚠️ Override' : status}
        </span>
    );
}

export const MissionOrchestratorPanel: React.FC = () => {
    const [recs, setRecs] = useState<Orchestration[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [overrideTarget, setOverrideTarget] = useState<Orchestration | null>(null);
    const [overrideForm, setOverrideForm] = useState<OverrideForm>({ start_date: '', end_date: '', pilot_id: '', reason: '' });
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const showMsg = (msg: string) => {
        setActionMsg(msg);
        setTimeout(() => setActionMsg(null), 4000);
    };

    const fetchRecs = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/orchestrator/recommendations', { credentials: 'include' });
            const data = await r.json();
            setRecs(data.data || []);
        } catch { setRecs([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRecs(); }, [fetchRecs]);

    const handleRunAll = async () => {
        setRunning(true);
        try {
            const r = await fetch('/api/orchestrator/run', { method: 'POST', credentials: 'include' });
            const data = await r.json();
            showMsg(`✅ Orchestration run complete: ${data.result?.processed || 0} missions processed`);
            await fetchRecs();
        } catch { showMsg('❌ Orchestration run failed'); }
        finally { setRunning(false); }
    };

    const handleRerun = async (missionId: string) => {
        try {
            const r = await fetch(`/api/orchestrator/run/${missionId}`, { method: 'POST', credentials: 'include' });
            const data = await r.json();
            if (data.success) { showMsg('✅ AI re-run complete'); await fetchRecs(); }
            else showMsg('❌ ' + data.message);
        } catch { showMsg('❌ Re-run failed'); }
    };

    const handleApprove = async (missionId: string) => {
        try {
            const r = await fetch(`/api/orchestrator/${missionId}/approve`, { method: 'POST', credentials: 'include' });
            const data = await r.json();
            if (data.success) { showMsg('✅ Plan approved'); await fetchRecs(); }
            else showMsg('❌ ' + data.message);
        } catch { showMsg('❌ Approve failed'); }
    };

    const handleOverrideSubmit = async () => {
        if (!overrideTarget) return;
        try {
            const r = await fetch(`/api/orchestrator/${overrideTarget.mission_id}/override`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(overrideForm),
            });
            const data = await r.json();
            if (data.success) { showMsg('✅ Override applied'); setOverrideTarget(null); await fetchRecs(); }
            else showMsg('❌ ' + data.message);
        } catch { showMsg('❌ Override failed'); }
    };

    const formatDate = (d: string | null) => {
        if (!d) return '—';
        try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch { return d; }
    };

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>

            {/* Action feedback */}
            {actionMsg && (
                <div style={{ background: actionMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${actionMsg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
                    {actionMsg}
                </div>
            )}

            {/* Header + Run All button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>🤖 Mission Orchestration</h3>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
                        AI scheduling recommendations — admin approval always required
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={fetchRecs} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: 12, fontWeight: 600, padding: '8px 14px', cursor: 'pointer' }}>
                        🔄 Refresh
                    </button>
                    <button onClick={handleRunAll} disabled={running} style={{ background: running ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#818cf8', fontSize: 12, fontWeight: 700, padding: '8px 16px', cursor: running ? 'not-allowed' : 'pointer' }}>
                        {running ? '⏳ Running...' : '⚡ Run AI for All'}
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading recommendations...</div>
            ) : recs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                    No recommendations yet. Click <strong>Run AI for All</strong> to generate plans.
                </div>
            ) : (
                <div>
                    {recs.map(r => (
                        <div key={r.id} style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 12, padding: '16px 20px', marginBottom: 12,
                        }}>
                            {/* Row 1: Title + Status */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>{r.mission_title}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.site_name} · {r.industry_key || 'N/A'}</div>
                                </div>
                                <StatusBadge status={r.status} override={r.manual_override} />
                            </div>

                            {/* Row 2: Metrics grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Priority</div>
                                    <ConfBar value={r.priority_score || 0} color={PRI_COLOR(r.priority_score || 0)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Confidence</div>
                                    <ConfBar value={r.ai_confidence || 0} color={CONF_COLOR(r.ai_confidence || 0)} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended Pilot</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{r.pilot_name || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Window</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>
                                        {r.recommended_start_date ? `${formatDate(r.recommended_start_date)} →` : '—'}
                                    </div>
                                    {r.recommended_end_date && <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(r.recommended_end_date)}</div>}
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Est. Duration</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{r.predicted_completion_days ? `${r.predicted_completion_days} days` : '—'}</div>
                                </div>
                            </div>

                            {/* Row 3: Action buttons */}
                            {r.status === 'suggested' && !r.manual_override && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                                    <button onClick={() => handleApprove(r.mission_id)} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, color: '#22c55e', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer' }}>
                                        ✅ Approve Plan
                                    </button>
                                    <button onClick={() => { setOverrideTarget(r); setOverrideForm({ start_date: r.recommended_start_date || '', end_date: r.recommended_end_date || '', pilot_id: '', reason: '' }); }} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer' }}>
                                        ✏️ Override Plan
                                    </button>
                                    <button onClick={() => handleRerun(r.mission_id)} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, color: '#818cf8', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer' }}>
                                        🔄 Re-run AI
                                    </button>
                                </div>
                            )}

                            {r.status === 'approved' && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => { setOverrideTarget(r); setOverrideForm({ start_date: r.recommended_start_date || '', end_date: r.recommended_end_date || '', pilot_id: '', reason: '' }); }} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer' }}>
                                        ✏️ Override
                                    </button>
                                    <button onClick={() => handleRerun(r.mission_id)} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, color: '#818cf8', fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer' }}>
                                        🔄 Re-run AI
                                    </button>
                                </div>
                            )}

                            {r.override_reason && (
                                <div style={{ marginTop: 8, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.06)', borderRadius: 6, padding: '6px 10px' }}>
                                    Override reason: {r.override_reason}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Override Modal */}
            {overrideTarget && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setOverrideTarget(null)}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: 420, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
                        <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>✏️ Override AI Plan</h4>
                        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#64748b' }}>{overrideTarget.mission_title}</p>

                        {[
                            { label: 'Start Date', key: 'start_date', type: 'date' },
                            { label: 'End Date', key: 'end_date', type: 'date' },
                            { label: 'Pilot ID (optional)', key: 'pilot_id', type: 'text' },
                        ].map(({ label, key, type }) => (
                            <div key={key} style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
                                <input
                                    type={type}
                                    value={(overrideForm as unknown as Record<string, string>)[key]}
                                    onChange={e => setOverrideForm(f => ({ ...f, [key]: e.target.value }))}
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' as const }}
                                />
                            </div>
                        ))}

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Override Reason *</label>
                            <textarea
                                value={overrideForm.reason}
                                onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
                                rows={3}
                                placeholder="Explain the reason for overriding the AI recommendation"
                                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, padding: '8px 12px', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setOverrideTarget(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: 13, fontWeight: 600, padding: '10px', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleOverrideSubmit} disabled={!overrideForm.reason} style={{ flex: 1, background: overrideForm.reason ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${overrideForm.reason ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, color: overrideForm.reason ? '#f59e0b' : '#475569', fontSize: 13, fontWeight: 700, padding: '10px', cursor: overrideForm.reason ? 'pointer' : 'not-allowed' }}>
                                Apply Override
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MissionOrchestratorPanel;
