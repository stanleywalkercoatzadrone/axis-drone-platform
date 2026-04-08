/**
 * AxisCommandCenter.tsx — Phase 11+ Enterprise Command Center
 * Includes: Portfolio, Forecast, Pilot Allocation, Weather Risk,
 * Sessions, Timeline, Thermal Faults, Solar Command, Pilot Performance
 */
import React, { useEffect, useState, useCallback } from 'react';
import { SessionsView } from '../dashboard/SessionsView';
import { MissionTimelineView } from '../dashboard/MissionTimelineView';
import { PilotPerformanceView } from '../dashboard/PilotPerformanceView';

interface MissionSummary {
    id: string;
    title: string;
    status: string;
    siteName: string;
    industryKey: string;
    date: string;
    latitude: number | null;
    longitude: number | null;
}

interface ForecastWindow {
    forecast_start_date: string;
    forecast_end_date: string;
    confidence_score: number;
    forecast_confidence: number;
    weather_score: number;
    recommended: boolean;
    consecutive_days: number;
}

interface PilotAllocation {
    pilot_id: string;
    full_name: string;
    reliability_score: number | null;
    missions_completed: number;
    average_blocks_per_day: number | null;
}

interface CommandCenterData {
    missions: MissionSummary[];
    forecastWindows: Record<string, ForecastWindow[]>;
    pilotAllocation: PilotAllocation[];
}

const STATUS_COLORS: Record<string, string> = {
    Active: '#22c55e',
    Scheduled: '#3b82f6',
    Completed: '#8b5cf6',
    Delayed: '#f59e0b',
    Cancelled: '#ef4444',
    Review: '#06b6d4',
    Draft: '#6b7280',
};

function StatusBadge({ status }: { status: string }) {
    const color = STATUS_COLORS[status] || '#6b7280';
    return (
        <span style={{
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase' as const,
        }}>
            {status}
        </span>
    );
}

function ConfidenceBar({ value }: { value: number }) {
    const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ color, fontWeight: 700, fontSize: 12, minWidth: 36 }}>{value}%</span>
        </div>
    );
}

