/**
 * SolarCommandCenter.tsx
 * Phase 9 — Solar fleet command center with site status overview.
 * Uses Stitch design system components.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Badge } from '../../stitch/components/Badge';
import { Button } from '../../stitch/components/Button';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { Sun, Flame, AlertTriangle, CheckCircle, Zap, BarChart2, MapPin, Calendar, RefreshCw, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';

interface AIFinding { type: string; severity: string; description: string; recommendation: string; }
interface SiteAIResult { aiSummary: string; findings: AIFinding[]; loading?: boolean; error?: string; }


interface SiteStatus {
    id: string;
    title: string;
    location?: string;
    industry_type?: string;
    mission_status_v2?: string;
    completion_percent?: number;
    billing_status?: string;
    thermal_fault_count?: number;
    last_session_date?: string;
}

const siteHealth = (site: SiteStatus): 'healthy' | 'needs_inspection' | 'fault' => {
    if ((site.thermal_fault_count ?? 0) > 0) return 'fault';
    if ((site.completion_percent ?? 0) < 100 && site.mission_status_v2 !== 'completed') return 'needs_inspection';
    return 'healthy';
};

const healthColor = (h: ReturnType<typeof siteHealth>) => ({
    healthy: 'text-emerald-400',
    needs_inspection: 'text-amber-400',
    fault: 'text-red-400',
}[h]);

const healthBg = (h: ReturnType<typeof siteHealth>) => ({
    healthy: 'bg-emerald-500/20',
    needs_inspection: 'bg-amber-500/20',
    fault: 'bg-red-500/20',
}[h]);

const healthBadge = (h: ReturnType<typeof siteHealth>): 'success' | 'warning' | 'destructive' => ({
    healthy: 'success',
    needs_inspection: 'warning',
    fault: 'destructive',
} as const)[h];

const healthIcon = (h: ReturnType<typeof siteHealth>) => {
    if (h === 'fault') return <Flame className="w-5 h-5 text-red-400" />;
    if (h === 'needs_inspection') return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    return <CheckCircle className="w-5 h-5 text-emerald-400" />;
};

export const SolarCommandCenter: React.FC = () => {
    const [sites, setSites] = useState<SiteStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [siteAI, setSiteAI] = useState<Record<string, SiteAIResult>>({});
    const [expandedAI, setExpandedAI] = useState<Record<string, boolean>>({});

    const fetchSites = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/deployments?industry_type=solar&limit=100');
            setSites(res.data.data || res.data.deployments || []);
        } catch (e: any) {
            setError('Failed to load solar fleet data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSites(); }, [fetchSites]);

    const runSiteAI = async (site: SiteStatus) => {
        setSiteAI(prev => ({ ...prev, [site.id]: { aiSummary: '', findings: [], loading: true } }));
        try {
            const res = await apiClient.post('/ai/solar-analyze', {
                deploymentId: site.id,
                form: { siteName: site.title, inspectionDate: new Date().toISOString().split('T')[0] },
                images: [],
            });
            setSiteAI(prev => ({ ...prev, [site.id]: { aiSummary: res.data.aiSummary || '', findings: res.data.findings || [], loading: false } }));
            setExpandedAI(prev => ({ ...prev, [site.id]: true }));
        } catch (e: any) {
            setSiteAI(prev => ({ ...prev, [site.id]: { aiSummary: '', findings: [], loading: false, error: 'AI analysis failed' } }));
        }
    };

    const filtered = sites.filter(s =>
        s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const counts = {
        healthy: filtered.filter(s => siteHealth(s) === 'healthy').length,
        needs_inspection: filtered.filter(s => siteHealth(s) === 'needs_inspection').length,
        fault: filtered.filter(s => siteHealth(s) === 'fault').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Sun className="w-7 h-7 text-amber-400" />
                        <Heading level={2} className="text-white">Solar Command Center</Heading>
                    </div>
                    <Text variant="muted" className="mt-1 text-slate-400">
                        Global solar inspection fleet status
                    </Text>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchSites} isLoading={loading}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* Fleet Health Summary */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-emerald-500/20 bg-emerald-900/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500/20 rounded-full p-2">
                                <CheckCircle className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-black text-emerald-400">{counts.healthy}</div>
                                <Text className="text-xs text-slate-400 uppercase tracking-widest font-bold">Healthy</Text>
                            </div>
                        </div>
                        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5">
                            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${filtered.length ? (counts.healthy / filtered.length) * 100 : 0}%` }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-amber-500/20 bg-amber-900/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500/20 rounded-full p-2">
                                <AlertTriangle className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-black text-amber-400">{counts.needs_inspection}</div>
                                <Text className="text-xs text-slate-400 uppercase tracking-widest font-bold">Inspection Needed</Text>
                            </div>
                        </div>
                        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${filtered.length ? (counts.needs_inspection / filtered.length) * 100 : 0}%` }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-red-500/20 bg-red-900/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-500/20 rounded-full p-2">
                                <Flame className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-black text-red-400">{counts.fault}</div>
                                <Text className="text-xs text-slate-400 uppercase tracking-widest font-bold">Faults Detected</Text>
                            </div>
                        </div>
                        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5">
                            <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{ width: `${filtered.length ? (counts.fault / filtered.length) * 100 : 0}%` }} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search sites or locations..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder-slate-600"
                />
                <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
            </div>

            {/* Site Grid */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sun className="w-5 h-5 text-amber-400" />
                        Solar Sites
                        <Badge variant="secondary" className="ml-auto">{filtered.length} sites</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-slate-500">
                            <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                            <Text>{error}</Text>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Sun className="w-8 h-8 mx-auto mb-3 opacity-40" />
                            <Text>No solar sites found. Create missions with industry type &quot;solar&quot;.</Text>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filtered.map(site => {
                                const health = siteHealth(site);
                                return (
                                    <Card key={site.id} variant="glass" className="hover:border-slate-600 transition-all cursor-pointer group">
                                        <CardContent className="pt-6">
                                            {/* Site header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={`rounded-xl p-2.5 ${healthBg(health)}`}>
                                                    {healthIcon(health)}
                                                </div>
                                                <Badge variant={healthBadge(health)}>
                                                    {health.replace(/_/g, ' ')}
                                                </Badge>
                                            </div>

                                            <div className="font-bold text-slate-200 text-sm group-hover:text-white transition-colors line-clamp-1">
                                                {site.title}
                                            </div>
                                            {site.location && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                                    <MapPin className="w-3 h-3" /> {site.location}
                                                </div>
                                            )}

                                            {/* Progress */}
                                            <div className="mt-4">
                                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                    <span>Inspection Progress</span>
                                                    <span className={healthColor(health)}>{site.completion_percent ?? 0}%</span>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-1.5">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all duration-700 ${health === 'healthy' ? 'bg-emerald-500' :
                                                                health === 'fault' ? 'bg-red-500' : 'bg-amber-500'
                                                            }`}
                                                        style={{ width: `${site.completion_percent ?? 0}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Stats row */}
                                            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                                                {(site.thermal_fault_count ?? 0) > 0 && (
                                                    <span className="flex items-center gap-1 text-red-400">
                                                        <Flame className="w-3 h-3" /> {site.thermal_fault_count} faults
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <BarChart2 className="w-3 h-3" />
                                                    {site.mission_status_v2?.replace(/_/g, ' ') || 'No status'}
                                                </span>
                                                {site.last_session_date && (
                                                    <span className="flex items-center gap-1 ml-auto">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(site.last_session_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>

                                            {/* AI Analysis */}
                                            <div className="mt-4 pt-3 border-t border-slate-700/50">
                                                {(() => {
                                                    const ai = siteAI[site.id];
                                                    if (!ai) return (
                                                        <button
                                                            onClick={() => runSiteAI(site)}
                                                            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/20 transition-all"
                                                        >
                                                            <BrainCircuit className="w-3 h-3" /> Run AI Analysis
                                                        </button>
                                                    );
                                                    if (ai.loading) return (
                                                        <div className="flex items-center justify-center gap-2 py-2 text-xs text-violet-400">
                                                            <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                                                            Gemini analyzing…
                                                        </div>
                                                    );
                                                    if (ai.error) return <p className="text-xs text-red-400 text-center py-1">{ai.error}</p>;
                                                    return (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-violet-400">AI Analysis · {ai.findings.length} findings</span>
                                                                <button onClick={() => setExpandedAI(p => ({ ...p, [site.id]: !p[site.id] }))} className="text-slate-500 hover:text-slate-300">
                                                                    {expandedAI[site.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                </button>
                                                            </div>
                                                            {expandedAI[site.id] && (
                                                                <>
                                                                    <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{ai.aiSummary}</p>
                                                                    {ai.findings.slice(0, 2).map((f, i) => (
                                                                        <div key={i} className="text-[10px] mb-1 flex gap-2">
                                                                            <span className={`font-bold shrink-0 ${f.severity === 'Critical' ? 'text-red-400' : f.severity === 'High' ? 'text-amber-400' : 'text-blue-400'}`}>{f.severity}</span>
                                                                            <span className="text-slate-500">{f.type}</span>
                                                                        </div>
                                                                    ))}
                                                                    <button onClick={() => runSiteAI(site)} className="mt-1 text-[9px] text-violet-400 hover:text-violet-300 font-bold">↺ Re-run</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SolarCommandCenter;
