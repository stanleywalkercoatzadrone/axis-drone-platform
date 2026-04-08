/**
 * ThermalFaultsView.tsx
 * Phase 6 — AI Thermal Fault Detection dashboard.
 * Uses Stitch design system components.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Badge } from '../../stitch/components/Badge';
import { Button } from '../../stitch/components/Button';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { Flame, AlertTriangle, CheckCircle, Thermometer, MapPin, Filter, ChevronDown, BrainCircuit, RefreshCw } from 'lucide-react';


interface ThermalFault {
    id: string;
    mission_id: string;
    fault_type: string;
    temperature_delta: number;
    severity: string;
    coordinates: { lat?: number; lon?: number; x?: number; y?: number } | null;
    reviewed: boolean;
    created_at: string;
}

interface ThermalFaultsViewProps {
    missionId?: string;
}

const severityBadge = (sev: string): 'destructive' | 'warning' | 'info' => {
    if (sev === 'critical') return 'destructive';
    if (sev === 'moderate') return 'warning';
    return 'info';
};

const severityColor = (sev: string) => {
    if (sev === 'critical') return 'text-red-400';
    if (sev === 'moderate') return 'text-amber-400';
    return 'text-blue-400';
};

const severityBg = (sev: string) => {
    if (sev === 'critical') return 'bg-red-900/20 border-red-500/20';
    if (sev === 'moderate') return 'bg-amber-900/20 border-amber-500/20';
    return 'bg-blue-900/20 border-blue-500/20';
};

interface ThermalAIResult {
    riskLevel: string;
    confidence: number;
    maxTempDelta: number;
    estimatedHotspots: number;
    priorityActions: string[];
    summary: string;
    recommendedInspectionDate?: string;
}

export const ThermalFaultsView: React.FC<ThermalFaultsViewProps> = ({ missionId: propMissionId }) => {
    const [missions, setMissions] = useState<{ id: string; title: string }[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState(propMissionId || '');
    const [faults, setFaults] = useState<ThermalFault[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'critical' | 'moderate' | 'minor'>('all');
    const [thermalAI, setThermalAI] = useState<ThermalAIResult | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);


    useEffect(() => {
        apiClient.get('/deployments?limit=100').then(res => {
            const list = res.data.data || res.data.deployments || [];
            setMissions(list);
            if (!propMissionId && list.length > 0) setSelectedMissionId(list[0].id);
        }).catch(() => { });
    }, [propMissionId]);

    const fetchFaults = useCallback(async () => {
        if (!selectedMissionId) return;
        setLoading(true);
        setError(null);
        try {
            // Correct route: GET /api/faults?mission_id=...
            const res = await apiClient.get(`/faults?mission_id=${selectedMissionId}`);
            setFaults(res.data.data || res.data.faults || []);
        } catch (e: any) {
            setError('No thermal fault data available for this mission.');
        } finally {
            setLoading(false);
        }
    }, [selectedMissionId]);

    useEffect(() => { fetchFaults(); }, [fetchFaults]);

    const runThermalScan = useCallback(async () => {
        if (!selectedMissionId) return;
        setAiLoading(true);
        setAiError(null);
        const selectedMission = missions.find(m => m.id === selectedMissionId);
        try {
            const res = await apiClient.post('/ai/thermal-scan', {
                missionId: selectedMissionId,
                siteName: selectedMission?.title || selectedMissionId,
                faultCount: faults.length,
            });
            if (res.data.success) setThermalAI(res.data.analysis);
            else setAiError('AI scan returned an error.');
        } catch (e: any) {
            setAiError(e.response?.data?.message || 'AI thermal scan failed.');
        } finally {
            setAiLoading(false);
        }
    }, [selectedMissionId, missions, faults.length]);

    const filtered = filter === 'all' ? faults : faults.filter(f => f.severity === filter);

    const counts = {
        critical: faults.filter(f => f.severity === 'critical').length,
        moderate: faults.filter(f => f.severity === 'moderate').length,
        minor: faults.filter(f => f.severity === 'minor').length,
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <Heading level={2} className="text-white">Thermal Fault Detection</Heading>
                    <Text variant="muted" className="mt-0.5 text-slate-400">AI-classified thermal anomalies from drone imagery</Text>
                </div>
                <div className="flex items-center gap-2">
                    {missions.length > 0 && (
                        <div className="relative">
                            <select
                                value={selectedMissionId}
                                onChange={e => { setSelectedMissionId(e.target.value); setThermalAI(null); }}
                                className="appearance-none bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-9 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer min-w-[220px]"
                            >
                                {missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={runThermalScan}
                        isLoading={aiLoading}
                        disabled={!selectedMissionId || aiLoading}
                        className="flex items-center gap-1.5 border border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                    >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        {thermalAI ? 'Re-scan' : 'AI Thermal Scan'}
                    </Button>
                </div>
            </div>

            {/* AI Scan Result Panel */}
            {(thermalAI || aiError) && (
                <Card className={`border-violet-500/20 ${thermalAI?.riskLevel === 'Critical' ? 'bg-red-900/10' : thermalAI?.riskLevel === 'High' ? 'bg-amber-900/10' : 'bg-violet-900/10'}`}>
                    <CardContent className="pt-5">
                        {aiError ? (
                            <Text className="text-red-400">{aiError}</Text>
                        ) : thermalAI && (
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <BrainCircuit className="w-4 h-4 text-violet-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-violet-400">Gemini Thermal Analysis</span>
                                    <span className={`ml-auto text-xs font-black px-2.5 py-0.5 rounded-full ${
                                        thermalAI.riskLevel === 'Critical' ? 'bg-red-500/20 text-red-400' :
                                        thermalAI.riskLevel === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                                    }`}>{thermalAI.riskLevel} Risk</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 mb-3 text-center">
                                    <div><div className="text-xl font-black text-red-400">{thermalAI.maxTempDelta}°C</div><div className="text-[10px] text-slate-500 uppercase tracking-wide">Max ΔT</div></div>
                                    <div><div className="text-xl font-black text-amber-400">{thermalAI.estimatedHotspots}</div><div className="text-[10px] text-slate-500 uppercase tracking-wide">Est. Hotspots</div></div>
                                    <div><div className="text-xl font-black text-violet-400">{thermalAI.confidence}%</div><div className="text-[10px] text-slate-500 uppercase tracking-wide">Confidence</div></div>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed mb-3">{thermalAI.summary}</p>
                                {thermalAI.priorityActions?.length > 0 && (
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1.5">Priority Actions</div>
                                        {thermalAI.priorityActions.map((a, i) => (
                                            <div key={i} className="flex gap-2 text-xs text-slate-400 mb-1">
                                                <span className="text-violet-400 font-bold shrink-0">{i + 1}.</span> {a}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-red-500/20 bg-red-900/10 cursor-pointer hover:border-red-500/40 transition-colors" onClick={() => setFilter('critical')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Flame className="w-8 h-8 text-red-400" />
                            <div>
                                <div className="text-3xl font-black text-red-400">{counts.critical}</div>
                                <Text className="text-xs text-slate-400 uppercase tracking-widest font-bold">Critical</Text>
                            </div>
                        </div>
                        <Text className="text-xs text-slate-500 mt-2">ΔT &gt; 20°C</Text>
                    </CardContent>
                </Card>
                <Card className="border-amber-500/20 bg-amber-900/10 cursor-pointer hover:border-amber-500/40 transition-colors" onClick={() => setFilter('moderate')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-amber-400" />
                            <div>
                                <div className="text-3xl font-black text-amber-400">{counts.moderate}</div>
                                <Text className="text-xs text-slate-400 uppercase tracking-widest font-bold">Moderate</Text>
                            </div>
                        </div>
                        <Text className="text-xs text-slate-500 mt-2">ΔT 10–20°C</Text>
                    </CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-900/10 cursor-pointer hover:border-blue-500/40 transition-colors" onClick={() => setFilter('minor')}>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Thermometer className="w-8 h-8 text-blue-400" />
                            <div>
                                <div className="text-3xl font-black text-blue-400">{counts.minor}</div>
                                <Text className="text-xs text-slate-400 uppercase tracking-widest font-bold">Minor</Text>
                            </div>
                        </div>
                        <Text className="text-xs text-slate-500 mt-2">ΔT &lt; 10°C</Text>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                {(['all', 'critical', 'moderate', 'minor'] as const).map(f => (
                    <Button
                        key={f}
                        size="sm"
                        variant={filter === f ? 'primary' : 'ghost'}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                ))}
            </div>

            {/* Faults Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-red-400" />
                        Detected Faults
                        <Badge variant="secondary" className="ml-auto">{filtered.length} results</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-red-500 border-t-transparent" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-slate-500">
                            <Thermometer className="w-8 h-8 mx-auto mb-3 opacity-40" />
                            <Text>{error}</Text>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <CheckCircle className="w-8 h-8 mx-auto mb-3 text-emerald-400 opacity-60" />
                            <Text>No {filter !== 'all' ? filter : ''} faults detected.</Text>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map(fault => (
                                <div key={fault.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${severityBg(fault.severity)}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-slate-900/50`}>
                                            <Flame className={`w-5 h-5 ${severityColor(fault.severity)}`} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-200">{fault.fault_type || 'Thermal Anomaly'}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                <Thermometer className="w-3 h-3" />
                                                ΔT {fault.temperature_delta?.toFixed(1)}°C
                                                {fault.coordinates && (
                                                    <>
                                                        <MapPin className="w-3 h-3 ml-1" />
                                                        {fault.coordinates.x != null
                                                            ? `x:${fault.coordinates.x} y:${fault.coordinates.y}`
                                                            : `${fault.coordinates.lat?.toFixed(5)}, ${fault.coordinates.lon?.toFixed(5)}`
                                                        }
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {fault.reviewed && (
                                            <Badge variant="success">Reviewed</Badge>
                                        )}
                                        <Badge variant={severityBadge(fault.severity)}>
                                            {fault.severity}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ThermalFaultsView;