export const AxisCommandCenter: React.FC = () => {
    const [data, setData] = useState<CommandCenterData>({
        missions: [], forecastWindows: {}, pilotAllocation: []
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<
        'portfolio' | 'forecast' | 'pilots' | 'weather' |
        'sessions' | 'timeline' | 'thermal-faults' | 'solar-command' | 'pilot-performance'
    >('portfolio');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [missionsRes, pilotsRes] = await Promise.all([
                fetch('/api/deployments', { credentials: 'include' }),
                fetch('/api/admin/pilot-performance', { credentials: 'include' }).catch(() => ({ ok: false, json: async () => ({ data: [] }) })),
            ]);

            const missionsData = await missionsRes.json();
            const pilotsData = await (pilotsRes as Response).json();

            const missions: MissionSummary[] = (missionsData.data || []).slice(0, 30);

            // Fetch top 5 forecast windows for active missions
            const forecastWindows: Record<string, ForecastWindow[]> = {};
            const activeMissions = missions.filter(m => ['Active', 'Scheduled'].includes(m.status)).slice(0, 8);
            await Promise.all(activeMissions.map(async (m) => {
                try {
                    const fRes = await fetch(`/api/forecast/${m.id}/windows`, { credentials: 'include' });
                    const fData = await fRes.json();
                    if (fData.windows?.length) forecastWindows[m.id] = fData.windows;
                } catch { /* skip */ }
            }));

            setData({
                missions,
                forecastWindows,
                pilotAllocation: pilotsData.data || [],
            });
        } catch (err) {
            console.error('[AxisCommandCenter] fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const stats = {
        total: data.missions.length,
        active: data.missions.filter(m => m.status === 'Active').length,
        scheduled: data.missions.filter(m => m.status === 'Scheduled').length,
        delayed: data.missions.filter(m => m.status === 'Delayed').length,
        completed: data.missions.filter(m => m.status === 'Completed').length,
        withOptimalWindow: Object.keys(data.forecastWindows).filter(id =>
            data.forecastWindows[id]?.some(w => w.recommended)
        ).length,
    };

    const TABS = [
        { key: 'portfolio',         label: '📊 Portfolio' },
        { key: 'forecast',          label: '📡 Forecast' },
        { key: 'pilots',            label: '👤 Pilot Alloc' },
        { key: 'weather',           label: '🌤 Weather' },
        { key: 'sessions',          label: '▶ Sessions' },
        { key: 'timeline',          label: '🕐 Timeline' },
        { key: 'pilot-performance', label: '🏆 Pilots' },
    ];

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320, color: '#64748b' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                <div>Loading Command Center...</div>
            </div>
        </div>
    );

    return (
        <div style={{ fontFamily: "'Inter', 'SF Pro', system-ui, sans-serif", color: '#e2e8f0', background: 'transparent' }}>

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.5 }}>
                    ⚡ Axis Command Center
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    Enterprise operational intelligence — last refreshed {new Date().toLocaleTimeString()}
                </p>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
                {[
                    { label: 'Total Missions', value: stats.total, color: '#6366f1' },
                    { label: 'Active', value: stats.active, color: '#22c55e' },
                    { label: 'Scheduled', value: stats.scheduled, color: '#3b82f6' },
                    { label: 'Delayed', value: stats.delayed, color: '#f59e0b' },
                    { label: 'Completed', value: stats.completed, color: '#8b5cf6' },
                    { label: 'Optimal Windows', value: stats.withOptimalWindow, color: '#06b6d4' },
                ].map(kpi => (
                    <div key={kpi.label} style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 12,
                        padding: '16px 20px',
                    }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Tab nav */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} style={{
                        background: activeTab === tab.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: activeTab === tab.key ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                        borderRadius: 8,
                        color: activeTab === tab.key ? '#818cf8' : '#64748b',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '7px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}>{tab.label}</button>
                ))}
            </div>

            {/* ── Portfolio tab */}
            {activeTab === 'portfolio' && (
                <div>
                    {data.missions.length === 0
                        ? <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No missions found</div>
                        : data.missions.map(m => (
                            <div key={m.id} style={{
                                display: 'flex', alignItems: 'center', gap: 16,
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 10, padding: '12px 16px', marginBottom: 8,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{m.siteName} · {m.industryKey || 'N/A'} · {m.date}</div>
                                </div>
                                <StatusBadge status={m.status} />
                                {data.forecastWindows[m.id]?.[0] && (
                                    <div style={{ textAlign: 'right', minWidth: 90 }}>
                                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Confidence</div>
                                        <ConfidenceBar value={data.forecastWindows[m.id][0].forecast_confidence || data.forecastWindows[m.id][0].confidence_score || 0} />
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
            )}

            {/* ── Forecast Windows tab */}
            {activeTab === 'forecast' && (
                <div>
                    {Object.keys(data.forecastWindows).length === 0
                        ? <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No forecast windows generated yet for active missions.</div>
                        : Object.entries(data.forecastWindows).map(([missionId, windows]) => {
                            const mission = data.missions.find(m => m.id === missionId);
                            return (
                                <div key={missionId} style={{ marginBottom: 20 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                                        {mission?.title || missionId}
                                    </div>
                                    {windows.slice(0, 3).map((w, i) => (
                                        <div key={i} style={{
                                            background: w.recommended ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${w.recommended ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                            borderRadius: 10, padding: '12px 16px', marginBottom: 8,
                                            display: 'flex', alignItems: 'center', gap: 20
                                        }}>
                                            <div>
                                                {w.recommended && <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700, display: 'block', marginBottom: 2 }}>✓ RECOMMENDED</span>}
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{w.forecast_start_date} → {w.forecast_end_date}</div>
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{w.consecutive_days} days · Weather: {w.weather_score}/100</div>
                                            </div>
                                            <div style={{ marginLeft: 'auto', minWidth: 100 }}>
                                                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Completion Confidence</div>
                                                <ConfidenceBar value={w.forecast_confidence || w.confidence_score || 0} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })
                    }
                </div>
            )}

            {/* ── Pilots tab */}
            {activeTab === 'pilots' && (
                <div>
                    {data.pilotAllocation.length === 0
                        ? <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No pilot performance data available.</div>
                        : data.pilotAllocation.map((p, i) => (
                            <div key={p.pilot_id} style={{
                                display: 'flex', alignItems: 'center', gap: 16,
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 10, padding: '12px 16px', marginBottom: 8,
                            }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: 'rgba(99,102,241,0.2)', color: '#818cf8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: 13, flexShrink: 0
                                }}>#{i + 1}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.full_name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        {p.missions_completed} missions · {p.average_blocks_per_day ? `${p.average_blocks_per_day} panels/day avg` : 'No output data'}
                                    </div>
                                </div>
                                {p.reliability_score != null && (
                                    <div style={{ minWidth: 120, textAlign: 'right' }}>
                                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Reliability</div>
                                        <ConfidenceBar value={parseFloat(p.reliability_score as unknown as string) || 0} />
                                    </div>
                                )}
                            </div>
                        ))
                    }
                </div>
            )}

            {/* ── Weather Risk tab */}
            {activeTab === 'weather' && (
                <div>
                    {Object.keys(data.forecastWindows).length === 0
                        ? <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No forecast data to assess weather risk.</div>
                        : (() => {
                            const weatherRisks = Object.entries(data.forecastWindows)
                                .map(([missionId, windows]) => {
                                    const mission = data.missions.find(m => m.id === missionId);
                                    const avgWeather = windows.reduce((s, w) => s + (w.weather_score || 0), 0) / Math.max(1, windows.length);
                                    const riskLevel = avgWeather >= 75 ? 'Low' : avgWeather >= 50 ? 'Medium' : 'High';
                                    const riskColor = avgWeather >= 75 ? '#22c55e' : avgWeather >= 50 ? '#f59e0b' : '#ef4444';
                                    return { missionId, missionTitle: mission?.title || missionId, avgWeather: Math.round(avgWeather), riskLevel, riskColor };
                                })
                                .sort((a, b) => a.avgWeather - b.avgWeather);

                            return weatherRisks.map(r => (
                                <div key={r.missionId} style={{
                                    display: 'flex', alignItems: 'center', gap: 16,
                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 10, padding: '12px 16px', marginBottom: 8,
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.missionTitle}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Avg weather score: {r.avgWeather}/100</div>
                                    </div>
                                    <span style={{ color: r.riskColor, fontWeight: 700, fontSize: 12, background: `${r.riskColor}22`, borderRadius: 6, padding: '3px 10px' }}>
                                        {r.riskLevel} Risk
                                    </span>
                                </div>
                            ));
                        })()
                    }
                </div>
            )}

            {/* ── ENTERPRISE VIEWS ────────────────────────── */}
            {activeTab === 'sessions' && <div style={{ padding: '4px 0' }}><SessionsView /></div>}
            {activeTab === 'timeline' && <div style={{ padding: '4px 0' }}><MissionTimelineView /></div>}
            {activeTab === 'pilot-performance' && <div style={{ padding: '4px 0' }}><PilotPerformanceView /></div>}

            {/* Refresh button */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={fetchData} style={{
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 8, color: '#818cf8', fontSize: 12, fontWeight: 600,
                    padding: '8px 16px', cursor: 'pointer'
                }}>🔄 Refresh</button>
            </div>
        </div>
    );
};

export default AxisCommandCenter;
