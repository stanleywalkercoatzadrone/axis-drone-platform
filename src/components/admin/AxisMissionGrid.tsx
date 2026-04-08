/**
 * AxisMissionGrid.tsx
 * Phase 5 – Global Mission Grid UI (Axis Command Center / Mission Control)
 * Phase 6 – Mission detail sidebar
 * Phase 7 – Socket.IO live status updates
 * Phase 8 – Pilot location layer
 * Phase 9 – Filters and search
 * Phase 10 – Priority heatmap overlay
 * Phase 12 – Admin override controls
 * Phase 14 – Integrated tab in AxisCommandCenter
 *
 * Admin-only (Phase 11). Clients/pilots never see this view.
 * Uses react-leaflet for map rendering (already installed).
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ForecastWindow {
    startDate: string | null;
    endDate: string | null;
    weatherScore: number | null;
    forecastConfidence: number | null;
    recommended: boolean;
    consecutiveDays: number | null;
}

interface Orchestration {
    recommendedStartDate: string | null;
    recommendedEndDate: string | null;
    aiConfidence: number | null;
    priorityScore: number | null;
    status: string;
    manualOverride: boolean;
    predictedCompletionDays: number | null;
    recommendedPilotName: string | null;
}

interface Mission {
    id: string;
    title: string;
    siteName: string;
    status: string;
    missionStatus: string | null;
    industryKey: string | null;
    latitude: number;
    longitude: number;
    daysOnSite: number | null;
    date: string;
    assignedPilots: { name: string; email: string }[];
    pilotReliability: number | null;
    forecastWindow: ForecastWindow | null;
    orchestration: Orchestration | null;
    weatherRisk: { risk: 'LOW' | 'MEDIUM' | 'HIGH'; label: string; color: string; score: number };
    markerColor: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
};

const RISK_COLORS: Record<string, string> = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' };
const STATUS_COLORS: Record<string, string> = {
    Active: '#22c55e', active: '#22c55e',
    Scheduled: '#3b82f6', scheduled: '#3b82f6',
    pending: '#eab308', Draft: '#eab308',
    Delayed: '#ef4444', delayed: '#ef4444',
    Completed: '#8b5cf6', completed: '#8b5cf6',
    paused: '#94a3b8', Review: '#06b6d4', Cancelled: '#64748b',
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function ConfBar({ value, color }: { value: number; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, background: '#1e293b', borderRadius: 3, height: 5 }}>
                <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 3 }} />
            </div>
            <span style={{ color, fontWeight: 700, fontSize: 11, minWidth: 28 }}>{Math.round(value)}</span>
        </div>
    );
}

function RiskBadge({ risk, label }: { risk: string; label: string }) {
    const c = RISK_COLORS[risk] || '#6b7280';
    return (
        <span style={{ background: `${c}22`, color: c, border: `1px solid ${c}44`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const }}>
            {label}
        </span>
    );
}

// Fly-to helper
function FlyToMission({ mission }: { mission: Mission | null }) {
    const map = useMap();
    useEffect(() => {
        if (mission) map.flyTo([mission.latitude, mission.longitude], 14, { duration: 0.8 });
    }, [mission, map]);
    return null;
}

// ── Mission Detail Sidebar (Phase 6) ─────────────────────────────────────────
function MissionSidebar({ mission, onClose, onActionDone }: {
    mission: Mission;
    onClose: () => void;
    onActionDone: () => void;
}) {
    const [overrideMode, setOverrideMode] = useState(false);
    const [overrideForm, setOverrideForm] = useState({ start_date: '', end_date: '', pilot_id: '', reason: '' });
    const [msg, setMsg] = useState<string | null>(null);
    const [working, setWorking] = useState(false);

    const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

    const approve = async () => {
        setWorking(true);
        try {
            const r = await fetch(`/api/orchestrator/${mission.id}/approve`, { method: 'POST', credentials: 'include' });
            const d = await r.json();
            showMsg(d.success ? '✅ Plan approved' : `❌ ${d.message}`);
            if (d.success) onActionDone();
        } catch { showMsg('❌ Request failed'); }
        setWorking(false);
    };

    const submitOverride = async () => {
        if (!overrideForm.reason) { showMsg('❌ Reason required'); return; }
        setWorking(true);
        try {
            const r = await fetch(`/api/orchestrator/${mission.id}/override`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(overrideForm),
            });
            const d = await r.json();
            showMsg(d.success ? '✅ Override applied' : `❌ ${d.message}`);
            if (d.success) { setOverrideMode(false); onActionDone(); }
        } catch { showMsg('❌ Request failed'); }
        setWorking(false);
    };

    const W = mission.forecastWindow;
    const O = mission.orchestration;

    return (
        <div style={{
            position: 'absolute', top: 0, right: 0, height: '100%', width: 340,
            background: '#0f172a', borderLeft: '1px solid rgba(255,255,255,0.08)',
            overflowY: 'auto', zIndex: 500, boxSizing: 'border-box', padding: '20px',
            fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3 }}>{mission.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{mission.siteName}</div>
                    <div style={{ marginTop: 6 }}>
                        <RiskBadge risk={mission.weatherRisk.risk} label={mission.weatherRisk.label} />
                    </div>
                </div>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, color: '#94a3b8', fontSize: 18, cursor: 'pointer', padding: '4px 10px', lineHeight: 1 }}>×</button>
            </div>

            {msg && <div style={{ background: msg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>{msg}</div>}

            {/* ── Forecast Window */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Forecast Window</div>
                {W ? (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                            {fmt(W.startDate)} → {fmt(W.endDate)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{W.consecutiveDays} flyable days</div>
                        <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Weather Score</div>
                            <ConfBar value={W.weatherScore || 0} color="#3b82f6" />
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Forecast Confidence</div>
                            <ConfBar value={W.forecastConfidence || 0} color="#22c55e" />
                        </div>
                    </>
                ) : <div style={{ fontSize: 12, color: '#475569' }}>No forecast window — generate forecast first</div>}
            </div>

            {/* ── AI Orchestration */}
            {O && (
                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, padding: '14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                        AI Orchestration {O.manualOverride && <span style={{ color: '#f59e0b', marginLeft: 6 }}>⚠️ Manual Override</span>}
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: '#64748b' }}>Pilot: </span>
                        <span style={{ fontWeight: 600 }}>{O.recommendedPilotName || '—'}</span>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: '#64748b' }}>Window: </span>
                        <span>{fmt(O.recommendedStartDate)} → {fmt(O.recommendedEndDate)}</span>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: '#64748b' }}>Est. completion: </span>
                        <span style={{ fontWeight: 600 }}>{O.predictedCompletionDays ? `${O.predictedCompletionDays} days` : '—'}</span>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>AI Confidence</div>
                        <ConfBar value={O.aiConfidence || 0} color="#818cf8" />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Priority Score</div>
                        <ConfBar value={O.priorityScore || 0} color={O.priorityScore && O.priorityScore >= 70 ? '#22c55e' : '#f59e0b'} />
                    </div>
                </div>
            )}

            {/* ── Assigned Pilots */}
            {mission.assignedPilots.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Assigned Pilots</div>
                    {mission.assignedPilots.map((p, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#f1f5f9', marginBottom: 4 }}>👤 {p.name}</div>
                    ))}
                    {mission.pilotReliability != null && (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>Best Pilot Reliability</div>
                            <ConfBar value={mission.pilotReliability} color="#22c55e" />
                        </div>
                    )}
                </div>
            )}

            {/* ── Admin Actions (Phase 12) */}
            {!overrideMode ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {O?.status === 'suggested' && !O?.manualOverride && (
                        <button onClick={approve} disabled={working} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, color: '#22c55e', fontSize: 12, fontWeight: 700, padding: '9px 14px', cursor: 'pointer' }}>
                            ✅ Approve Schedule
                        </button>
                    )}
                    <button onClick={() => setOverrideMode(true)} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, color: '#f59e0b', fontSize: 12, fontWeight: 700, padding: '9px 14px', cursor: 'pointer' }}>
                        ✏️ Override Plan
                    </button>
                    <button onClick={async () => {
                        setWorking(true);
                        try {
                            await fetch(`/api/orchestrator/run/${mission.id}`, { method: 'POST', credentials: 'include' });
                            showMsg('✅ AI re-run complete'); onActionDone();
                        } catch { showMsg('❌ Re-run failed'); }
                        setWorking(false);
                    }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, color: '#818cf8', fontSize: 12, fontWeight: 700, padding: '9px 14px', cursor: 'pointer' }}>
                        🤖 Re-run AI
                    </button>
                </div>
            ) : (
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}>✏️ Override Mission Plan</div>
                    {[
                        { label: 'Start Date', key: 'start_date', type: 'date' },
                        { label: 'End Date', key: 'end_date', type: 'date' },
                        { label: 'Pilot ID (optional)', key: 'pilot_id', type: 'text' },
                    ].map(({ label, key, type }) => (
                        <div key={key} style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
                            <input type={type} value={(overrideForm as Record<string, string>)[key]}
                                onChange={e => setOverrideForm(f => ({ ...f, [key]: e.target.value }))}
                                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#f1f5f9', fontSize: 12, padding: '7px 10px', outline: 'none', boxSizing: 'border-box' as const }} />
                        </div>
                    ))}
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reason *</label>
                        <textarea rows={2} value={overrideForm.reason} onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
                            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#f1f5f9', fontSize: 12, padding: '7px 10px', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setOverrideMode(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: 12, fontWeight: 600, padding: '8px', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={submitOverride} disabled={!overrideForm.reason || working} style={{ flex: 1, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, color: '#f59e0b', fontSize: 12, fontWeight: 700, padding: '8px', cursor: 'pointer' }}>Apply</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main AxisMissionGrid Component ────────────────────────────────────────────
