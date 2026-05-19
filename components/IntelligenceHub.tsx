/**
 * IntelligenceHub.tsx — Unified AI Intelligence Center
 * Replaces separate "Intelligence Hub" + "Enterprise Reports" nav items
 * with one cohesive tabbed experience.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    BrainCircuit, FileText, FolderOpen, SlidersHorizontal,
    RefreshCw, Activity, Cpu, Zap, CheckCircle, AlertTriangle,
    Settings, ChevronRight, Sparkles, ArrowLeft, Map, Upload,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import IndustryReportsHub from '../modules/ai-reporting/IndustryReportsHub';
import AIReportArchive from '../modules/ai-reporting/components/AIReportArchive';

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'analyst' | 'reports' | 'archive' | 'sensitivity';

interface HealthData {
    keySet: boolean;
    geminiOk: boolean;
    model: string;
    analyzedToday: number;
    pendingCount: number;
}

interface RecentJob {
    id: string;
    site_name?: string;
    mission_title?: string;
    created_at: string;
    ai_result: any;
    status: string;
    file_count: number;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const StatusDot: React.FC<{ ok: boolean }> = ({ ok }) => (
    <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: ok ? '#4ade80' : '#f87171',
        boxShadow: ok ? '0 0 8px #4ade80' : '0 0 8px #f87171',
        flexShrink: 0,
    }} />
);

const Badge: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        color: ok ? '#4ade80' : '#f87171',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
    }}>
        <StatusDot ok={ok} />
        {label}
    </span>
);

const KPI: React.FC<{ label: string; value: string | number; color: string; sub?: string }> = ({ label, value, color, sub }) => (
    <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden',
    }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>{sub}</div>}
    </div>
);

const conditionColor = (c?: string) => {
    if (!c) return '#64748b';
    const l = c.toLowerCase();
    if (l.includes('crit')) return '#ef4444';
    if (l.includes('poor')) return '#f59e0b';
    if (l.includes('fair')) return '#60a5fa';
    return '#4ade80';
};

// ── AI Analyst Panel ──────────────────────────────────────────────────────────
const AnalystPanel: React.FC = () => {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [jobs, setJobs] = useState<RecentJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [h, j] = await Promise.all([
                apiClient.get('/ai/health').catch(() => ({ data: { data: null } })),
                apiClient.get('/pilot/upload-jobs/admin/all').catch(() => ({ data: { data: [] } })),
            ]);
            if (h.data?.data) setHealth(h.data.data);
            setJobs((j.data?.data || []).slice(0, 10));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleReanalyze = async (id: string) => {
        setReanalyzingId(id);
        setMsg(null);
        try {
            await apiClient.post(`/ai/reanalyze/${id}`);
            setMsg(`✓ Job ${id.slice(0, 8)} re-queued`);
            fetchData();
        } catch (e: any) {
            setMsg(`✗ ${e.response?.data?.message || 'Re-analysis failed'}`);
        } finally {
            setReanalyzingId(null);
            setTimeout(() => setMsg(null), 4000);
        }
    };

    return (
        <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: -0.5 }}>AI Analyst</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Gemini AI pipeline status, recent job analysis, and reprocessing controls</p>
                </div>
                <button
                    onClick={fetchData}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: 10, color: '#818cf8', fontSize: 12, fontWeight: 700,
                        padding: '9px 16px', cursor: 'pointer',
                    }}
                >
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Gemini Status Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16,
                padding: '18px 24px', marginBottom: 24,
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 8, padding: 7 }}>
                        <Cpu size={16} color="#fff" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#c4b5fd' }}>
                        {health?.model || 'gemini-2.0-flash'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Badge ok={!!health?.keySet} label={health?.keySet ? 'API Key Active' : 'No API Key'} />
                    <Badge ok={!!health?.geminiOk} label={health?.geminiOk ? 'Gemini Online' : 'Gemini Offline'} />
                </div>
                {health?.geminiOk && (
                    <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4ade80', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CheckCircle size={13} /> All systems operational
                    </div>
                )}
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
                <KPI label="Analyzed Today" value={health?.analyzedToday ?? '—'} color="#4ade80" />
                <KPI label="Pending Analysis" value={health?.pendingCount ?? '—'} color="#f59e0b" sub="Jobs in queue" />
                <KPI label="Recent Jobs" value={jobs.length} color="#818cf8" sub="Last 10 shown" />
            </div>

            {/* Job Feed */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Activity size={15} color="#6366f1" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Upload Job Feed</span>
                    </div>
                    {msg && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: msg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{msg}</span>
                    )}
                </div>

                {loading ? (
                    <div style={{ padding: '48px 0', textAlign: 'center', color: '#475569', fontSize: 13 }}>
                        <RefreshCw size={20} style={{ marginBottom: 10, opacity: 0.4, animation: 'spin 1s linear infinite' }} />
                        <div>Loading AI activity…</div>
                    </div>
                ) : jobs.length === 0 ? (
                    <div style={{ padding: '48px 0', textAlign: 'center', color: '#475569' }}>
                        <Zap size={28} style={{ marginBottom: 10, opacity: 0.3 }} />
                        <div style={{ fontSize: 13 }}>No upload jobs yet. Pilots submit files to trigger AI analysis.</div>
                    </div>
                ) : (
                    <div>
                        {jobs.map((job, i) => {
                            const aiResult = typeof job.ai_result === 'string' ? JSON.parse(job.ai_result || '{}') : (job.ai_result || {});
                            const condition = aiResult?.overallCondition;
                            const confidence = aiResult?.confidence;
                            const analyzed = !!job.ai_result;
                            return (
                                <div key={job.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '14px 22px',
                                    borderBottom: i < jobs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    transition: 'background 0.15s',
                                }}>
                                    <StatusDot ok={analyzed} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {job.site_name ? `${job.site_name} — ` : ''}{job.mission_title || `Job ${job.id.slice(0, 12)}`}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>{job.file_count ?? 0} files</span>
                                            <span style={{ color: '#334155' }}>·</span>
                                            <span>{new Date(job.created_at).toLocaleDateString()}</span>
                                            {condition && <><span style={{ color: '#334155' }}>·</span><span style={{ color: conditionColor(condition), fontWeight: 700 }}>{condition}</span></>}
                                            {confidence && <><span style={{ color: '#334155' }}>·</span><span>{confidence}% conf.</span></>}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6,
                                        padding: '3px 10px', borderRadius: 20,
                                        background: analyzed ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                        color: analyzed ? '#4ade80' : '#f59e0b',
                                        border: `1px solid ${analyzed ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                    }}>
                                        {analyzed ? 'Analyzed' : 'Pending'}
                                    </span>
                                    <button
                                        onClick={() => handleReanalyze(job.id)}
                                        disabled={reanalyzingId === job.id}
                                        style={{
                                            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                                            borderRadius: 8, color: '#818cf8', fontSize: 11, fontWeight: 700,
                                            padding: '6px 12px', cursor: 'pointer',
                                            opacity: reanalyzingId === job.id ? 0.5 : 1,
                                        }}
                                    >
                                        {reanalyzingId === job.id ? '…' : '↺ Re-run'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Sensitivity Panel ─────────────────────────────────────────────────────────
const SensitivityPanel: React.FC = () => {
    const [sensitivity, setSensitivity] = useState(() => {
        const s = localStorage.getItem('skylens_ai_sensitivity_default');
        return s ? parseInt(s, 10) : 50;
    });
    const [saved, setSaved] = useState(false);

    const handleChange = (v: number) => {
        setSensitivity(v);
        localStorage.setItem('skylens_ai_sensitivity_default', v.toString());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const label = sensitivity < 30 ? 'Aggressive — catches everything, more false positives'
        : sensitivity < 60 ? 'Balanced — recommended default setting'
        : sensitivity < 80 ? 'Conservative — high-confidence detections only'
        : 'Strict — critical findings only';

    const color = sensitivity < 30 ? '#ef4444' : sensitivity < 60 ? '#22c55e' : sensitivity < 80 ? '#f59e0b' : '#6366f1';

    return (
        <div style={{ padding: '32px 40px', maxWidth: 720 }}>
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9', letterSpacing: -0.5 }}>AI Sensitivity Config</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Control how aggressively Gemini Vision flags potential defects across all report types</p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '32px 36px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SlidersHorizontal size={18} color={color} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>Detection Threshold</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {saved && <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>✓ Saved</span>}
                        <span style={{ fontSize: 32, fontWeight: 900, color, letterSpacing: -1 }}>{sensitivity}%</span>
                    </div>
                </div>

                <div style={{ position: 'relative', marginBottom: 16 }}>
                    <input
                        type="range" min={10} max={100} step={5} value={sensitivity}
                        onChange={e => handleChange(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 6 }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 24 }}>
                    <span>Low (more detections)</span>
                    <span>High (fewer false positives)</span>
                </div>

                <div style={{
                    background: `${color}0f`, border: `1px solid ${color}25`,
                    borderRadius: 10, padding: '12px 16px',
                    fontSize: 13, color, fontWeight: 600,
                }}>
                    {label}
                </div>
            </div>

            {/* Preset buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                    { label: 'Aggressive', value: 20, color: '#ef4444', desc: 'Max detection' },
                    { label: 'Balanced', value: 50, color: '#22c55e', desc: 'Recommended' },
                    { label: 'Conservative', value: 80, color: '#6366f1', desc: 'Precision mode' },
                ].map(p => (
                    <button
                        key={p.value}
                        onClick={() => handleChange(p.value)}
                        style={{
                            background: sensitivity === p.value ? `${p.color}12` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${sensitivity === p.value ? p.color + '40' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ fontSize: 13, fontWeight: 800, color: sensitivity === p.value ? p.color : '#94a3b8', marginBottom: 3 }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{p.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ── Nav item definition ────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: React.ElementType; color: string; desc: string }[] = [
    { key: 'analyst',     label: 'AI Analyst',        icon: BrainCircuit,      color: '#818cf8', desc: 'Gemini status & job feed' },
    { key: 'reports',     label: 'Report Generator',  icon: Sparkles,          color: '#f59e0b', desc: 'Industry AI reports' },
    { key: 'archive',     label: 'Report Archive',    icon: FolderOpen,        color: '#60a5fa', desc: 'All saved reports' },
    { key: 'sensitivity', label: 'AI Settings',       icon: SlidersHorizontal, color: '#34d399', desc: 'Detection config' },
];

// ── Main IntelligenceHub ───────────────────────────────────────────────────────
const IntelligenceHub: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('analyst');

    const active = TABS.find(t => t.key === activeTab)!;

    const renderPanel = () => {
        switch (activeTab) {
            case 'analyst':     return <AnalystPanel />;
            case 'reports':     return <IndustryReportsHub />;
            case 'archive':     return <div style={{ height: '100%', overflow: 'auto' }}><AIReportArchive /></div>;
            case 'sensitivity': return <SensitivityPanel />;
        }
    };

    return (
        <div style={{
            display: 'flex', height: '100%', background: '#060d1a',
            fontFamily: "'Inter','SF Pro',system-ui,sans-serif", color: '#e2e8f0',
            overflow: 'hidden',
        }}>
            {/* ── Left Sidebar Nav ── */}
            <div style={{
                width: 230, flexShrink: 0, background: '#080f1e',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column', padding: '28px 14px',
            }}>
                {/* Hub title */}
                <div style={{ padding: '0 6px', marginBottom: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 9, padding: 7 }}>
                            <BrainCircuit size={16} color="#fff" />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#f1f5f9', letterSpacing: -0.3 }}>Intelligence</span>
                    </div>
                    <p style={{ margin: '0 0 0 36px', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                        Axis AI Platform
                    </p>
                </div>

                {/* Tab buttons */}
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {TABS.map(tab => {
                        const isActive = tab.key === activeTab;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 11,
                                    padding: '11px 14px', borderRadius: 11, cursor: 'pointer',
                                    background: isActive ? `${tab.color}0e` : 'transparent',
                                    border: `1px solid ${isActive ? tab.color + '30' : 'transparent'}`,
                                    borderLeft: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                                    color: isActive ? tab.color : '#64748b',
                                    transition: 'all 0.18s', textAlign: 'left',
                                }}
                            >
                                <Icon size={15} style={{ flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, lineHeight: 1.2 }}>{tab.label}</div>
                                    <div style={{ fontSize: 10, color: isActive ? tab.color + 'aa' : '#334155', marginTop: 1 }}>{tab.desc}</div>
                                </div>
                            </button>
                        );
                    })}
                </nav>

                {/* Divider */}
                <div style={{ margin: '20px 6px', height: 1, background: 'rgba(255,255,255,0.05)' }} />

                {/* Quick links */}
                <div style={{ padding: '0 6px' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Quick Access</div>
                    {[
                        { label: 'Spatial Map View', icon: Map, tab: null },
                    ].map(link => (
                        <div key={link.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 8, color: '#475569', fontSize: 12 }}>
                            <link.icon size={13} />
                            {link.label}
                        </div>
                    ))}
                </div>

                {/* Bottom status */}
                <div style={{ marginTop: 'auto', padding: '14px 6px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                        <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>Gemini Active</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>gemini-2.0-flash</div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                {/* Top breadcrumb bar */}
                <div style={{
                    position: 'sticky', top: 0, zIndex: 10,
                    background: 'rgba(8,15,30,0.9)', backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    padding: '14px 40px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Intelligence</span>
                    <ChevronRight size={12} color="#334155" />
                    <span style={{ fontSize: 12, color: active.color, fontWeight: 700 }}>{active.label}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        {TABS.map(tab => {
                            const isActive = tab.key === activeTab;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    title={tab.label}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                        background: isActive ? `${tab.color}15` : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${isActive ? tab.color + '35' : 'rgba(255,255,255,0.06)'}`,
                                        color: isActive ? tab.color : '#475569',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <Icon size={13} /> {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Panel content */}
                <div style={{ minHeight: 'calc(100vh - 60px)' }}>
                    {renderPanel()}
                </div>
            </div>
        </div>
    );
};

export default IntelligenceHub;
