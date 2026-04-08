/**
 * MissionTimelineView.tsx — Phase 4 mission event timeline.
 * Self-loads missions list. User picks a mission, timeline loads.
 * Uses Stitch design system.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../stitch/components/Card';
import { Badge } from '../../stitch/components/Badge';
import { Heading, Text } from '../../stitch/components/Typography';
import apiClient from '../../services/apiClient';
import { useCountry } from '../../context/CountryContext';
import { Activity, Play, Square, CloudOff, RotateCcw, FileText, CheckCircle, Sliders, ChevronDown } from 'lucide-react';

interface TimelineEvent {
    id: string;
    event_type: string;
    description: string;
    created_at: string;
    created_by_name?: string;
}

interface Mission { id: string; title: string; }

const eventIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = {
        session_started: <Play className="w-4 h-4 text-blue-400" />,
        session_completed: <Square className="w-4 h-4 text-emerald-400" />,
        weather_pause: <CloudOff className="w-4 h-4 text-amber-400" />,
        session_resumed: <RotateCcw className="w-4 h-4 text-cyan-400" />,
        invoice_generated: <FileText className="w-4 h-4 text-purple-400" />,
        mission_completed: <CheckCircle className="w-4 h-4 text-emerald-400" />,
        admin_override: <Sliders className="w-4 h-4 text-red-400" />,
    };
    return map[type] ?? <Activity className="w-4 h-4 text-slate-400" />;
};

const eventBadge = (type: string): 'info' | 'success' | 'warning' | 'destructive' | 'secondary' => {
    const map: Record<string, any> = {
        session_started: 'info', session_completed: 'success', weather_pause: 'warning',
        session_resumed: 'info', invoice_generated: 'secondary', mission_completed: 'success', admin_override: 'destructive',
    };
    return map[type] ?? 'secondary';
};

const fmt = (ts: string) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const MissionTimelineView: React.FC = () => {
    const { activeCountryId } = useCountry();
    const [missions, setMissions] = useState<Mission[]>([]);
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams({ limit: '100' });
        if (activeCountryId) params.set('country_id', activeCountryId);
        apiClient.get(`/deployments?${params}`).then(res => {
            const list: Mission[] = res.data.data || res.data.deployments || [];
            setMissions(list);
            if (list.length > 0) setSelectedMissionId(list[0].id);
        }).catch(() => { });
    }, [activeCountryId]);

    const fetchTimeline = useCallback(async () => {
        if (!selectedMissionId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get(`/sessions/${selectedMissionId}/timeline`);
            setEvents(res.data.data || []);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to load timeline');
        } finally {
            setLoading(false);
        }
    }, [selectedMissionId]);

    useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <Heading level={2} className="text-white">Mission Timeline</Heading>
                    <Text variant="muted" className="mt-0.5 text-slate-400">
                        {activeCountryId ? 'Filtered by selected country' : 'Chronological event log'}
                    </Text>
                </div>
                <div className="relative">
                    <select
                        value={selectedMissionId}
                        onChange={e => setSelectedMissionId(e.target.value)}
                        className="appearance-none bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-9 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[220px]"
                    >
                        {missions.length === 0 && <option value="">Loading missions...</option>}
                        {missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
            </div>

            {error && (
                <Card variant="glass" className="border-red-500/30 bg-red-900/10 p-4">
                    <Text className="text-red-400 text-sm">⚠ {error}</Text>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-400" /> Event Log
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-28">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <Text>No events recorded yet. Start a session to generate timeline events.</Text>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />
                            <div className="space-y-0">
                                {events.map(event => (
                                    <div key={event.id} className="flex items-start gap-4 relative pl-12 pb-5">
                                        <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center z-10">
                                            {eventIcon(event.event_type)}
                                        </div>
                                        <div className="flex-1 pt-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant={eventBadge(event.event_type)}>
                                                    {event.event_type.replace(/_/g, ' ')}
                                                </Badge>
                                                <span className="text-xs text-slate-500">{fmt(event.created_at)}</span>
                                                {event.created_by_name && <span className="text-xs text-slate-600">by {event.created_by_name}</span>}
                                            </div>
                                            <p className="text-sm text-slate-300 mt-1">{event.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default MissionTimelineView;