export const AxisMissionGrid: React.FC = () => {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Mission | null>(null);

    // Phase 9: Filters
    const [filterStatus, setFilterStatus] = useState('');
    const [filterRisk, setFilterRisk] = useState('');
    const [filterIndustry, setFilterIndustry] = useState('');
    const [search, setSearch] = useState('');
    const [activeView, setActiveView] = useState<'map' | 'table'>('map');

    const fetchMissions = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/mission-grid', { credentials: 'include' });
            const data = await r.json();
            setMissions(data.missions || []);
        } catch { setMissions([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchMissions(); }, [fetchMissions]);

    // Phase 7: Socket.IO real-time updates
    useEffect(() => {
        try {
            const { io } = require('socket.io-client');
            const socket = io({ auth: { withCredentials: true } });
            const refresh = () => fetchMissions();
            socket.on('mission_status_update', refresh);
            socket.on('forecast_update', refresh);
            socket.on('upload_complete', refresh);
            socket.on('pilot_report_submitted', refresh);
            return () => socket.disconnect();
        } catch { /* Socket.IO optional */ }
    }, [fetchMissions]);

    // Phase 9: Filtered + searched missions
    const filtered = useMemo(() => {
        let m = missions;
        if (filterStatus) m = m.filter(x => (x.missionStatus || x.status) === filterStatus);
        if (filterRisk) m = m.filter(x => x.weatherRisk.risk === filterRisk);
        if (filterIndustry) m = m.filter(x => x.industryKey === filterIndustry);
        if (search) {
            const q = search.toLowerCase();
            m = m.filter(x =>
                x.title.toLowerCase().includes(q) ||
                x.siteName?.toLowerCase().includes(q) ||
                x.id.toLowerCase().includes(q)
            );
        }
        return m;
    }, [missions, filterStatus, filterRisk, filterIndustry, search]);

    // Unique industries for filter
    const industries = useMemo(() => [...new Set(missions.map(m => m.industryKey).filter(Boolean))], [missions]);
    const statuses = useMemo(() => [...new Set(missions.map(m => m.missionStatus || m.status).filter(Boolean))], [missions]);

    const center = filtered.length > 0
        ? [filtered[0].latitude, filtered[0].longitude] as [number, number]
        : [37.0902, -95.7129] as [number, number]; // US default

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>🗺 Global Mission Grid</h3>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b' }}>
                        {loading ? 'Loading...' : `${filtered.length} of ${missions.length} missions · Admin-only view`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['map', 'table'] as const).map(v => (
                        <button key={v} onClick={() => setActiveView(v)} style={{
                            background: activeView === v ? 'rgba(99,102,241,0.15)' : 'transparent',
                            border: `1px solid ${activeView === v ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: 7, color: activeView === v ? '#818cf8' : '#64748b',
                            fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer',
                        }}>
                            {v === 'map' ? '🗺 Map' : '📋 Table'}
                        </button>
                    ))}
                    <button onClick={fetchMissions} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#94a3b8', fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer' }}>
                        🔄
                    </button>
                </div>
            </div>

            {/* ── Phase 9: Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mission, site..."
                    style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 12, padding: '7px 12px', outline: 'none', width: 200 }} />
                {[
                    { label: 'All Statuses', value: filterStatus, set: setFilterStatus, opts: statuses },
                    { label: 'All Risk', value: filterRisk, set: setFilterRisk, opts: ['LOW', 'MEDIUM', 'HIGH'] },
                    { label: 'All Industries', value: filterIndustry, set: setFilterIndustry, opts: industries as string[] },
                ].map(({ label, value, set, opts }) => (
                    <select key={label} value={value} onChange={e => set(e.target.value)} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', fontSize: 12, padding: '7px 12px', outline: 'none' }}>
                        <option value="">{label}</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ))}
            </div>

            {/* ── Phase 10: Legend */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries({ 'Active': '#22c55e', 'Scheduled': '#3b82f6', 'Pending': '#eab308', 'Delayed': '#ef4444', 'Completed': '#8b5cf6' }).map(([label, color]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        {label}
                    </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', opacity: 0.4, flexShrink: 0, border: '2px solid #ef4444' }} />
                    High Risk
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>🗺</div>
                    Loading mission data...
                </div>
            ) : (
                <>
                    {/* ── Map View */}
                    {activeView === 'map' && (
                        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <MapContainer
                                center={center}
                                zoom={5}
                                style={{ height: 520, width: '100%' }}
                                zoomControl={false}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                />
                                <ZoomControl position="bottomright" />
                                {selected && <FlyToMission mission={selected} />}

                                {/* Phase 10: Priority heatmap effect — larger radius = higher priority */}
                                {filtered.map(m => {
                                    const priorityScore = m.orchestration?.priorityScore || 0;
                                    const baseRadius = 8 + (priorityScore / 100) * 14; // 8-22px based on priority
                                    const isHighPriority = priorityScore >= 70;
                                    const isSelected = selected?.id === m.id;

                                    return (
                                        <React.Fragment key={m.id}>
                                            {/* Phase 10: Priority heatmap glow for high priority missions */}
                                            {isHighPriority && (
                                                <CircleMarker
                                                    center={[m.latitude, m.longitude]}
                                                    radius={baseRadius + 8}
                                                    pathOptions={{ color: m.markerColor, fillColor: m.markerColor, fillOpacity: 0.08, weight: 0 }}
                                                />
                                            )}
                                            {/* Weather risk outer ring */}
                                            {m.weatherRisk.risk === 'HIGH' && (
                                                <CircleMarker
                                                    center={[m.latitude, m.longitude]}
                                                    radius={baseRadius + 4}
                                                    pathOptions={{ color: '#ef4444', fillColor: 'transparent', fillOpacity: 0, weight: 1.5, dashArray: '3,3' }}
                                                />
                                            )}
                                            {/* Main marker */}
                                            <CircleMarker
                                                center={[m.latitude, m.longitude]}
                                                radius={isSelected ? baseRadius + 3 : baseRadius}
                                                pathOptions={{
                                                    color: isSelected ? '#f1f5f9' : m.markerColor,
                                                    fillColor: m.markerColor,
                                                    fillOpacity: 0.85,
                                                    weight: isSelected ? 2.5 : 1.5,
                                                }}
                                                eventHandlers={{ click: () => setSelected(s => s?.id === m.id ? null : m) }}
                                            >
                                                <Tooltip direction="top" offset={[0, -baseRadius]} permanent={false}>
                                                    <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f1f5f9', minWidth: 160, fontFamily: "'Inter', system-ui, sans-serif" }}>
                                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.title}</div>
                                                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{m.siteName}</div>
                                                        <div style={{ fontSize: 11 }}>
                                                            <span style={{ color: m.weatherRisk.color, fontWeight: 600 }}>⚠ {m.weatherRisk.label}</span>
                                                            {m.orchestration?.priorityScore != null && (
                                                                <span style={{ color: '#818cf8', marginLeft: 8 }}>P: {m.orchestration.priorityScore}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Tooltip>
                                            </CircleMarker>
                                        </React.Fragment>
                                    );
                                })}
                            </MapContainer>

                            {/* Phase 6: Sidebar */}
                            {selected && (
                                <MissionSidebar
                                    mission={selected}
                                    onClose={() => setSelected(null)}
                                    onActionDone={() => { fetchMissions(); }}
                                />
                            )}
                        </div>
                    )}

                    {/* ── Table View */}
                    {activeView === 'table' && (
                        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        {['Mission', 'Site', 'Status', 'Weather Risk', 'Priority', 'AI Confidence', 'Forecast Window', 'Pilot'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((m, i) => (
                                        <tr key={m.id}
                                            onClick={() => { setSelected(m); setActiveView('map'); }}
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', cursor: 'pointer' }}
                                        >
                                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#f1f5f9', maxWidth: 180 }}>
                                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#94a3b8', maxWidth: 140 }}>
                                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.siteName}</span>
                                            </td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{ background: `${STATUS_COLORS[m.status] || '#6b7280'}22`, color: STATUS_COLORS[m.status] || '#6b7280', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                                    {m.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px' }}>
                                                <RiskBadge risk={m.weatherRisk.risk} label={m.weatherRisk.risk} />
                                            </td>
                                            <td style={{ padding: '10px 14px', minWidth: 100 }}>
                                                {m.orchestration?.priorityScore != null
                                                    ? <ConfBar value={m.orchestration.priorityScore} color="#f59e0b" />
                                                    : <span style={{ color: '#475569' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 14px', minWidth: 100 }}>
                                                {m.orchestration?.aiConfidence != null
                                                    ? <ConfBar value={m.orchestration.aiConfidence} color="#818cf8" />
                                                    : <span style={{ color: '#475569' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                {m.forecastWindow ? `${fmt(m.forecastWindow.startDate)}` : '—'}
                                            </td>
                                            <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                                                {m.assignedPilots?.[0]?.name || m.orchestration?.recommendedPilotName || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filtered.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No missions match filters</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AxisMissionGrid;
