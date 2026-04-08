/**
 * FaultReviewPanel.tsx
 * Phase 12 – Admin AI Fault Review Panel
 *
 * Admin reviews AI-detected thermal faults:
 * - See AI classification + confidence
 * - Approve (verify)
 * - Reclassify fault type and severity
 * - Mark false positive
 *
 * Phase 13: Tracks review_status per fault.
 */
import React, { useEffect, useState, useCallback } from 'react';

interface Fault {
    id: string;
    deployment_id: string;
    block_name?: string;
    fault_type: string;
    severity: string;
    temperature_delta: number;
    confidence_score: number;
    latitude: number | null;
    longitude: number | null;
    review_status: string;
    ai_detected: boolean;
    detected_at: string;
    status: string;
}

interface FaultReviewPanelProps {
    deploymentId: string;
    deploymentTitle?: string;
}

const FAULT_TYPES = [
    'hot_cell', 'bypass_diode_failure', 'string_outage',
    'connector_overheating', 'panel_mismatch', 'shading_anomaly',
    'minor_thermal_deviation',
];

const SEVERITIES = ['critical', 'moderate', 'low'];

const REVIEW_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    verified: '#22c55e',
    false_positive: '#6b7280',
};

const SEV_COLORS: Record<string, string> = {
    critical: '#ef4444', moderate: '#f97316', low: '#eab308',
};

const FAULT_LABELS: Record<string, string> = {
    hot_cell: 'Hot Cell', bypass_diode_failure: 'Bypass Diode',
    string_outage: 'String Outage', connector_overheating: 'Connector',
    panel_mismatch: 'Panel Mismatch', shading_anomaly: 'Shading',
    minor_thermal_deviation: 'Minor Dev.',
};

