/**
 * SessionsView.tsx — Phase 2/3 Multi-day mission session management.
 * Self-loads missions list. User selects a mission, then manages sessions.
 * Uses Stitch design system.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Button } from '../../stitch/components/Button';
import { Badge } from '../../stitch/components/Badge';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { useCountry } from '../../context/CountryContext';
import { Play, Square, CloudOff, RotateCcw, Clock, CheckCircle, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';

interface Session {
    id: string;
    session_number: number;
    session_date: string;
    start_time: string;
    end_time: string | null;
    completion_percent: number;
    status: string;
    weather_stop: boolean;
    notes: string;
    pilot_name?: string;
}

interface Mission {
    id: string;
    title: string;
    mission_status_v2?: string;
    status?: string;
    completion_percent?: number;
    billing_status?: string;
    total_sessions?: number;
}

const statusBadge = (status: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'info' => {
    const map: Record<string, any> = {
        active: 'info', completed: 'success', closed: 'success', paused_weather: 'warning', pending: 'secondary',
    };
    return map[status] ?? 'secondary';
};

export const SessionsView: React.FC = () => {
    const { activeCountryId } = useCountry();
    const [missions, setMissions] = useState<Mission[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState<string>('');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [mission, setMission] = useState<Mission | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [endModal, setEndModal] = useState(false);
    const [endPercent, setEndPercent] = useState(0);
    const [endNotes, setEndNotes] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Load missions scoped to the active country
    useEffect(() => {
        const params = new URLSearchParams({ limit: '100' });
        if (activeCountryId) params.set('country_id', activeCountryId);
        apiClient.get(`/deployments?${params}`).then(res => {
            const list: Mission[] = (res.data.data || res.data.deployments || []);
            setMissions(list);
            if (list.length > 0) setSelectedMissionId(list[0].id);
        }).catch(() => { });
    }, [activeCountryId]);

    const fetchSessions = useCallback(async () => {
        if (!selectedMissionId) return;
        setLoading(true);
        setError(null);
        try {
            const [sessRes, mRes] = await Promise.all([
                apiClient.get(`/sessions/${selectedMissionId}`),
                apiClient.get(`/deployments/${selectedMissionId}`),
            ]);
            setSessions(sessRes.data.data || []);
            setMission(mRes.data.data || mRes.data || null);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to load sessions');
        } finally {
            setLoading(false);
        }
    }, [selectedMissionId]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    const handleAction = async (action: string, body?: object) => {
        setActionLoading(action);
        setError(null);
        try {
            await apiClient.post(`/sessions/${selectedMissionId}/${action}`, body || {});
            await fetchSessions();
        } catch (e: any) {
            setError(e.response?.data?.message || `Failed to ${action}`);
        } finally {
            setActionLoading(null);
        }
    };

    const activeSession = sessions.find(s => s.status === 'active');
    const mStatus = mission?.mission_status_v2 || mission?.status;
    const canStart = !activeSession && mStatus !== 'completed' && mStatus !== 'closed';
    const canEnd = !!activeSession;
    const canPause = !!activeSession;
    const canResume = mStatus === 'awaiting_return' || mStatus === 'paused_weather';

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <Heading level={2} className="text-white">Sessions</Heading>
                    <Text variant="muted" className="mt-0.5 text-slate-400">
                        {activeCountryId ? `Filtered by selected country` : 'Multi-day inspection session tracking'}
                    </Text>
                </div>
                {/* Mission picker */}
                <div className="relative">
                    <select
                        value={selectedMissionId}
                        onChange={e => setSelectedMissionId(e.target.value)}
                        className="appearance-none bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-9 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[220px]"
                    >
                        {missions.length === 0 && <option value="">Loading missions...</option>}
                        {missions.map(m => (
                            <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
            </div>

            {error && (
                <Card variant="glass" className="border-red-500/30 bg-red-900/10 p-4">
                    <Text className="text-red-400 text-sm">⚠ {error}</Text>
                </Card>
            )}

            {/* Mission status badges */}
            {mission && (
                <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={mStatus === 'completed' || mStatus === 'closed' ? 'success' : mStatus === 'in_progress' ? 'info' : 'secondary'}>
                        {mStatus?.replace(/_/g, ' ') || 'Unknown'}
                    </Badge>
                    <Badge variant="secondary">{mission.completion_percent ?? 0}% Complete</Badge>
                    {mission.billing_status && <Badge variant={mission.billing_status === 'ready_for_invoice' ? 'warning' : 'secondary'}>{mission.billing_status.replace(/_/g, ' ')}</Badge>}
                    <Badge variant="secondary">{mission.total_sessions ?? sessions.length} sessions</Badge>
                </div>
            )}

            {/* Controls */}
            <Card>
                <CardHeader><CardTitle>Session Controls</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="primary" onClick={() => handleAction('start')} disabled={!canStart || !selectedMissionId} isLoading={actionLoading === 'start'}>
                            <Play className="w-4 h-4 mr-2" /> Start Session
                        </Button>
                        <Button variant="secondary" onClick={() => setEndModal(true)} disabled={!canEnd} isLoading={actionLoading === 'end'}>
                            <Square className="w-4 h-4 mr-2" /> End Session
                        </Button>
                        <Button variant="outline" onClick={() => handleAction('pause-weather')} disabled={!canPause} isLoading={actionLoading === 'pause-weather'}>
                            <CloudOff className="w-4 h-4 mr-2" /> Pause — Weather
                        </Button>
                        <Button variant="outline" onClick={() => handleAction('resume')} disabled={!canResume} isLoading={actionLoading === 'resume'}>
                            <RotateCcw className="w-4 h-4 mr-2" /> Resume
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Sessions list */}
            <Card>
                <CardHeader><CardTitle>Session Log</CardTitle></CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-28">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <Text>No sessions yet. Click Start Session above.</Text>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sessions.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-600/20 rounded-lg p-2">
                                            <Calendar className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-200">
                                                Session #{s.session_number}
                                                {s.weather_stop && <span className="ml-2 text-xs text-amber-400">⛈ Weather</span>}
                                            </div>
                                            <div className="text-xs text-slate-500">{s.session_date} · {s.pilot_name || 'Unassigned'}</div>
                                            {s.notes && <div className="text-xs text-slate-500 mt-0.5 italic">{s.notes}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-slate-200">{s.completion_percent}%</div>
                                            <div className="text-xs text-slate-500">Done</div>
                                        </div>
                                        <Badge variant={statusBadge(s.status)}>{s.status}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Progress */}
            {mission && (
                <Card variant="glass">
                    <CardContent className="pt-5">
                        <div className="flex justify-between mb-1.5">
                            <Text className="text-sm font-bold text-slate-300">Overall Progress</Text>
                            <Text className="text-sm font-bold text-blue-400">{mission.completion_percent ?? 0}%</Text>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(mission.completion_percent ?? 0, 100)}%` }} />
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <Text className="text-xs text-slate-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''} logged</Text>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* End Modal */}
            {endModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader><CardTitle>End Session</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Completion % (this session)</label>
                                    <input type="number" min={0} max={100} value={endPercent} onChange={e => setEndPercent(Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notes</label>
                                    <textarea rows={3} value={endNotes} onChange={e => setEndNotes(e.target.value)} placeholder="Session summary..."
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                                </div>
                                <div className="flex gap-3 pt-1">
                                    <Button variant="primary" onClick={() => { handleAction('end', { completion_percent: endPercent, notes: endNotes }); setEndModal(false); }} isLoading={actionLoading === 'end'} className="flex-1">
                                        Confirm
                                    </Button>
                                    <Button variant="ghost" onClick={() => setEndModal(false)}>Cancel</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default SessionsView;
