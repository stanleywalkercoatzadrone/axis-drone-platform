/**
 * ThermalFaultDashboard.tsx
 * Phase 10 – Client + Admin Thermal Fault Dashboard
 *
 * Clients see: fault summary, fault locations, recommended repairs.
 * Admins see: + per-block breakdown, AI confidence, pilot data, priority ranking.
 *
 * Phase 7: Density heatmap via visual cluster grid.
 */
import React, { useEffect, useState, useCallback } from 'react';

interface FaultSummary {
    deploymentId: string;
    totalFaults: number;
    criticalFaults: number;
    moderateFaults: number;
    lowFaults: number;
    avgTempDelta: number;
    maxTempDelta: number;
    blocksWithFaults: number;
    blockBreakdown?: BlockFaultRow[];
}

interface BlockFaultRow {
    blockId: string;
    blockName: string;
    faultCount: number;
    criticalFaults: number;
    maxTempDelta: number;
}

interface Fault {
    id: string;
    block_id: string;
    block_name?: string;
    latitude: number | null;
    longitude: number | null;
    temperature_delta: number;
    fault_type: string;
    severity: string;
    confidence_score?: number;
    priority_score?: number;
    detected_at: string;
    status: string;
}

interface ThermalFaultDashboardProps {
    deploymentId: string;
    deploymentTitle?: string;
    isAdmin?: boolean;
}

const SEV_COLORS: Record<string, string> = {
    critical: '#ef4444',
    moderate: '#f97316',
    low: '#eab308',
    normal: '#22c55e',
};

const FAULT_LABELS: Record<string, string> = {
    hot_cell: '🔥 Hot Cell',
    bypass_diode_failure: '⚡ Bypass Diode Failure',
    string_outage: '❌ String Outage',
    connector_overheating: '🌡 Connector Overheating',
    panel_mismatch: '⚖️ Panel Mismatch',
    shading_anomaly: '🌑 Shading Anomaly',
    minor_thermal_deviation: '⚠️ Minor Thermal Deviation',
    normal: '✅ Normal',
};

const REPAIR_RECOMMENDATIONS: Record<string, string> = {
    hot_cell: 'Replace affected cell; inspect for micro-cracks.',
    bypass_diode_failure: 'Replace bypass diode; check junction box connections.',
    string_outage: 'Inspect full string for open circuit; check combiner box.',
    connector_overheating: 'Re-torque or replace MC4 connectors in affected zone.',
    panel_mismatch: 'Test I-V curves; replace mismatched panels.',
    shading_anomaly: 'Inspect for obstructions; optimize row spacing.',
    minor_thermal_deviation: 'Monitor; schedule follow-up inspection.',
};