export const FaultReviewPanel: React.FC<FaultReviewPanelProps> = ({ deploymentId, deploymentTitle }) => {
    const [faults, setFaults] = useState<Fault[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'pending' | 'verified' | 'false_positive' | 'all'>('pending');
    const [editing, setEditing] = useState<Record<string, { fault_type: string; severity: string }>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [stats, setStats] = useState({ pending: 0, verified: 0, false_positive: 0 });

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/faults/deployment/${deploymentId}?limit=200`, { credentials: 'include' });
            const data = await r.json();
            if (data.success) {
                const all = data.data as Fault[];
                setFaults(all);
                setStats({
                    pending: all.filter(f => f.review_status === 'pending').length,
                    verified: all.filter(f => f.review_status === 'verified').length,
                    false_positive: all.filter(f => f.review_status === 'false_positive').length,
                });
            }
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, [deploymentId]);

    useEffect(() => { fetch_(); }, [fetch_]);

    const handleReview = async (faultId: string, reviewStatus: string) => {
        setSaving(faultId);
        const edits = editing[faultId] || {};
        try {
            await fetch(`/api/thermal/faults/${faultId}/review`, {
                method: 'PATCH', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ review_status: reviewStatus, ...edits }),
            });
            setFaults(prev => prev.map(f => f.id === faultId
                ? { ...f, review_status: reviewStatus, ...edits }
                : f
            ));
            setStats(prev => ({ ...prev, [reviewStatus]: prev[reviewStatus as keyof typeof prev] + 1, pending: Math.max(0, prev.pending - 1) }));
            setEditing(prev => { const n = { ...prev }; delete n[faultId]; return n; });
        } catch { /* no-op */ }
        finally { setSaving(null); }
    };

    const setEdit = (faultId: string, field: string, value: string) => {
        setEditing(prev => ({ ...prev, [faultId]: { ...(prev[faultId] || {}), [field]: value } as { fault_type: string; severity: string } }));
    };

    const filtered = filter === 'all' ? faults : faults.filter(f => f.review_status === filter);

    const inputStyle: React.CSSProperties = {
        background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6, color: '#f1f5f9', fontSize: 11, padding: '4px 8px',
        outline: 'none', cursor: 'pointer',
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
            Loading fault review queue...
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h4 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>🔍 AI Fault Review</h4>
                    {deploymentTitle && <div style={{ fontSize: 11, color: '#64748b' }}>{deploymentTitle}</div>}
                </div>
                <button onClick={fetch_} style={{ ...inputStyle, padding: '6px 12px', fontSize: 12, color: '#64748b' }}>🔄</button>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                {([
                    ['all', `All (${faults.length})`, '#818cf8'],
                    ['pending', `⏳ Pending (${stats.pending})`, '#f59e0b'],
                    ['verified', `✅ Verified (${stats.verified})`, '#22c55e'],
                    ['false_positive', `❌ False+ (${stats.false_positive})`, '#6b7280'],
                ] as [typeof filter, string, string][]).map(([key, label, color]) => (
                    <button key={key} onClick={() => setFilter(key)} style={{
                        background: filter === key ? `${color}18` : 'transparent',
                        border: `1px solid ${filter === key ? `${color}44` : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 8, color: filter === key ? color : '#64748b',
                        fontSize: 11, fontWeight: 700, padding: '6px 14px', cursor: 'pointer',
                    }}>{label}</button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
                    {filter === 'pending' ? '🎉 All faults reviewed!' : 'No faults in this category'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.slice(0, 50).map(fault => {
                        const edits = editing[fault.id] || {};
                        const currentType = edits.fault_type || fault.fault_type;
                        const currentSev = edits.severity || fault.severity;
                        const revColor = REVIEW_COLORS[fault.review_status] || '#6b7280';

                        return (
                            <div key={fault.id} style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: `1px solid ${fault.review_status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)'}`,
                                borderRadius: 12, padding: '14px 18px',
                            }}>
                                {/* Top row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ background: `${SEV_COLORS[fault.severity] || '#6b7280'}22`, color: SEV_COLORS[fault.severity] || '#6b7280', border: `1px solid ${SEV_COLORS[fault.severity] || '#6b7280'}44`, borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const }}>{fault.severity}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{FAULT_LABELS[fault.fault_type] || fault.fault_type}</span>
                                            {fault.ai_detected && <span style={{ fontSize: 9, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 5, padding: '2px 6px', fontWeight: 700 }}>AI</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>
                                            ΔT: <strong style={{ color: SEV_COLORS[fault.severity] || '#94a3b8' }}>{fault.temperature_delta}°C</strong>
                                            {fault.confidence_score && ` · Confidence: ${fault.confidence_score}%`}
                                            {fault.block_name && ` · ${fault.block_name}`}
                                            {` · ${new Date(fault.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                        </div>
                                    </div>
                                    {/* Review status badge */}
                                    <span style={{ background: `${revColor}18`, color: revColor, border: `1px solid ${revColor}33`, borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const }}>{fault.review_status.replace('_', ' ')}</span>
                                </div>

                                {/* Reclassification controls (only for pending/all) */}
                                {fault.review_status !== 'false_positive' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Fault Type</div>
                                            <select value={currentType} onChange={e => setEdit(fault.id, 'fault_type', e.target.value)} style={inputStyle}>
                                                {FAULT_TYPES.map(t => <option key={t} value={t}>{FAULT_LABELS[t] || t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Severity</div>
                                            <select value={currentSev} onChange={e => setEdit(fault.id, 'severity', e.target.value)} style={inputStyle}>
                                                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {fault.review_status !== 'verified' && (
                                        <button
                                            onClick={() => handleReview(fault.id, 'verified')}
                                            disabled={saving === fault.id}
                                            style={{
                                                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                                                borderRadius: 8, color: '#22c55e', fontSize: 12, fontWeight: 700,
                                                padding: '7px 16px', cursor: saving === fault.id ? 'wait' : 'pointer',
                                            }}>
                                            {saving === fault.id ? '⏳' : '✅ Verify'}
                                        </button>
                                    )}
                                    {fault.review_status !== 'false_positive' && (
                                        <button
                                            onClick={() => handleReview(fault.id, 'false_positive')}
                                            disabled={saving === fault.id}
                                            style={{
                                                background: 'rgba(107,114,128,0.12)', border: '1px solid rgba(107,114,128,0.3)',
                                                borderRadius: 8, color: '#9ca3af', fontSize: 12, fontWeight: 700,
                                                padding: '7px 16px', cursor: saving === fault.id ? 'wait' : 'pointer',
                                            }}>
                                            ❌ False Positive
                                        </button>
                                    )}
                                    {fault.review_status !== 'pending' && (
                                        <button
                                            onClick={() => handleReview(fault.id, 'pending')}
                                            disabled={saving === fault.id}
                                            style={{
                                                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                                                borderRadius: 8, color: '#f59e0b', fontSize: 11,
                                                padding: '7px 12px', cursor: saving === fault.id ? 'wait' : 'pointer',
                                            }}>
                                            ↩ Re-queue
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FaultReviewPanel;
