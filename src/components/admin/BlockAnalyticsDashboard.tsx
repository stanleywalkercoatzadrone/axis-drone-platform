/**
 * BlockAnalyticsDashboard.tsx
 * Phase 10 – Admin Block Analytics Dashboard
 *
 * Displays per-deployment block coverage, pilot productivity,
 * progress timeline, and AI completion forecast.
 * Phase 9: Client-safe — clients only see summary, not pilot data.
 */
import React, { useEffect, useState, useCallback } from 'react';

interface BlockAnalysis {
    blockId: string;
    blockName: string;
    totalAcres: number;
    acresCompleted: number;
    acresRemaining: number;
    percentComplete: number;
    estimatedDaysRemaining: number;
    imagesCollected: number;
    dataUploaded: boolean;
    status: string;
}

interface CoverageSummary {
    deploymentId: string;
    totalBlocks: number;
    blocksCompleted: number;
    blocksInProgress: number;
    blocksPending: number;
    totalAcres: number;
    acresCompleted: number;
    acresRemaining: number;
    percentComplete: number;
    estimatedDaysRemaining: number;
    blocks: BlockAnalysis[];
}

interface CompletionPrediction {
    predictedCompletionDate: string | null;
    estimatedDaysRemaining: number;
    acresPerDay: number;
    confidence: number;
    forecastWindow: { start: string; end: string; weatherScore: number } | null;
}

interface BlockAnalyticsDashboardProps {
    missionId: string;
    missionTitle?: string;
}

const STATUS_COLORS: Record<string, string> = {
    pending: '#6b7280',
    in_progress: '#f59e0b',
    completed: '#22c55e',
    skipped: '#94a3b8',
};

function ProgressBar({ value, color = '#22c55e', height = 8 }: { value: number; color?: string; height?: number }) {
    return (
        <div style={{ background: '#1e293b', borderRadius: 4, height, overflow: 'hidden', flex: 1 }}>
            <div style={{
                width: `${Math.min(100, Math.max(0, value))}%`, height: '100%',
                background: value === 100 ? '#22c55e' : value > 50 ? '#f59e0b' : color,
                borderRadius: 4, transition: 'width 0.6s ease',
            }} />
        </div>
    );
}

function KPICard({ label, value, sub, color = '#f1f5f9' }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

export const BlockAnalyticsDashboard: React.FC<BlockAnalyticsDashboardProps> = ({ missionId, missionTitle }) => {
    const [summary, setSummary] = useState<CoverageSummary | null>(null);
    const [prediction, setPrediction] = useState<CompletionPrediction | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try {
            const [sumRes, predRes] = await Promise.all([
                fetch(`/api/blocks/${missionId}/summary`, { credentials: 'include' }),
                fetch(`/api/blocks/${missionId}/predict`, { credentials: 'include' }),
            ]);
            const [sumData, predData] = await Promise.all([sumRes.json(), predRes.json()]);
            if (sumData.success) setSummary(sumData.data);
            if (predData.success) setPrediction(predData.data);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, [missionId]);

    useEffect(() => { fetch_(); }, [fetch_]);

    const fmt = (d: string | null) => {
        if (!d) return '—';
        try {
            return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return d; }
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
            Loading block analytics...
        </div>
    );

    if (!summary || summary.totalBlocks === 0) return (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🔲</div>
            <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>No blocks configured</div>
            <div style={{ fontSize: 12 }}>Import a KML file or manually add blocks to start tracking progress</div>
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h4 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>🔲 Block Analytics</h4>
                    {missionTitle && <div style={{ fontSize: 11, color: '#64748b' }}>{missionTitle}</div>}
                </div>
                <button onClick={fetch_} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#64748b', fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}>🔄</button>
            </div>

            {/* Overall progress bar */}
            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Site Inspection Progress</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: summary.percentComplete === 100 ? '#22c55e' : '#818cf8' }}>
                        {summary.percentComplete}%
                    </span>
                </div>
                <ProgressBar value={summary.percentComplete} height={10} />
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                    {summary.acresCompleted} of {summary.totalAcres} acres inspected · {summary.blocksCompleted}/{summary.totalBlocks} blocks complete
                </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <KPICard label="Total Blocks" value={summary.totalBlocks} color="#818cf8" />
                <KPICard label="Completed" value={summary.blocksCompleted} color="#22c55e" />
                <KPICard label="In Progress" value={summary.blocksInProgress} color="#f59e0b" />
                <KPICard label="Pending" value={summary.blocksPending} color="#6b7280" />
                <KPICard
                    label="Est. Days Left"
                    value={summary.estimatedDaysRemaining > 0 ? `${summary.estimatedDaysRemaining}d` : '—'}
                    color={summary.estimatedDaysRemaining > 5 ? '#ef4444' : '#22c55e'}
                />
            </div>

            {/* Completion Prediction */}
            {prediction && prediction.predictedCompletionDate && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>📅 Predicted Completion</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{fmt(prediction.predictedCompletionDate)}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                            {prediction.acresPerDay} acres/day effective · Confidence: {prediction.confidence}%
                        </div>
                    </div>
                    {prediction.forecastWindow && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Best Window</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(prediction.forecastWindow.start)} →</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Weather: {prediction.forecastWindow.weatherScore}/100</div>
                        </div>
                    )}
                </div>
            )}

            {/* Per-block table */}
            <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px 60px', gap: 12 }}>
                    {['Block', 'Status', 'Progress', 'Acres Left', 'Images'].map(h => (
                        <div key={h} style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
                    ))}
                </div>
                {summary.blocks.map((block, i) => (
                    <div key={block.blockId}
                        onClick={() => setExpanded(e => e === block.blockId ? null : block.blockId)}
                        style={{
                            padding: '12px 16px',
                            borderBottom: i < summary.blocks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            background: expanded === block.blockId ? 'rgba(99,102,241,0.05)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                            cursor: 'pointer', transition: 'background 0.15s',
                        }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px 60px', gap: 12, alignItems: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {block.blockName}
                            </div>
                            <div>
                                <span style={{ background: `${STATUS_COLORS[block.status] || '#6b7280'}22`, color: STATUS_COLORS[block.status] || '#6b7280', borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
                                    {block.status.replace('_', ' ')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ProgressBar value={block.percentComplete} height={6} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: block.percentComplete === 100 ? '#22c55e' : '#94a3b8', minWidth: 30 }}>
                                    {block.percentComplete}%
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{block.acresRemaining} ac</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{block.imagesCollected || '—'}</div>
                        </div>
                        {expanded === block.blockId && (
                            <div style={{ marginTop: 12, padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                                {[
                                    { label: 'Total Acres', value: `${block.totalAcres} ac` },
                                    { label: 'Completed', value: `${block.acresCompleted} ac` },
                                    { label: 'Days Left', value: block.estimatedDaysRemaining > 0 ? `~${block.estimatedDaysRemaining}d` : '—' },
                                    { label: 'Data Uploaded', value: block.dataUploaded ? '✅ Yes' : '⏳ No' },
                                    { label: 'Images', value: block.imagesCollected || '—' },
                                ].map(({ label, value }) => (
                                    <div key={label}>
                                        <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontWeight: 600 }}>{label}</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{value}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BlockAnalyticsDashboard;
