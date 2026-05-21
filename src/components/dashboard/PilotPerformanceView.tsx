/**
 * PilotPerformanceView.tsx
 * Phase 6 — Pilot performance analytics with tiered leaderboard.
 * Top 3: featured cards. Rank 4+: compact rows. Zero-data: collapsed.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Badge } from '../../stitch/components/Badge';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { User, CloudOff, Layers, Zap, TrendingUp, Trophy, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface PilotMetric {
    id: string;
    pilot_id: string;
    pilot_name?: string;
    missions_completed: number;
    sessions_completed: number;
    weather_interruptions: number;
    avg_completion_speed: number;
    faults_detected: number;
    rating: number;
    last_computed_at: string;
}

const pilotScore = (m: PilotMetric) =>
    m.missions_completed * 2 + m.sessions_completed + m.faults_detected - m.weather_interruptions;

const starRating = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const stars = [];
    for (let i = 0; i < 5; i++) {
        if (i < full) stars.push('★');
        else if (i === full && half) stars.push('½');
        else stars.push('☆');
    }
    return stars.join('');
};

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = [
    { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' },
    { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', text: '#cbd5e1' },
    { bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.25)', text: '#fb923c' },
];

// Weather score tooltip content
const WEATHER_SCORE_TOOLTIP = `Weather Score = number of weather interruptions during active missions.
Lower = better conditions experienced.
High scores indicate missions in challenging weather — factored out of performance ratings.`;

export const PilotPerformanceView: React.FC = () => {
    const [pilots, setPilots] = useState<PilotMetric[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inactiveExpanded, setInactiveExpanded] = useState(false);
    const [weatherTipVisible, setWeatherTipVisible] = useState(false);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        try {
            // Correct endpoint: GET /api/pilot-metrics/leaderboard
            const res = await apiClient.get('/pilot-metrics/leaderboard');
            setPilots(res.data.data || res.data.pilots || res.data || []);
        } catch (e: any) {
            setError('No pilot performance data yet. Metrics are computed from completed mission sessions.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

    const sorted = [...pilots].sort((a, b) => pilotScore(b) - pilotScore(a));
    const activePilots = sorted.filter(p => p.missions_completed > 0 || p.sessions_completed > 0);
    const inactivePilots = sorted.filter(p => p.missions_completed === 0 && p.sessions_completed === 0);
    const top3 = activePilots.slice(0, 3);
    const rest = activePilots.slice(3);

    return (
        <div className="space-y-6">
            <div>
                <Heading level={2} className="text-white">Pilot Performance</Heading>
                <Text variant="muted" className="mt-1 text-slate-400">
                    Computed from real mission session data
                </Text>
            </div>

            {/* Top Stats */}
            {pilots.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <Card variant="glass">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <Trophy className="w-6 h-6 text-amber-400" />
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Top Pilot</div>
                                    <div className="text-base font-bold text-slate-200">{sorted[0]?.pilot_name || 'Unknown'}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="glass">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <Layers className="w-6 h-6 text-blue-400" />
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total Missions</div>
                                    <div className="text-2xl font-black text-blue-400">
                                        {pilots.reduce((acc, p) => acc + p.missions_completed, 0)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card variant="glass">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <Zap className="w-6 h-6 text-cyan-400" />
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Faults Found</div>
                                    <div className="text-2xl font-black text-cyan-400">
                                        {pilots.reduce((acc, p) => acc + p.faults_detected, 0)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Pilot Leaderboard */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        Pilot Leaderboard
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                        </div>
                    ) : error || pilots.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <User className="w-8 h-8 mx-auto mb-3 opacity-40" />
                            <Text>{error || 'No pilot metric data yet. Metrics are computed from completed sessions.'}</Text>
                        </div>
                    ) : (
                        <div className="space-y-6">

                            {/* ── TOP 3 FEATURED CARDS ──────────────────────── */}
                            {top3.length > 0 && (
                                <div>
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                                        Top Performers
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {top3.map((pilot, idx) => {
                                            const score = pilotScore(pilot);
                                            const colors = MEDAL_COLORS[idx];
                                            return (
                                                <div key={pilot.id} style={{
                                                    background: colors.bg,
                                                    border: `1px solid ${colors.border}`,
                                                    borderRadius: 14,
                                                    padding: '16px 18px',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                        <span style={{ fontSize: 22 }}>{MEDAL[idx]}</span>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>#{idx + 1}</div>
                                                            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rank</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {pilot.pilot_name || `Pilot ${pilot.pilot_id?.slice(0, 8)}`}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 14 }}>
                                                        {starRating(pilot.rating ?? 5)}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>{pilot.missions_completed}</div>
                                                            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Missions</div>
                                                        </div>
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                                            <div style={{ fontSize: 16, fontWeight: 800, color: '#22d3ee' }}>{pilot.faults_detected}</div>
                                                            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Faults</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ marginTop: 10, textAlign: 'center' }}>
                                                        <Badge variant={score >= 10 ? 'success' : score >= 5 ? 'info' : 'secondary'}>
                                                            Score: {score}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── RANK 4+ COMPACT ROWS ──────────────────────── */}
                            {rest.length > 0 && (
                                <div>
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Ranked Pilots
                                        {/* Weather score tooltip trigger */}
                                        <span
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'help', color: '#475569', fontSize: 10, fontWeight: 600 }}
                                            onMouseEnter={() => setWeatherTipVisible(true)}
                                            onMouseLeave={() => setWeatherTipVisible(false)}
                                        >
                                            <Info size={11} /> weather score?
                                        </span>
                                        {weatherTipVisible && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, zIndex: 50,
                                                background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: 10, padding: '10px 14px', marginTop: 6,
                                                fontSize: 11, color: '#94a3b8', lineHeight: 1.6,
                                                maxWidth: 300, whiteSpace: 'pre-line',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                            }}>
                                                {WEATHER_SCORE_TOOLTIP}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {rest.map((pilot, i) => {
                                            const score = pilotScore(pilot);
                                            const idx = i + 3;
                                            return (
                                                <div key={pilot.id}
                                                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-black text-slate-400">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="w-7 h-7 bg-blue-600/15 rounded-full flex items-center justify-center">
                                                            <User className="w-3.5 h-3.5 text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-300">
                                                                {pilot.pilot_name || `Pilot ${pilot.pilot_id?.slice(0, 8)}`}
                                                            </div>
                                                            <div className="text-xs text-amber-400">{starRating(pilot.rating ?? 5)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-5 text-center">
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-300">{pilot.missions_completed}</div>
                                                            <div className="text-xs text-slate-500">Missions</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-cyan-400">{pilot.faults_detected}</div>
                                                            <div className="text-xs text-slate-500">Faults</div>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1 text-sm font-bold text-slate-400">
                                                                <CloudOff className="w-3 h-3" />{pilot.weather_interruptions}
                                                            </div>
                                                            <div className="text-xs text-slate-500">Weather</div>
                                                        </div>
                                                        <Badge variant={score >= 10 ? 'success' : score >= 5 ? 'info' : 'secondary'}>
                                                            {score}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── INACTIVE PILOTS (COLLAPSED) ───────────────── */}
                            {inactivePilots.length > 0 && (
                                <div>
                                    <button
                                        onClick={() => setInactiveExpanded(e => !e)}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-400 transition-colors"
                                    >
                                        {inactiveExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        {inactivePilots.length} pilot{inactivePilots.length !== 1 ? 's' : ''} with no recorded sessions
                                    </button>
                                    {inactiveExpanded && (
                                        <div className="mt-3 space-y-2">
                                            {inactivePilots.map(pilot => (
                                                <div key={pilot.id}
                                                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-900/30 border border-slate-800/50 opacity-60"
                                                >
                                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                                    <span className="text-sm text-slate-500">
                                                        {pilot.pilot_name || `Pilot ${pilot.pilot_id?.slice(0, 8)}`}
                                                    </span>
                                                    <span className="ml-auto text-xs text-slate-600">No sessions yet</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PilotPerformanceView;
