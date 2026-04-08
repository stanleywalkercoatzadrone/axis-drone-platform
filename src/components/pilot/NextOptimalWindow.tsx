/**
 * NextOptimalWindow.tsx
 * Phase 8 – Pilot Dashboard Forecast Panel
 *
 * Displays the next optimal flight window for a pilot's active mission.
 * Shown on the Pilot Dashboard.
 */
import React, { useEffect, useState } from 'react';

interface ForecastWindow {
    forecast_start_date: string;
    forecast_end_date: string;
    confidence_score: number;
    forecast_confidence: number;
    weather_score: number;
    recommended: boolean;
    consecutive_days: number;
    predicted_completion_rate: number;
}

interface NextOptimalWindowProps {
    missionId: string;
    missionTitle?: string;
}

export const NextOptimalWindow: React.FC<NextOptimalWindowProps> = ({ missionId, missionTitle }) => {
    const [window_, setWindow_] = useState<ForecastWindow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!missionId) return;
        setLoading(true);
        fetch(`/api/forecast/${missionId}/windows`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                const windows: ForecastWindow[] = data.windows || [];
                // Prefer recommended window, fallback to highest confidence
                const best = windows.find(w => w.recommended) || windows[0] || null;
                setWindow_(best);
            })
            .catch(err => setError('Could not load forecast data'))
            .finally(() => setLoading(false));
    }, [missionId]);

    const confidence = window_?.forecast_confidence || window_?.confidence_score || 0;
    const confidenceColor = confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#f59e0b' : '#ef4444';

    if (loading) return (
        <div style={{ background: 'rgba(99,102,241,0.06)', borderRadius: 12, padding: 20, border: '1px solid rgba(99,102,241,0.15)', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
            Loading forecast window...
        </div>
    );

    if (!window_ || error) return (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)', color: '#64748b', fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>📡 Next Optimal Flight Window</div>
            <div>No forecast window available yet. Coordinates required for forecast generation.</div>
        </div>
    );

    const formatDate = (d: string) => {
        try {
            return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return d; }
    };

    // Estimate expected daily output (placeholder: scale from confidence)
    const estimatedDailyOutput = Math.round(200 + (confidence / 100) * 200);

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(6,182,212,0.06) 100%)',
            borderRadius: 14,
            border: '1px solid rgba(34,197,94,0.18)',
            padding: '20px 24px',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        📡 Next Optimal Flight Window
                    </div>
                    {missionTitle && <div style={{ fontSize: 12, color: '#64748b' }}>{missionTitle}</div>}
                </div>
                {window_.recommended && (
                    <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                        ✓ RECOMMENDED
                    </span>
                )}
            </div>

            <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                {formatDate(window_.forecast_start_date)} – {formatDate(window_.forecast_end_date)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
                <div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Confidence</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: confidenceColor }}>{confidence}%</div>
                </div>
                <div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Weather Score</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{window_.weather_score}/100</div>
                </div>
                <div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Est. Daily Output</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{estimatedDailyOutput} panels</div>
                </div>
            </div>

            {window_.consecutive_days && (
                <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>
                    {window_.consecutive_days} consecutive flyable days · {window_.predicted_completion_rate ? `${Math.round(window_.predicted_completion_rate)}% predicted completion rate` : ''}
                </div>
            )}
        </div>
    );
};

export default NextOptimalWindow;
