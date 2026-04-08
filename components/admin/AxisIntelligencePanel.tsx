import React, { useState, useEffect } from 'react';
import {
    Brain,
    AlertTriangle,
    Shield,
    TrendingUp,
    Users,
    Calendar,
    DollarSign,
    Cloud,
    ChevronDown,
    ChevronUp,
    Play,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Loader2,
    Info
} from 'lucide-react';
import apiClient from '../../src/services/apiClient';

// ─────────────────────────────────────────────────────────┐
// Types
// ─────────────────────────────────────────────────────────┘
interface IntelResult {
    riskScore: number;
    priorityLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    recommendedPilotCount: number;
    weatherConcern: string;
    estimatedCompletionDays: number;
    financialExposure: number;
    safetyFlags: string[];
    blockPriorityStrategy: {
        approach?: string;
        sequence?: { block: string; priority: string; rationale: string }[];
        estimatedEfficiency?: string;
    };
}

interface IntelRecord {
    id: string;
    mission_id: string;
    risk_score: number;
    priority_level: string;
    recommended_pilot_count: number;
    weather_concern: string;
    estimated_completion_days: number;
    financial_exposure: number;
    safety_flags: string[];
    block_priority_strategy: object;
    created_at: string;
    updated_at: string;
}

interface SimulationRecord {
    id: string;
    overrides: object;
    results: IntelResult;
    created_at: string;
}

interface Props {
    missionId: string;
    missionTitle?: string;
}

// ─────────────────────────────────────────────────────────┐
// Color helpers
// ─────────────────────────────────────────────────────────┘
const getRiskColor = (score: number) => {
    if (score >= 75) return '#ef4444';  // red
    if (score >= 50) return '#f97316';  // orange
    if (score >= 25) return '#eab308';  // yellow
    return '#22c55e';                   // green
};

const getPriorityColors = (level: string) => {
    switch (level?.toLowerCase()) {
        case 'critical': return 'bg-red-900/60 text-red-300 border border-red-700';
        case 'high': return 'bg-orange-900/60 text-orange-300 border border-orange-700';
        case 'medium': return 'bg-yellow-900/60 text-yellow-300 border border-yellow-700';
        default: return 'bg-emerald-900/60 text-emerald-300 border border-emerald-700';
    }
};

// ─────────────────────────────────────────────────────────┐
// Risk Score Gauge (SVG Arc)
// ─────────────────────────────────────────────────────────┘
const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
    const clamped = Math.max(0, Math.min(100, score));
    const radius = 54;
    const circumference = Math.PI * radius; // half circle
    const offset = circumference - (clamped / 100) * circumference;
    const color = getRiskColor(clamped);

    return (
        <div className="flex flex-col items-center">
            <svg width="140" height="80" viewBox="0 0 140 80">
                {/* Background arc */}
                <path
                    d="M 16 70 A 54 54 0 0 1 124 70"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="12"
                    strokeLinecap="round"
                />
                {/* Foreground arc */}
                <path
                    d="M 16 70 A 54 54 0 0 1 124 70"
                    fill="none"
                    stroke={color}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
                />
                {/* Score text */}
                <text x="70" y="66" textAnchor="middle" fill={color} fontSize="22" fontWeight="bold"
                    fontFamily="monospace">
                    {clamped}
                </text>
                <text x="70" y="78" textAnchor="middle" fill="#64748b" fontSize="9">
                    RISK SCORE
                </text>
            </svg>
        </div>
    );
};

