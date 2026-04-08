/**
 * EnergyLossDashboard.tsx
 * Phase 8 – Client + Admin Energy Loss Financial Dashboard
 *
 * Displays:
 * - Daily/annual revenue loss (prominently)
 * - kWh loss
 * - Loss by block (bar chart simulation)
 * - Fault type contributions (distribution bar)
 * - Energy trend over time (sparkline)
 *
 * Phase 9: Color-coded block severity overlay data
 * Phase 11: Client-safe — never shows AI confidence or pilot scoring
 */
import React, { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SiteLoss {
    deploymentId: string;
    siteDailyRevenueLoss: number;
    siteAnnualRevenueLoss: number;
    siteDailyKwhLoss: number;
    siteAnnualKwhLoss: number;
    totalFaults: number;
    blocksWithLoss: number;
    byFaultType?: { faultType: string; faultCount: number; annualRevenueLoss: number }[];
    bySeverity?: { severity: string; faultCount: number; annualRevenueLoss: number }[];
}

interface BlockLoss {
    blockName: string;
    blockId?: string;
    dailyRevenueLoss: number;
    annualRevenueLoss: number;
    faultCount?: number;
}

interface TrendWeek {
    week: string;
    dailyRevenueLoss: number;
    faultCount: number;
}

interface Trend {
    trendDirection: string;
    changePercent: number;
    trendMessage: string;
    weekly: TrendWeek[];
}

interface EnergyLossDashboardProps {
    deploymentId: string;
    deploymentTitle?: string;
    isAdmin?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
const fmtKwh = (v: number) =>
    v >= 1000 ? `${Math.round(v / 10) / 100} MWh` : `${Math.round(v * 10) / 10} kWh`;

const FAULT_LABELS: Record<string, string> = {
    hot_cell: 'Hot Cell', bypass_diode_failure: 'Bypass Diode', string_outage: 'String Outage',
    connector_overheating: 'Connector', panel_mismatch: 'Panel Mismatch', shading_anomaly: 'Shading',
    minor_thermal_deviation: 'Minor Deviation',
};

const TREND_COLORS: Record<string, string> = {
    increasing: '#ef4444', decreasing: '#22c55e', stable: '#94a3b8',
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function FinancialKPI({
    label, value, sub, color = '#f1f5f9', highlight = false
}: { label: string; value: string; sub?: string; color?: string; highlight?: boolean }) {
    return (
        <div style={{
            background: highlight ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${highlight ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 14, padding: '18px 20px', flex: 1, minWidth: 130,
        }}>
            <div style={{ fontSize: 26, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

// Simple horizontal bar
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2;
    return (
        <div style={{ background: '#1e293b', borderRadius: 3, height: 8, overflow: 'hidden', flex: 1 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
        </div>
    );
}

// Sparkline from weekly trend data
function Sparkline({ data }: { data: TrendWeek[] }) {
    if (data.length < 2) return <div style={{ color: '#475569', fontSize: 11 }}>Not enough data</div>;
    const vals = data.map(d => d.dailyRevenueLoss);
    const maxV = Math.max(...vals, 0.01);
    const w = 180, h = 40;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / maxV) * h}`).join(' ');
    return (
        <svg width={w} height={h} style={{ overflow: 'visible' }}>
            <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />
            {vals.map((v, i) => (
                <circle key={i} cx={(i / (vals.length - 1)) * w} cy={h - (v / maxV) * h}
                    r={3} fill="#818cf8" />
            ))}
        </svg>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export const EnergyLossDashboard: React.FC<EnergyLossDashboardProps> = ({
    deploymentId, deploymentTitle, isAdmin = false
}) => {
    const [site, setSite] = useState<SiteLoss | null>(null);
    const [blocks, setBlocks] = useState<BlockLoss[]>([]);
    const [trend, setTrend] = useState<Trend | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'trend'>('overview');

    const fetch_ = useCallback(async () => {
        setLoading(true);
        try {
            const [siteRes, blocksRes, trendRes] = await Promise.all([
                fetch(`/api/energy-loss/deployment/${deploymentId}`, { credentials: 'include' }),
                fetch(`/api/energy-loss/deployment/${deploymentId}/blocks`, { credentials: 'include' }),
                fetch(`/api/energy-loss/deployment/${deploymentId}/trend`, { credentials: 'include' }),
            ]);
            const [siteData, blocksData, trendData] = await Promise.all([
                siteRes.json(), blocksRes.json(), trendRes.json(),
            ]);
            if (siteData.success) setSite(siteData.data);
            if (blocksData.success) setBlocks(blocksData.data || []);
            if (trendData.success) setTrend(trendData.data);
        } catch { /* no-op */ }
        finally { setLoading(false); }
    }, [deploymentId]);

    useEffect(() => { fetch_(); }, [fetch_]);

    if (loading) return (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b', fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>💰</div>
            Calculating financial impact...
        </div>
    );

    const noData = !site || site.siteAnnualRevenueLoss === 0;
    const maxBlockLoss = Math.max(...blocks.map(b => b.annualRevenueLoss), 0.01);

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h4 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>💰 Energy Loss & Financial Impact</h4>
                    {deploymentTitle && <div style={{ fontSize: 11, color: '#64748b' }}>{deploymentTitle}</div>}
                </div>
                <button onClick={fetch_} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#64748b', fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}>🔄</button>
            </div>

            {noData ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
                    <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>No Energy Loss Data</div>
                    <div style={{ fontSize: 12 }}>Upload thermal inspection data to calculate financial impact</div>
                </div>
            ) : (
                <>
                    {/* Primary Financial KPIs */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                        <FinancialKPI
                            label="Annual Revenue Loss"
                            value={fmt$(site!.siteAnnualRevenueLoss)}
                            sub={`${fmtKwh(site!.siteAnnualKwhLoss)} / year`}
                            color="#ef4444"
                            highlight
                        />
                        <FinancialKPI
                            label="Daily Revenue Loss"
                            value={fmt$(site!.siteDailyRevenueLoss)}
                            sub={`${fmtKwh(site!.siteDailyKwhLoss)} / day`}
                            color="#f97316"
                        />
                        <FinancialKPI
                            label="Faults Detected"
                            value={`${site!.totalFaults}`}
                            sub={`${site!.blocksWithLoss} blocks affected`}
                            color="#818cf8"
                        />
                        {trend && (
                            <FinancialKPI
                                label="Trend"
                                value={`${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}%`}
                                sub={trend.trendDirection}
                                color={TREND_COLORS[trend.trendDirection] || '#94a3b8'}
                            />
                        )}
                    </div>

                    {/* Trend message banner */}
                    {trend && (
                        <div style={{
                            background: `${TREND_COLORS[trend.trendDirection] || '#6b7280'}11`,
                            border: `1px solid ${TREND_COLORS[trend.trendDirection] || '#6b7280'}33`,
                            borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13,
                            color: TREND_COLORS[trend.trendDirection] || '#94a3b8',
                        }}>
                            {trend.trendDirection === 'increasing' ? '📈' : trend.trendDirection === 'decreasing' ? '📉' : '➡️'}{' '}
                            {trend.trendMessage}
                        </div>
                    )}

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                        {([
                            ['overview', '📊 Overview'],
                            ['blocks', '🔲 By Block'],
                            ['trend', '📈 Trend'],
                        ] as [typeof activeTab, string][]).map(([key, label]) => (
                            <button key={key} onClick={() => setActiveTab(key)} style={{
                                background: activeTab === key ? 'rgba(99,102,241,0.15)' : 'transparent',
                                border: `1px solid ${activeTab === key ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 8, color: activeTab === key ? '#818cf8' : '#64748b',
                                fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer',
                            }}>{label}</button>
                        ))}
                    </div>

                    {/* Tab: Overview */}
                    {activeTab === 'overview' && (
                        <div>
                            {/* Phase 8: Fault type contribution */}
                            {isAdmin && site?.byFaultType && site.byFaultType.length > 0 && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Revenue Loss by Fault Type</div>
                                    {site.byFaultType.map(ft => (
                                        <div key={ft.faultType} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                                <span style={{ color: '#94a3b8' }}>{FAULT_LABELS[ft.faultType] || ft.faultType}</span>
                                                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{fmt$(ft.annualRevenueLoss)}/yr · {ft.faultCount} faults</span>
                                            </div>
                                            <HBar value={ft.annualRevenueLoss} max={site!.siteAnnualRevenueLoss} color="#ef4444" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Severity distribution */}
                            {isAdmin && site?.bySeverity && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
                                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Revenue Impact by Severity</div>
                                    {site.bySeverity.map(s => {
                                        const c = { critical: '#ef4444', moderate: '#f97316', low: '#eab308' }[s.severity] || '#6b7280';
                                        return (
                                            <div key={s.severity} style={{ marginBottom: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                                    <span style={{ color: c, fontWeight: 600, textTransform: 'capitalize' }}>{s.severity}</span>
                                                    <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{fmt$(s.annualRevenueLoss)}/yr</span>
                                                </div>
                                                <HBar value={s.annualRevenueLoss} max={site!.siteAnnualRevenueLoss} color={c} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Client-only simple message */}
                            {!isAdmin && (
                                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '16px 20px' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444', marginBottom: 8 }}>⚡ Estimated Financial Impact</div>
                                    <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                                        Thermal faults on your site are estimated to cost{' '}
                                        <strong style={{ color: '#f1f5f9' }}>{fmt$(site!.siteAnnualRevenueLoss)} per year</strong> in lost energy production.
                                        Prompt repair of critical faults can recover this revenue.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab: By Block */}
                    {activeTab === 'blocks' && (
                        <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            {blocks.filter(b => b.annualRevenueLoss > 0).slice(0, 20).map((b, i) => (
                                <div key={i} style={{
                                    padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{b.blockName}</div>
                                            {b.faultCount != null && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{b.faultCount} faults</div>}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{fmt$(b.annualRevenueLoss)}/yr</div>
                                            <div style={{ fontSize: 11, color: '#64748b' }}>{fmt$(b.dailyRevenueLoss)}/day</div>
                                        </div>
                                    </div>
                                    <HBar value={b.annualRevenueLoss} max={maxBlockLoss} color="#ef4444" />
                                </div>
                            ))}
                            {blocks.filter(b => b.annualRevenueLoss > 0).length === 0 && (
                                <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: 13 }}>No block-level loss data</div>
                            )}
                        </div>
                    )}

                    {/* Tab: Trend sparkline */}
                    {activeTab === 'trend' && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px' }}>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
                                Daily Revenue Loss Trend ({trend?.weeksAnalyzed || 12} Weeks)
                            </div>
                            {trend && trend.weekly.length >= 2 ? (
                                <>
                                    <Sparkline data={trend.weekly} />
                                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                                        {trend.weekly.slice(-6).map((w, i) => (
                                            <div key={i} style={{ fontSize: 11 }}>
                                                <div style={{ color: '#64748b', marginBottom: 2 }}>{new Date(w.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{fmt$(w.dailyRevenueLoss)}/day</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: '#64748b', fontSize: 13 }}>
                                    Trend data builds over time as more inspections are completed and faults are tracked.
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default EnergyLossDashboard;