function SeverityBadge({ severity }: { severity: string }) {
    const c = SEV_COLORS[severity] || '#6b7280';
    return (
        <span style={{ background: `${c}22`, color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: '2px 9px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const }}>
            {severity}
        </span>
    );
}

function KPICard({ label, value, color = '#f1f5f9', sub }: { label: string; value: string | number; color?: string; sub?: string }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

// Phase 7: Simple density heatmap — severity distribution bar
function SeverityDistribution({ critical, moderate, low }: { critical: number; moderate: number; low: number }) {
    const total = critical + moderate + low || 1;
    return (
        <div>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
                {[
                    { val: critical, color: '#ef4444' },
                    { val: moderate, color: '#f97316' },
                    { val: low, color: '#eab308' },
                ].map(({ val, color }, i) => val > 0 ? (
                    <div key={i} style={{ flex: val / total, background: color, transition: 'flex 0.5s ease' }} />
                ) : null)}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                {[['Critical', critical, '#ef4444'], ['Moderate', moderate, '#f97316'], ['Low', low, '#eab308']].map(([l, v, c]) => (
                    <span key={l as string} style={{ color: c as string }}>● {v as number} {l as string}</span>
                ))}
            </div>
        </div>
    );
}

export const ThermalFaultDashboard: React.FC<ThermalFaultDashboardProps> = ({ deploymentId, deploymentTitle, isAdmin = false }) => {
    const [summary, setSummary] = useState<FaultSummary | null>(null);
    const [faults, setFaults] = useState<Fault[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'faults' | 'repairs'>('overview');

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try {
            const sumUrl = `/api/faults/deployment/${deploymentId}/summary`;
            const faultsUrl = isAdmin
                ? `/api/faults/deployment/${deploymentId}/ranked`
                : `/api/faults/deployment/${deploymentId}`;

            const [sumRes, faultsRes] = await Promise.all([
                fetch(sumUrl, { credentials: 'include' }),
                fetch(faultsUrl, { credentials: 'include' }),
            ]);
            const [sumData, faultsData] = await Promise.all([sumRes.json(), faultsRes.json()]);
            if (sumData.success) setSummary(sumData.data);
            if (faultsData.success) setFaults(faultsData.data || []);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, [deploymentId, isAdmin]);

    useEffect(() => { fetch_(); }, [fetch_]);

    // Socket.IO refresh
    useEffect(() => {
        try {
            const { io } = require('socket.io-client');
            const socket = io({ auth: { withCredentials: true } });
            socket.on('thermal_fault_detected', fetch_);
            socket.on('fault_status_updated', fetch_);
            return () => socket.disconnect();
        } catch { /* optional */ }
    }, [fetch_]);

    const handleUpdateStatus = async (faultId: string, status: string) => {
        try {
            await fetch(`/api/faults/${faultId}/status`, {
                method: 'PATCH', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            fetch_();
        } catch { /* no-op */ }
    };

    const fmt = (d: string) => {
        try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
        catch { return d; }
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🌡</div>
            Loading thermal analysis...
        </div>
    );

    const noFaults = !summary || summary.totalFaults === 0;

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h4 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>🌡 Thermal Fault Analysis</h4>
                    {deploymentTitle && <div style={{ fontSize: 11, color: '#64748b' }}>{deploymentTitle}</div>}
                </div>
                <button onClick={fetch_} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#64748b', fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}>🔄</button>
            </div>

            {noFaults ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
                    <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>No Thermal Faults Detected</div>
                    <div style={{ fontSize: 12 }}>Upload thermal inspection imagery to begin fault analysis</div>
                </div>
            ) : (
                <>
                    {/* KPI Row */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                        <KPICard label="Total Faults" value={summary!.totalFaults} color="#818cf8" />
                        <KPICard label="Critical" value={summary!.criticalFaults} color="#ef4444" sub={`Max ΔT: ${summary!.maxTempDelta}°C`} />
                        <KPICard label="Moderate" value={summary!.moderateFaults} color="#f97316" />
                        <KPICard label="Low" value={summary!.lowFaults} color="#eab308" />
                        {isAdmin && <KPICard label="Blocks Affected" value={summary!.blocksWithFaults} color="#06b6d4" sub={`Avg ΔT: ${summary!.avgTempDelta}°C`} />}
                    </div>

                    {/* Phase 7: Severity Distribution */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Severity Distribution</div>
                        <SeverityDistribution critical={summary!.criticalFaults} moderate={summary!.moderateFaults} low={summary!.lowFaults} />
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                        {([
                            ['overview', '📊 Overview'],
                            ['faults', '🔍 Fault List'],
                            ['repairs', '🔧 Repairs'],
                        ] as [typeof activeTab, string][]).map(([key, label]) => (
                            <button key={key} onClick={() => setActiveTab(key)} style={{
                                background: activeTab === key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                border: `1px solid ${activeTab === key ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 8, color: activeTab === key ? '#818cf8' : '#64748b',
                                fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer',
                            }}>{label}</button>
                        ))}
                    </div>

                    {/* Tab: Overview — block breakdown */}
                    {activeTab === 'overview' && isAdmin && summary?.blockBreakdown && (
                        <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px', gap: 12 }}>
                                {['Block', 'Faults', 'Critical', 'Max ΔT'].map(h => (
                                    <div key={h} style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                                ))}
                            </div>
                            {summary.blockBreakdown.map((b, i) => (
                                <div key={b.blockId} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px', gap: 12, alignItems: 'center', padding: '10px 16px', borderBottom: i < summary.blockBreakdown!.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{b.blockName}</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{b.faultCount}</div>
                                    <div style={{ fontSize: 12, color: b.criticalFaults > 0 ? '#ef4444' : '#94a3b8', fontWeight: b.criticalFaults > 0 ? 700 : 400 }}>{b.criticalFaults}</div>
                                    <div style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>{b.maxTempDelta}°C</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'overview' && !isAdmin && (
                        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: '16px 20px' }}>
                            <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>⚠️ Action Required</div>
                            <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                {summary!.criticalFaults} critical fault{summary!.criticalFaults !== 1 ? 's' : ''} detected across your site. Please review the fault list and repair recommendations.
                            </div>
                        </div>
                    )}

                    {/* Tab: Fault List */}
                    {activeTab === 'faults' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {faults.filter(f => f.severity !== 'normal').slice(0, 30).map(fault => (
                                <div key={fault.id} style={{
                                    background: 'rgba(255,255,255,0.02)', border: `1px solid ${SEV_COLORS[fault.severity] || '#6b7280'}33`,
                                    borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                            <SeverityBadge severity={fault.severity} />
                                            <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{FAULT_LABELS[fault.fault_type] || fault.fault_type}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>
                                            {fault.block_name && `${fault.block_name} · `}
                                            ΔT: <strong style={{ color: SEV_COLORS[fault.severity] }}>{fault.temperature_delta}°C</strong>
                                            {isAdmin && fault.confidence_score && ` · Confidence: ${fault.confidence_score}%`}
                                            {isAdmin && fault.priority_score != null && ` · Priority: ${fault.priority_score}`}
                                            {` · ${fmt(fault.detected_at)}`}
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <select
                                            value={fault.status || 'open'}
                                            onChange={e => handleUpdateStatus(fault.id, e.target.value)}
                                            style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#94a3b8', fontSize: 11, padding: '5px 8px', outline: 'none', cursor: 'pointer' }}
                                        >
                                            <option value="open">Open</option>
                                            <option value="verified">Verified</option>
                                            <option value="resolved">Resolved</option>
                                        </select>
                                    )}
                                </div>
                            ))}
                            {faults.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No faults to display</div>}
                        </div>
                    )}

                    {/* Tab: Repair Recommendations */}
                    {activeTab === 'repairs' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Get unique fault types found */}
                            {[...new Set(faults.filter(f => f.severity !== 'normal').map(f => f.fault_type))].map(type => (
                                <div key={type} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 18px' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', marginBottom: 6 }}>{FAULT_LABELS[type] || type}</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{REPAIR_RECOMMENDATIONS[type] || 'Consult qualified solar technician.'}</div>
                                    <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                                        {faults.filter(f => f.fault_type === type && f.severity !== 'normal').length} instance(s) detected
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ThermalFaultDashboard;
