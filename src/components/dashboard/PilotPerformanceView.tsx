/**
 * PilotPerformanceView.tsx
 * Phase 7 — Pilot performance analytics dashboard.
 * Uses Stitch design system components.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Badge } from '../../stitch/components/Badge';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { User, Star, CloudOff, Layers, Zap, TrendingUp, Trophy } from 'lucide-react';

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

export const PilotPerformanceView: React.FC = () => {
    const [pilots, setPilots] = useState<PilotMetric[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                        <div className="space-y-3">
                            {sorted.map((pilot, idx) => {
                                const score = pilotScore(pilot);
                                return (
                                    <div key={pilot.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Rank badge */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black
                                                ${idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                    idx === 1 ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
                                                        idx === 2 ? 'bg-orange-800/20 text-orange-400 border border-orange-700/30' :
                                                            'bg-slate-800 text-slate-500'}`}>
                                                #{idx + 1}
                                            </div>
                                            <div className="bg-blue-600/20 rounded-full p-2">
                                                <User className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-200">{pilot.pilot_name || `Pilot ${pilot.pilot_id?.slice(0, 8)}`}</div>
                                                <div className="text-xs text-amber-400">{starRating(pilot.rating ?? 5)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 text-center">
                                            <div>
                                                <div className="text-sm font-bold text-slate-200">{pilot.missions_completed}</div>
                                                <div className="text-xs text-slate-500">Missions</div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-200">{pilot.sessions_completed}</div>
                                                <div className="text-xs text-slate-500">Sessions</div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-cyan-400">{pilot.faults_detected}</div>
                                                <div className="text-xs text-slate-500">Faults</div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1 text-sm font-bold text-amber-400">
                                                    <CloudOff className="w-3 h-3" />{pilot.weather_interruptions}
                                                </div>
                                                <div className="text-xs text-slate-500">Weather</div>
                                            </div>
                                            <div>
                                                <Badge variant={score >= 10 ? 'success' : score >= 5 ? 'info' : 'secondary'}>
                                                    Score: {score}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PilotPerformanceView;