// ─────────────────────────────────────────────────────────┐
// Main Component
// ─────────────────────────────────────────────────────────┘
const AxisIntelligencePanel: React.FC<Props> = ({ missionId, missionTitle }) => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [intel, setIntel] = useState<IntelRecord | null>(null);
    const [simulations, setSimulations] = useState<SimulationRecord[]>([]);
    const [simResult, setSimResult] = useState<IntelResult | null>(null);
    const [simRunning, setSimRunning] = useState(false);
    const [showSimPanel, setShowSimPanel] = useState(false);
    const [showBlockStrategy, setShowBlockStrategy] = useState(false);

    // Simulation sliders
    const [simPilotCount, setSimPilotCount] = useState(2);
    const [simWindSpeed, setSimWindSpeed] = useState(15);
    const [simDefectProb, setSimDefectProb] = useState(0.1);
    const [simStartDelay, setSimStartDelay] = useState(0);

    // ── Fetch existing intel on mount ──
    useEffect(() => {
        if (!missionId) return;
        fetchExistingIntel();
    }, [missionId]);

    const fetchExistingIntel = async () => {
        setFetching(true);
        try {
            const res = await apiClient.get(`/admin/missions/${missionId}/intelligence`);
            if (res.data.success) {
                setIntel(res.data.data.intel || null);
                setSimulations(res.data.data.simulations || []);
            }
        } catch (err: any) {
            // 404 is fine — just no intel yet
            if (err?.response?.status !== 404) {
                setError('Failed to load existing intelligence data.');
            }
        } finally {
            setFetching(false);
        }
    };

    // ── Generate new intel ──
    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.post(`/admin/missions/${missionId}/intelligence`);
            if (res.data.success) {
                setIntel(res.data.data.intel?.intel ? {
                    ...intel,
                    risk_score: res.data.data.intel.intel.riskScore,
                    priority_level: res.data.data.intel.intel.priorityLevel,
                    recommended_pilot_count: res.data.data.intel.intel.recommendedPilotCount,
                    weather_concern: res.data.data.intel.intel.weatherConcern,
                    estimated_completion_days: res.data.data.intel.intel.estimatedCompletionDays,
                    financial_exposure: res.data.data.intel.intel.financialExposure,
                    safety_flags: res.data.data.intel.intel.safetyFlags,
                    block_priority_strategy: res.data.data.intel.intel.blockPriorityStrategy,
                    updated_at: new Date().toISOString(),
                    mission_id: missionId,
                    id: intel?.id || '',
                    created_at: intel?.created_at || new Date().toISOString()
                } as IntelRecord : null);
                // Re-fetch to get the DB record
                await fetchExistingIntel();
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Intelligence generation failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Run simulation ──
    const handleSimulate = async () => {
        setSimRunning(true);
        setSimResult(null);
        setError(null);
        try {
            const res = await apiClient.post(`/admin/missions/${missionId}/intelligence/simulate`, {
                pilotCount: simPilotCount,
                windSpeed: simWindSpeed,
                defectProbability: simDefectProb,
                startDelayDays: simStartDelay
            });
            if (res.data.success && res.data.data?.intel?.intel) {
                setSimResult(res.data.data.intel.intel);
                setSimulations(prev => [
                    { id: Date.now().toString(), overrides: {}, results: res.data.data.intel.intel, created_at: new Date().toISOString() },
                    ...prev.slice(0, 4)
                ]);
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Simulation failed.');
        } finally {
            setSimRunning(false);
        }
    };

    // ─── Display helpers ───
    const displayIntel = simResult || (intel ? {
        riskScore: intel.risk_score,
        priorityLevel: intel.priority_level as any,
        recommendedPilotCount: intel.recommended_pilot_count,
        weatherConcern: intel.weather_concern,
        estimatedCompletionDays: intel.estimated_completion_days,
        financialExposure: intel.financial_exposure,
        safetyFlags: intel.safety_flags || [],
        blockPriorityStrategy: intel.block_priority_strategy as any
    } : null);

    const blockStrategy = displayIntel?.blockPriorityStrategy as any;

    return (
        <div className="p-5 space-y-5 text-slate-200 bg-slate-950 min-h-[400px]">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-900/50 rounded-lg border border-violet-700/50">
                        <Brain className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-100">Axis Intelligence</h3>
                        <p className="text-xs text-slate-500">AI decision-support · Read-only · Admin only</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md ${loading
                        ? 'bg-violet-900/40 text-violet-400 cursor-not-allowed'
                        : 'bg-violet-600 hover:bg-violet-500 text-white'
                        }`}
                >
                    {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                        : <><RefreshCw className="w-4 h-4" /> {intel ? 'Regenerate Report' : 'Generate Intelligence Report'}</>
                    }
                </button>
            </div>

            {/* ── Disclaimer ── */}
            <div className="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400">
                    <strong className="text-slate-300">Advisory Only</strong> — This module produces structured recommendations.
                    It does not assign pilots, modify missions, trigger billing, or execute any actions.
                    All decisions require human approval.
                </p>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="flex items-center gap-2 bg-red-950 border border-red-800 rounded-lg p-3 text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* ── Loading state ── */}
            {fetching && !intel && (
                <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-sm">Loading intelligence data…</span>
                </div>
            )}

            {/* ── No data yet ── */}
            {!fetching && !intel && !loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="p-4 bg-violet-900/20 rounded-full border border-violet-800/40">
                        <Brain className="w-8 h-8 text-violet-500" />
                    </div>
                    <p className="text-slate-400 text-sm">No intelligence report generated yet.</p>
                    <p className="text-slate-600 text-xs">Click "Generate Intelligence Report" to analyze this mission.</p>
                </div>
            )}

            {/* ── Intel Results ── */}
            {displayIntel && (
                <div className="space-y-4">
                    {simResult && (
                        <div className="flex items-center gap-2 bg-amber-950 border border-amber-700 rounded-lg p-2.5 text-xs text-amber-300 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Simulation results displayed below — original record is unchanged
                        </div>
                    )}

                    {/* Risk + Priority Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col items-center">
                            <RiskGauge score={displayIntel.riskScore} />
                        </div>
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col justify-between gap-3">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Priority Level</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getPriorityColors(displayIntel.priorityLevel)}`}>
                                    {displayIntel.priorityLevel}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Financial Exposure</p>
                                <p className="text-lg font-bold text-emerald-400">
                                    ${displayIntel.financialExposure?.toLocaleString() ?? '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Users className="w-3.5 h-3.5 text-blue-400" />
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Rec. Pilots</p>
                            </div>
                            <p className="text-xl font-bold text-slate-100">{displayIntel.recommendedPilotCount ?? '—'}</p>
                        </div>
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Est. Days</p>
                            </div>
                            <p className="text-xl font-bold text-slate-100">{displayIntel.estimatedCompletionDays ?? '—'}</p>
                        </div>
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Weather</p>
                            </div>
                            <p className="text-xs font-medium text-slate-300 leading-tight line-clamp-3">{displayIntel.weatherConcern || '—'}</p>
                        </div>
                    </div>

                    {/* Safety Flags */}
                    {displayIntel.safetyFlags?.length > 0 && (
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-4 h-4 text-amber-400" />
                                <p className="text-sm font-semibold text-slate-200">Safety Flags</p>
                                <span className="ml-auto text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700 px-2 py-0.5 rounded-full font-bold">
                                    {displayIntel.safetyFlags.length}
                                </span>
                            </div>
                            <ul className="space-y-1.5">
                                {displayIntel.safetyFlags.map((flag, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                        {flag}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Block Priority Strategy */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                        <button
                            onClick={() => setShowBlockStrategy(!showBlockStrategy)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-violet-400" />
                                <span className="text-sm font-semibold text-slate-200">Block Priority Strategy</span>
                                {blockStrategy?.estimatedEfficiency && (
                                    <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-700 px-2 py-0.5 rounded-full">
                                        {blockStrategy.estimatedEfficiency}
                                    </span>
                                )}
                            </div>
                            {showBlockStrategy ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>

                        {showBlockStrategy && blockStrategy && (
                            <div className="border-t border-slate-800 p-4 space-y-3">
                                {blockStrategy.approach && (
                                    <p className="text-xs text-slate-400 italic">"{blockStrategy.approach}"</p>
                                )}
                                {blockStrategy.sequence?.length > 0 && (
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-500 uppercase tracking-wider text-[10px]">
                                                <th className="text-left pb-2 pr-3">Block</th>
                                                <th className="text-left pb-2 pr-3">Priority</th>
                                                <th className="text-left pb-2">Rationale</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {blockStrategy.sequence.map((row: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="py-2 pr-3 text-slate-300 font-medium">{row.block}</td>
                                                    <td className="py-2 pr-3">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getPriorityColors(row.priority)}`}>
                                                            {row.priority}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-slate-400">{row.rationale}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    {intel && (
                        <p className="text-[10px] text-slate-600 text-right">
                            Last generated: {new Date(intel.updated_at).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            {/* ── Scenario Simulation (optional) ── */}
            {(intel || displayIntel) && (
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                    <button
                        onClick={() => setShowSimPanel(!showSimPanel)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Play className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-semibold text-slate-300">Scenario Simulation</span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                                Non-destructive
                            </span>
                        </div>
                        {showSimPanel ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>

                    {showSimPanel && (
                        <div className="border-t border-slate-800 p-4 space-y-4">
                            <p className="text-xs text-slate-500">
                                Adjust parameters below and run a hypothetical scenario. Results are saved separately and
                                <strong className="text-slate-400"> never overwrite</strong> the primary intelligence record.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">
                                        Pilot Count: <strong className="text-slate-200">{simPilotCount}</strong>
                                    </label>
                                    <input type="range" min={1} max={20} value={simPilotCount}
                                        onChange={e => setSimPilotCount(Number(e.target.value))}
                                        className="w-full accent-violet-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">
                                        Wind Speed: <strong className="text-slate-200">{simWindSpeed} km/h</strong>
                                    </label>
                                    <input type="range" min={0} max={120} value={simWindSpeed}
                                        onChange={e => setSimWindSpeed(Number(e.target.value))}
                                        className="w-full accent-cyan-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">
                                        Defect Probability: <strong className="text-slate-200">{(simDefectProb * 100).toFixed(0)}%</strong>
                                    </label>
                                    <input type="range" min={0} max={1} step={0.01} value={simDefectProb}
                                        onChange={e => setSimDefectProb(Number(e.target.value))}
                                        className="w-full accent-amber-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">
                                        Start Delay: <strong className="text-slate-200">{simStartDelay} day{simStartDelay !== 1 ? 's' : ''}</strong>
                                    </label>
                                    <input type="range" min={0} max={30} value={simStartDelay}
                                        onChange={e => setSimStartDelay(Number(e.target.value))}
                                        className="w-full accent-emerald-500" />
                                </div>
                            </div>

                            <button
                                onClick={handleSimulate}
                                disabled={simRunning}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${simRunning
                                    ? 'bg-cyan-900/40 text-cyan-400 cursor-not-allowed'
                                    : 'bg-cyan-700 hover:bg-cyan-600 text-white shadow-md'
                                    }`}
                            >
                                {simRunning
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Simulation…</>
                                    : <><Play className="w-4 h-4" /> Run Simulation</>
                                }
                            </button>

                            {simResult && (
                                <div className="bg-slate-950 rounded-lg border border-cyan-800/40 p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-cyan-400" />
                                        <p className="text-xs font-semibold text-cyan-300">Simulation Result</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className="text-slate-500">Risk Score</p>
                                            <p className="font-bold" style={{ color: getRiskColor(simResult.riskScore) }}>
                                                {simResult.riskScore}/100
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Priority</p>
                                            <p className="font-bold text-slate-200">{simResult.priorityLevel}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Est. Days</p>
                                            <p className="font-bold text-slate-200">{simResult.estimatedCompletionDays}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Sim history */}
                            {simulations.length > 0 && (
                                <div>
                                    <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Recent Simulations</p>
                                    <div className="space-y-1.5">
                                        {simulations.slice(0, 4).map((sim, i) => (
                                            <div key={sim.id || i} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2 text-xs">
                                                <span className="text-slate-500">
                                                    {new Date(sim.created_at).toLocaleTimeString()}
                                                </span>
                                                <span className="font-medium" style={{ color: getRiskColor((sim.results as any).riskScore) }}>
                                                    Risk: {(sim.results as any).riskScore} · {(sim.results as any).priorityLevel}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AxisIntelligencePanel;
