/**
 * SystemAIView.tsx — AI Intelligence Command Center
 * Live Gemini health status, activity feed, reanalysis tools, sensitivity config.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    BrainCircuit, Zap, Activity, RefreshCw, CheckCircle, AlertTriangle,
    Clock, BarChart2, Settings, ChevronRight, Cpu
} from 'lucide-react';
import apiClient from '../services/apiClient';

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

const Badge: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        background: ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        color: ok ? '#4ade80' : '#f87171',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
    }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#4ade80' : '#f87171', boxShadow: ok ? '0 0 6px #4ade80' : 'none' }} />
        {label}
    </span>
);

const KPICard: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({ label, value, sub, color = '#818cf8' }) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 22px' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{sub}</div>}
    </div>
);

const SystemAIView: React.FC = () => {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
    const [sensitivity, setSensitivity] = useState<number>(() => {
        const s = localStorage.getItem('skylens_ai_sensitivity_default');
        return s ? parseInt(s, 10) : 50;
    });
    const [reanalyzeMsg, setReanalyzeMsg] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [healthRes, jobsRes] = await Promise.all([
                apiClient.get('/ai/health').catch(() => ({ data: { data: null } })),
                apiClient.get('/pilot/upload-jobs/admin/all').catch(() => ({ data: { data: [] } })),
            ]);
            if (healthRes.data?.data) setHealth(healthRes.data.data);
            setRecentJobs((jobsRes.data?.data || []).slice(0, 8));
        } catch (err) {
            console.error('[SystemAIView] fetch error', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleReanalyze = async (jobId: string) => {
        setReanalyzingId(jobId);
        setReanalyzeMsg(null);
        try {
            await apiClient.post(`/ai/reanalyze/${jobId}`);
            setReanalyzeMsg(`✓ Job ${jobId.slice(0, 8)} re-analyzed`);
            fetchData();
        } catch (err: any) {
            setReanalyzeMsg(`✗ ${err.response?.data?.message || 'Re-analysis failed'}`);
        } finally {
            setReanalyzingId(null);
            setTimeout(() => setReanalyzeMsg(null), 4000);
        }
    };

    const onSensitivityChange = (v: number) => {
        setSensitivity(v);
        localStorage.setItem('skylens_ai_sensitivity_default', v.toString());
    };

    const conditionColor = (c?: string) => {
        if (!c) return '#64748b';
        if (c.toLowerCase().includes('crit')) return '#ef4444';
        if (c.toLowerCase().includes('poor')) return '#f59e0b';
        if (c.toLowerCase().includes('fair')) return '#60a5fa';
        return '#4ade80';
    };

    return (
        <div style={{ fontFamily: "'Inter','SF Pro',system-ui,sans-serif", color: '#e2e8f0', maxWidth: 1100 }}>

            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 10, padding: 8 }}>
                        <BrainCircuit size={18} color="#fff" />
                    </div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.5 }}>
                        AI Intelligence Studio
                    </h2>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    Gemini AI status · upload analysis · reprocessing controls
                </p>
            </div>

            {/* Gemini Status Banner */}
            <div style={{
                background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))',
                border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, padding: '20px 24px',
                marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Cpu size={18} color="#818cf8" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd' }}>
                        {health?.model || 'gemini-2.0-flash'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Badge ok={!!health?.keySet} label={health?.keySet ? 'API Key Set' : 'No API Key'} />
                    <Badge ok={!!health?.geminiOk} label={health?.geminiOk ? 'Gemini Online' : 'Gemini Offline'} />
                </div>
                <button onClick={fetchData} style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 8, color: '#818cf8', fontSize: 11, fontWeight: 700,
                    padding: '7px 14px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
                <KPICard label="Analyzed Today" value={health?.analyzedToday ?? '—'} color="#4ade80" />
                <KPICard label="Pending Analysis" value={health?.pendingCount ?? '—'} color="#f59e0b" />
                <KPICard label="Recent Jobs" value={recentJobs.length} color="#818cf8" />
                <KPICard label="AI Confidence" value={`${sensitivity}%`} sub="Default threshold" color="#06b6d4" />
            </div>

            {/* AI Sensitivity Control */}
            <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: '18px 22px', marginBottom: 24,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Settings size={14} color="#64748b" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        AI Fault Detection Sensitivity
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#818cf8' }}>{sensitivity}%</span>
                </div>
                <input
                    type="range" min={10} max={100} step={5} value={sensitivity}
                    onChange={e => onSensitivityChange(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer', height: 4 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 4 }}>
                    <span>Low (more detections)</span><span>High (fewer false positives)</span>
                </div>
            </div>

            {/* Recent Jobs + Re-analyze */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Activity size={14} color="#64748b" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Recent Upload Jobs
                    </span>
                    {reanalyzeMsg && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: reanalyzeMsg.startsWith('✓') ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                            {reanalyzeMsg}
                        </span>
                    )}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading AI activity…</div>
                ) : recentJobs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                        <Zap size={28} color="#334155" style={{ marginBottom: 8 }} />
                        <p style={{ margin: 0, fontSize: 13 }}>No upload jobs yet. Pilots submit files to trigger AI analysis.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {recentJobs.map(job => {
                            const aiResult = typeof job.ai_result === 'string' ? JSON.parse(job.ai_result) : job.ai_result;
                            const condition = aiResult?.overallCondition;
                            const confidence = aiResult?.confidence;
                            const analyzed = !!aiResult;

                            return (
                                <div key={job.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 10, padding: '11px 16px',
                                }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                        background: analyzed ? '#4ade80' : '#f59e0b',
                                        boxShadow: analyzed ? '0 0 6px #4ade80' : '0 0 6px #f59e0b',
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {job.site_name ? `${job.site_name} — ` : ''}{job.mission_title || job.id.slice(0, 12)}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                            {job.file_count ?? 0} files · {new Date(job.created_at).toLocaleDateString()}
                                            {analyzed && condition && (
                                                <span style={{ marginLeft: 8, color: conditionColor(condition), fontWeight: 700 }}>
                                                    · {condition}
                                                </span>
                                            )}
                                            {confidence && <span style={{ color: '#64748b' }}> · {confidence}% conf.</span>}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                                        color: analyzed ? '#4ade80' : '#f59e0b',
                                    }}>
                                        {analyzed ? 'Analyzed' : 'Pending'}
                                    </span>
                                    <button
                                        onClick={() => handleReanalyze(job.id)}
                                        disabled={reanalyzingId === job.id}
                                        style={{
                                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                                            borderRadius: 7, color: '#818cf8', fontSize: 10, fontWeight: 700,
                                            padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
                                            opacity: reanalyzingId === job.id ? 0.5 : 1,
                                        }}>
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

export default SystemAIView;
