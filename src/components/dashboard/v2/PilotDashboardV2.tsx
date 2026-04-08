/**
 * PilotDashboardV2.tsx — Enhanced Pilot Dashboard
 * Pilot Access Streamlining — Phase 8
 *
 * Section 1: My Assigned Missions (no financial data)
 * Section 2: Mission Actions (Download KML, Parameters, Upload, Daily Report)
 * Section 3: My Performance Snapshot (non-financial metrics only)
 *
 * ZERO financial fields rendered anywhere in this component.
 * UI/UX: Matches admin dashboard design language (white cards, slate borders, shadow-sm).
 */
// Pilot Dashboard v2 — weather upgrade v2 (2026-03-26)
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    CloudLightning, MapPin, AlertCircle, CheckSquare, Calendar,
    Download, Upload, FileText, BarChart3, Cloud, Wind, Sun,
    TrendingUp, TrendingDown, Minus, RefreshCw, ChevronRight,
    CheckCircle, Clock, Plane, Activity, Target, Loader2
} from 'lucide-react';
import apiClient from '../../../services/apiClient';
import PilotProtocolsPanel from './PilotProtocolsPanel';

interface AssignedMission {
    id: string;
    title?: string;
    type: string;
    status: string;
    date?: string;
    due_date?: string;
    site_name?: string;
    project_name?: string;
    location?: string;
    industry_key?: string;
    sites?: { name?: string; location?: string };
    // Financial fields INTENTIONALLY excluded
}

interface PerformanceData {
    totalMissionsAssigned: number;
    missionsCompleted: number;
    missionsInProgress: number;
    completionPercentage: number;
    avgDailyCompletionRate: number;
    totalActiveDays: number;
}

interface WeatherData {
    temperature?: number;
    feels_like?: number;
    humidity?: number;
    dew_point?: number;
    wind_speed?: number;
    wind_gusts?: number;
    wind_direction?: string;
    wind_bearing?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    visibility_mi?: number;
    uv_index?: number;
    pressure_hpa?: number;
    solar_radiation?: number;
    flight_status?: 'GO' | 'CAUTION' | 'NO_GO';
    flight_reasons?: string[];
    // Legacy fallbacks
    conditions?: string;
    irradiance_ghi?: number;
}

interface HourlySlot {
    time: string; temp: number; wind: number;
    precip_prob: number; cloud: number; code?: number;
}

const weatherCodeLabel = (code?: number): string => {
    if (code === undefined || code === null) return 'Unknown';
    if (code === 0) return 'Clear Sky';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 9) return 'Fog / Mist';
    if (code <= 29) return 'Drizzle';
    if (code <= 39) return 'Rain';
    if (code <= 49) return 'Snow';
    if (code <= 59) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 84) return 'Rain Showers';
    if (code <= 86) return 'Snow Showers';
    if (code <= 94) return 'Thunderstorm';
    return 'Severe Storm';
};

const weatherCodeEmoji = (code?: number): string => {
    if (code === undefined || code === null) return '🌡️';
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 9) return '🌫️';
    if (code <= 29) return '🌦️';
    if (code <= 39) return '🌧️';
    if (code <= 49) return '❄️';
    if (code <= 59) return '🌦️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 84) return '🌦️';
    if (code <= 86) return '🌨️';
    if (code <= 94) return '⛈️';
    return '🌪️';
};

const uvLabel = (uv: number) => {
    if (uv < 3) return { label: 'Low', color: 'text-emerald-600' };
    if (uv < 6) return { label: 'Moderate', color: 'text-yellow-600' };
    if (uv < 8) return { label: 'High', color: 'text-orange-600' };
    if (uv < 11) return { label: 'Very High', color: 'text-red-600' };
    return { label: 'Extreme', color: 'text-purple-600' };
};

const STATUS_COLORS: Record<string, string> = {
    assigned: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    on_hold: 'bg-slate-100 text-slate-500 border-slate-200',
};

const DRAFT_KEY = (missionId: string) => `daily_report_draft_${missionId}`;

const DailyReportModal: React.FC<{
    missionId: string; onClose: () => void;
}> = ({ missionId, onClose }) => {
    const savedDraft = (() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY(missionId)) || 'null'); } catch { return null; } })();

    const [form, setForm] = useState({
        reportDate:         savedDraft?.reportDate         || new Date().toISOString().split('T')[0],
        missionsFlownCount: savedDraft?.missionsFlownCount || '',
        blocksCompleted:    savedDraft?.blocksCompleted    || '',
        hoursWorked:        savedDraft?.hoursWorked        || '',
        issuesEncountered:  savedDraft?.issuesEncountered  || '',
        notes:              savedDraft?.notes              || '',
    });

    // step: 'form' | 'previewing' | 'submitted'
    const [step, setStep] = useState<'form' | 'previewing' | 'submitted'>('form');
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draftSaved, setDraftSaved] = useState(false);

    // Preview data
    const [aiReport, setAiReport]           = useState<string | null>(null);
    const [weatherSnap, setWeatherSnap]     = useState<any>(null);
    const [irradianceSnap, setIrradianceSnap] = useState<any>(null);
    const [incidentInfo, setIncidentInfo]   = useState<any>(null);

    // Auto-save: persist to localStorage when any field changes
    const updateField = (field: string, value: string) => {
        const next = { ...form, [field]: value };
        setForm(next);
        localStorage.setItem(DRAFT_KEY(missionId), JSON.stringify(next));
        setDraftSaved(false);
    };

    const saveDraft = () => {
        localStorage.setItem(DRAFT_KEY(missionId), JSON.stringify(form));
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
    };

    // Step 1 → 2: generate preview (AI report + weather, NO DB write)
    const handlePreview = async () => {
        setError(null);
        setGenerating(true);
        try {
            const res = await apiClient.post(`/pilot/secure/missions/${missionId}/daily-report/preview`, {
                ...form,
                reportDate: form.reportDate,
                missionsFlownCount: parseInt(form.missionsFlownCount) || 0,
                blocksCompleted:    parseInt(form.blocksCompleted) || 0,
                hoursWorked:        parseFloat(form.hoursWorked) || 0,
            });
            if (res.data.success) {
                setAiReport(res.data.aiReport || null);
                setWeatherSnap(res.data.weatherSnapshot || null);
                setIrradianceSnap(res.data.irradianceSnapshot || null);
                setIncidentInfo(res.data.incidentClassification || null);
                setStep('previewing');
            } else throw new Error(res.data.message);
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Preview failed');
        } finally {
            setGenerating(false);
        }
    };

    // Step 2 → 3: pilot approved — now save to DB
    const handleApproveAndSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await apiClient.post(`/pilot/secure/missions/${missionId}/daily-report`, {
                ...form,
                reportDate: form.reportDate,
                missionsFlownCount: parseInt(form.missionsFlownCount) || 0,
                blocksCompleted:    parseInt(form.blocksCompleted) || 0,
                hoursWorked:        parseFloat(form.hoursWorked) || 0,
                aiReportOverride: aiReport || undefined,
            });
            if (res.data.success) {
                localStorage.removeItem(DRAFT_KEY(missionId)); // clear draft on submit
                setAiReport(res.data.aiReport || aiReport);
                setWeatherSnap(res.data.weatherSnapshot || weatherSnap);
                setIrradianceSnap(res.data.irradianceSnapshot || irradianceSnap);
                setStep('submitted');
            } else throw new Error(res.data.message);
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const incidentColors: Record<string, string> = {
        critical: 'bg-red-100 text-red-800 border-red-300',
        high:     'bg-orange-100 text-orange-800 border-orange-300',
        medium:   'bg-yellow-100 text-yellow-800 border-yellow-300',
        low:      'bg-blue-100 text-blue-700 border-blue-200',
        none:     'bg-emerald-50 text-emerald-700 border-emerald-100',
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-violet-50 rounded-lg">
                            <FileText className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Daily Field Report</h3>
                            <p className="text-[10px] text-slate-400">
                                {step === 'form' ? (savedDraft ? '✏️ Draft loaded' : 'Auto-saved as you type') : step === 'previewing' ? '👁 Review before sending' : '✅ Submitted to admin'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors text-lg leading-none">&times;</button>
                </div>

                {/* ── STEP 1: Form ── */}
                {step === 'form' && (
                    <div className="p-6 space-y-4">
                        {/* Report Date */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                                Report Date <span className="normal-case font-normal text-slate-400">(change to backfill a missed day)</span>
                            </label>
                            <input type="date"
                                value={form.reportDate}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => updateField('reportDate', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Flights Flown</label>
                                <input type="number" min="0" value={form.missionsFlownCount}
                                    onChange={e => updateField('missionsFlownCount', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                    placeholder="0" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Blocks Completed</label>
                                <input type="number" min="0" value={form.blocksCompleted}
                                    onChange={e => updateField('blocksCompleted', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                    placeholder="0" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Hours Worked</label>
                            <input type="number" min="0" step="0.5" value={form.hoursWorked}
                                onChange={e => updateField('hoursWorked', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                placeholder="0.0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Issues Encountered</label>
                            <input type="text" value={form.issuesEncountered}
                                onChange={e => updateField('issuesEncountered', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                placeholder="Equipment, access, airspace..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Field Notes</label>
                            <textarea rows={4} value={form.notes}
                                onChange={e => updateField('notes', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                placeholder="Detailed field notes — add to this throughout the day..." />
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <p className="text-[10px] text-blue-600 font-medium">Weather &amp; solar irradiance will be automatically captured from your site location when you generate the preview.</p>
                        </div>

                        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={saveDraft}
                                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                                {draftSaved ? '✓ Saved' : '💾 Save Draft'}
                            </button>
                            <button type="button" onClick={handlePreview} disabled={generating}
                                className="py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm disabled:opacity-60 transition-all shadow-sm">
                                {generating ? 'Generating…' : '👁 Preview Report'}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center">Your report is saved automatically. You can close and return to finish later.</p>
                    </div>
                )}

                {/* ── STEP 1.5: Generating spinner ── */}
                {generating && (
                    <div className="p-10 text-center">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-700 font-bold text-sm">Generating AI Preview…</p>
                        <p className="text-slate-500 text-xs mt-1">Fetching site weather · solar irradiance · Gemini analysis</p>
                    </div>
                )}

                {/* ── STEP 2: Preview ── */}
                {step === 'previewing' && !generating && (
                    <div className="p-6 space-y-5">
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-center">
                            <p className="text-xs font-bold text-violet-700">Review your AI-generated report below, then approve to send to admin.</p>
                        </div>

                        {/* Incident badge */}
                        {incidentInfo?.severity && incidentInfo.severity !== 'none' && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${incidentColors[incidentInfo.severity] || incidentColors['none']}`}>
                                <span>⚠</span>
                                <span className="uppercase tracking-wide">{incidentInfo.severity} Severity Incident</span>
                                {incidentInfo.summary && <span className="font-normal ml-1">— {incidentInfo.summary}</span>}
                            </div>
                        )}

                        {/* Weather strip */}
                        {weatherSnap && (
                            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-3">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">📡 Auto-Captured Site Conditions</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="flex items-center gap-1.5"><Sun className="w-3 h-3 text-amber-500 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.temperature}°F</span></div>
                                    <div className="flex items-center gap-1.5"><Wind className="w-3 h-3 text-blue-400 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.wind_speed} mph</span></div>
                                    <div className="flex items-center gap-1.5"><Cloud className="w-3 h-3 text-cyan-400 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.precipitation} mm precip</span></div>
                                    <div className="flex items-center gap-1.5"><CloudLightning className="w-3 h-3 text-violet-400 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.conditions}</span></div>
                                    {irradianceSnap?.ghi_wm2 != null && (
                                        <div className="flex items-center gap-1.5 col-span-2">
                                            <Activity className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                            <span className="text-slate-600">GHI {irradianceSnap.ghi_wm2} W/m² · DNI {irradianceSnap.dni_wm2} W/m² · <span className="text-amber-600 font-semibold">{irradianceSnap.description}</span></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* AI Report — editable */}
                        {aiReport !== null ? (
                            <div className="border border-violet-100 rounded-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5 text-white/80" />
                                        <span className="text-xs font-bold text-white uppercase tracking-widest">AI Field Report</span>
                                    </div>
                                    <span className="text-[10px] text-white/60 font-medium">Editable — refine before submitting</span>
                                </div>
                                <textarea
                                    rows={8}
                                    value={aiReport}
                                    onChange={e => setAiReport(e.target.value)}
                                    className="w-full px-4 py-3 bg-white text-xs text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-y"
                                />
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 text-center italic">AI report generation timed out — your data will still be saved.</p>
                        )}

                        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setStep('form')}
                                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                                ← Back to Edit
                            </button>
                            <button type="button" onClick={handleApproveAndSubmit} disabled={submitting}
                                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm disabled:opacity-60 transition-all shadow-sm">
                                {submitting ? 'Submitting…' : '✓ Approve & Submit'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Submitted ── */}
                {step === 'submitted' && (
                    <div className="p-6 space-y-5">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-7 h-7 text-emerald-500" />
                            </div>
                            <h4 className="text-slate-800 font-bold">Report Sent to Admin</h4>
                            <p className="text-slate-500 text-xs mt-0.5">Your field report and AI analysis are now in the admin mission log.</p>
                        </div>

                        {weatherSnap && (
                            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-3">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Captured Site Conditions</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="flex items-center gap-1.5"><Sun className="w-3 h-3 text-amber-500 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.temperature}°F</span></div>
                                    <div className="flex items-center gap-1.5"><Wind className="w-3 h-3 text-blue-400 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.wind_speed} mph</span></div>
                                    <div className="flex items-center gap-1.5"><Cloud className="w-3 h-3 text-cyan-400 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.precipitation} mm</span></div>
                                    <div className="flex items-center gap-1.5"><CloudLightning className="w-3 h-3 text-violet-400 flex-shrink-0" /><span className="text-slate-600">{weatherSnap.conditions}</span></div>
                                </div>
                            </div>
                        )}
                        {aiReport && (
                            <div className="border border-violet-100 rounded-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5">
                                    <span className="text-xs font-bold text-white uppercase tracking-widest">AI Field Report</span>
                                </div>
                                <div className="p-4 bg-white max-h-40 overflow-y-auto">
                                    {aiReport.split('\n\n').filter(Boolean).map((para, i) => (
                                        <p key={i} className={`text-xs text-slate-700 leading-relaxed ${i > 0 ? 'mt-3' : ''}`}>{para}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const MissionCard: React.FC<{
    mission: AssignedMission;
    onDailyReport: () => void;
}> = ({ mission, onDailyReport }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [hourly, setHourly] = useState<HourlySlot[]>([]);
    const [weatherLocation, setWeatherLocation] = useState<{ city?: string; state?: string } | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [assignments, setAssignments] = useState<any[] | null>(null);

    useEffect(() => {
        setWeatherLoading(true);
        apiClient.get(`/pilot/secure/missions/${mission.id}/weather`)
            .then(r => {
                if (r.data.success) {
                    setWeather(r.data.weather || null);
                    setHourly(r.data.hourly || []);
                    setWeatherLocation(r.data.location || null);
                }
            })
            .catch(() => { })
            .finally(() => setWeatherLoading(false));
    }, [mission.id]);

    useEffect(() => {
        if (!expanded || assignments !== null) return;
        apiClient.get(`/pilot/secure/missions/${mission.id}/assignments`)
            .then(r => setAssignments(r.data.data || []))
            .catch(() => setAssignments([]));
    }, [expanded, mission.id]);

    const handleKMLDownload = async () => {
        try {
            const token = localStorage.getItem('skylens_token');
            const response = await fetch(`/api/pilot/secure/missions/${mission.id}/kml`, {
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: 'KML download failed' }));
                return alert(errData.message || 'KML download failed');
            }
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('json')) {
                // Backend returned a redirect URL
                const data = await response.json();
                if (data.downloadUrl) {
                    window.open(data.downloadUrl, '_blank');
                } else {
                    alert(data.message || 'KML file not available for this mission.');
                }
            } else {
                // Backend is streaming the file directly — save it as a blob download
                const blob = await response.blob();
                const disposition = response.headers.get('content-disposition') || '';
                const nameMatch = disposition.match(/filename="(.+?)"/);
                const fileName = nameMatch ? decodeURIComponent(nameMatch[1]) : `mission-kml-${mission.id.split('-')[0]}.kml`;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            alert('KML download failed: ' + (e?.message || 'Unknown error'));
        }
    };

    const handleParamsDownload = async () => {
        try {
            const res = await apiClient.get(`/pilot/secure/missions/${mission.id}/parameters`);
            if (res.data.success) {
                const { operationalBrief: ob, flightParameters: fp, kmlFiles } = res.data;
                const lines = [
                    `AXIS PILOT SYSTEM — MISSION OPERATIONAL BRIEF`,
                    `===============================================`,
                    `Generated: ${new Date().toLocaleString()}`,
                    ``,
                    `MISSION DETAILS`,
                    `--------------`,
                    `Mission:       ${ob?.missionName || 'N/A'}`,
                    `Type:          ${ob?.type || 'N/A'}`,
                    `Status:        ${ob?.status || 'N/A'}`,
                    `Site:          ${ob?.siteName || 'N/A'}`,
                    `Location:      ${ob?.locationCity || 'N/A'}`,
                    `Date:          ${ob?.missionDate || 'N/A'}`,
                    `Days On-Site:  ${ob?.daysOnSite || 'N/A'}`,
                    `Industry:      ${ob?.industryType || 'N/A'}`,
                    `Notes:         ${ob?.operationalNotes || 'None'}`,
                    ``,
                    `FLIGHT PARAMETERS`,
                    `-----------------`,
                ];
                if (fp) {
                    if (fp.flightAltitudeMeters) lines.push(`Altitude:         ${fp.flightAltitudeMeters}m`);
                    if (fp.missionAreaAcres)     lines.push(`Mission Area:     ${fp.missionAreaAcres} acres`);
                    if (fp.waypointCount)        lines.push(`Waypoints:        ${fp.waypointCount}`);
                    if (fp.overlapPercent)       lines.push(`Overlap:          ${fp.overlapPercent}%`);
                    if (fp.safetyNotes)          lines.push(`Safety Notes:     ${fp.safetyNotes}`);
                    if (fp.onSiteContact)        lines.push(`On-Site Contact:  ${fp.onSiteContact}`);
                    if (fp.additionalParams)     lines.push(`Additional:       ${JSON.stringify(fp.additionalParams)}`);
                } else {
                    lines.push(`No flight parameters on file.`);
                }
                if (kmlFiles?.length > 0) {
                    lines.push(``, `ATTACHED KML FILES`, `------------------`);
                    kmlFiles.forEach((f: any) => lines.push(`• ${f.name} (${((f.size || 0) / 1024).toFixed(1)} KB)`));
                }
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mission-params-${mission.id.split('-')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Parameters download failed');
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            Array.from(files).forEach(f => formData.append('files', f));
            const res = await apiClient.post(
                `/pilot/secure/missions/${mission.id}/upload`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            if (res.data.success) {
                alert(`${res.data.files?.filter((f: any) => f.success).length || 0} file(s) uploaded successfully`);
            }
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const siteName = mission.site_name || mission.sites?.name || 'Unknown Site';
    const location = mission.location || mission.sites?.location || '';
    const cityOnly = location.split(',')[0]?.trim();
    const statusColor = STATUS_COLORS[mission.status] || STATUS_COLORS['on_hold'];

    return (
        <div className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${expanded ? 'border-blue-500/60' : 'border-slate-700'}`}>
            {/* Mission header */}
            <div
                className="px-5 py-4 cursor-pointer hover:bg-slate-800/60 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor}`}>
                                {mission.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {mission.industry_key && (
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">{mission.industry_key}</span>
                            )}
                        </div>
                        {/* Project / site name — shown as primary context */}
                        {(mission.project_name || siteName) && (
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.15em] mb-0.5">
                                📁 {mission.project_name || siteName}
                            </p>
                        )}
                        <h3 className="font-bold text-slate-100 text-sm leading-tight truncate">
                            {mission.title || siteName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1.5 text-slate-500 text-xs">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span>{cityOnly || location || 'Location not set'}</span>
                        </div>
                        {(mission.date || mission.due_date) && (
                            <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                <span>{mission.date || mission.due_date}</span>
                            </div>
                        )}
                    </div>

                    {/* Weather snapshot — header strip */}
                    <div className="flex-shrink-0 text-right min-w-[90px]">
                        {weatherLoading ? (
                            <div className="flex items-center gap-1 justify-end text-xs text-slate-400">
                                <Loader2 className="w-3 h-3 animate-spin" /> fetching...
                            </div>
                        ) : weather ? (
                            <div className="text-xs text-slate-500 space-y-0.5">
                                {/* Flight status badge */}
                                {weather.flight_status && (
                                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full text-center mb-1 ${
                                        weather.flight_status === 'GO'      ? 'bg-emerald-100 text-emerald-700' :
                                        weather.flight_status === 'CAUTION' ? 'bg-amber-100 text-amber-700' :
                                                                               'bg-red-100 text-red-700'
                                    }`}>
                                        {weather.flight_status === 'GO' ? '✅ GO' : weather.flight_status === 'CAUTION' ? '⚠️ CAUTION' : '🚫 NO-GO'}
                                    </div>
                                )}
                                <div className="flex items-center gap-1 justify-end">
                                    <Sun className="w-3 h-3 text-amber-500" />
                                    <span className="text-slate-800 font-bold">{weather.temperature}°F</span>
                                    <span className="text-slate-400">/ {weather.feels_like}°</span>
                                </div>
                                <div className="flex items-center gap-1 justify-end">
                                    <Wind className="w-3 h-3 text-blue-400" />
                                    <span>{weather.wind_speed} mph</span>
                                    {weather.wind_gusts ? <span className="text-slate-400">↑{weather.wind_gusts}</span> : null}
                                </div>
                                <div className="text-[10px] text-slate-400 text-right">
                                    {weatherCodeEmoji(weather.weather_code)} {weatherCodeLabel(weather.weather_code)}
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-300 text-right">
                                <Cloud className="w-4 h-4 mx-auto mb-0.5 opacity-40" />
                                No coords
                            </div>
                        )}
                        <ChevronRight className={`w-4 h-4 text-slate-400 mx-auto mt-2 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </div>
                </div>
            </div>

            {/* Expanded: Weather Panel + Mission Actions */}
            {expanded && (
                <div className="border-t border-slate-700/60 bg-slate-900/80 px-5 py-4 space-y-4">
                    {/* Expanded: Full Weather Panel — always shown */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Weather at Site</h4>
                            {weatherLocation?.city && (
                                <span className="text-[10px] text-slate-400">
                                    📍 {weatherLocation.city}{weatherLocation.state ? `, ${weatherLocation.state}` : ''}
                                </span>
                            )}
                        </div>

                        {/* Loading state */}
                        {weatherLoading && (
                            <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-xs font-medium">Fetching live weather data...</span>
                            </div>
                        )}

                        {/* No coordinates / no data */}
                        {!weatherLoading && !weather && (
                            <div className="bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-5 text-center">
                                <Cloud className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-300">No GPS coordinates on this mission</p>
                                <p className="text-[10px] text-slate-500 mt-1">Ask your admin to add latitude/longitude to the deployment to enable live weather.</p>
                            </div>
                        )}

                        {/* Full weather panel */}
                        {!weatherLoading && weather && (
                            <>
                            {/* Flight Status Banner */}
                            {weather.flight_status && (
                                <div className={`rounded-xl px-4 py-3 border flex items-start gap-3 ${
                                    weather.flight_status === 'GO'     ? 'bg-emerald-50  border-emerald-200' :
                                    weather.flight_status === 'CAUTION'? 'bg-amber-50    border-amber-200'   :
                                                                          'bg-red-50      border-red-200'
                                }`}>
                                    <span className="text-2xl leading-none flex-shrink-0">
                                        {weather.flight_status === 'GO' ? '✅' : weather.flight_status === 'CAUTION' ? '⚠️' : '🚫'}
                                    </span>
                                    <div>
                                        <p className={`text-xs font-black uppercase tracking-widest ${
                                            weather.flight_status === 'GO' ? 'text-emerald-700' :
                                            weather.flight_status === 'CAUTION' ? 'text-amber-700' : 'text-red-700'
                                        }`}>
                                            {weather.flight_status === 'GO' ? 'GO — Conditions Favorable for Flight' :
                                             weather.flight_status === 'CAUTION' ? 'CAUTION — Review Conditions Before Flying' :
                                             'NO-GO — Unsafe Flight Conditions'}
                                        </p>
                                        {(weather.flight_reasons || []).map((r, i) => (
                                            <p key={i} className="text-[10px] mt-0.5 text-slate-600">• {r}</p>
                                        ))}
                                        {weather.flight_status === 'GO' && (
                                            <p className="text-[10px] mt-0.5 text-slate-500">All monitored conditions within FAA Part 107 limits</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Hero: Temp + Condition */}
                            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl px-5 py-4 text-white flex items-center justify-between">
                                <div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-4xl font-black">{weather.temperature ?? '—'}°F</span>
                                        <span className="text-slate-400 text-sm mb-1 font-medium">Feels {weather.feels_like ?? '—'}°F</span>
                                    </div>
                                    <p className="text-slate-300 text-sm font-semibold mt-0.5">
                                        {weatherCodeEmoji(weather.weather_code)} {weatherCodeLabel(weather.weather_code)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl">{weatherCodeEmoji(weather.weather_code)}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Live Conditions</p>
                                </div>
                            </div>

                            {/* 8-tile Detail Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {/* Wind */}
                                <div className="col-span-2 bg-white border border-blue-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">💨 Wind</p>
                                    <p className="text-base font-black text-slate-800">{weather.wind_speed ?? '—'} <span className="text-xs font-bold text-slate-500">mph</span></p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        Gusts {weather.wind_gusts ?? '—'} mph
                                        {weather.wind_direction ? ` · ${weather.wind_direction}` : ''}
                                        {weather.wind_bearing !== undefined ? ` (${weather.wind_bearing}°)` : ''}
                                    </p>
                                </div>
                                {/* Humidity */}
                                <div className="bg-white border border-cyan-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">💧 Humidity</p>
                                    <p className="text-base font-black text-slate-800">{weather.humidity ?? '—'}<span className="text-xs font-bold text-slate-500">%</span></p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Dew {weather.dew_point ?? '—'}°F</p>
                                </div>
                                {/* UV */}
                                <div className="bg-white border border-amber-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">☀️ UV Index</p>
                                    <p className={`text-base font-black ${uvLabel(weather.uv_index ?? 0).color}`}>{weather.uv_index ?? '—'}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{uvLabel(weather.uv_index ?? 0).label}</p>
                                </div>
                                {/* Cloud Cover */}
                                <div className="bg-white border border-slate-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">☁️ Cloud Cover</p>
                                    <p className="text-base font-black text-slate-800">{weather.cloud_cover ?? '—'}<span className="text-xs font-bold text-slate-500">%</span></p>
                                    <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-400 rounded-full" style={{ width: `${weather.cloud_cover ?? 0}%` }} />
                                    </div>
                                </div>
                                {/* Visibility */}
                                <div className="bg-white border border-emerald-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">👁 Visibility</p>
                                    <p className={`text-base font-black ${
                                        (weather.visibility_mi ?? 10) < 3 ? 'text-red-600' :
                                        (weather.visibility_mi ?? 10) < 5 ? 'text-amber-600' : 'text-slate-800'
                                    }`}>{weather.visibility_mi ?? '—'} <span className="text-xs font-bold text-slate-500">mi</span></p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Min 3 mi (FAA)</p>
                                </div>
                                {/* Precipitation */}
                                <div className="bg-white border border-blue-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">🌧 Precip</p>
                                    <p className={`text-base font-black ${ (weather.precipitation ?? 0) > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                        {weather.precipitation ?? 0} <span className="text-xs font-bold text-slate-500">mm</span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{(weather.precipitation ?? 0) > 0 ? 'Active' : 'None'}</p>
                                </div>
                                {/* Pressure */}
                                <div className="bg-white border border-violet-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">🧭 Pressure</p>
                                    <p className="text-base font-black text-slate-800">{weather.pressure_hpa ?? '—'}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">hPa</p>
                                </div>
                                {/* Solar */}
                                <div className="bg-white border border-yellow-100 rounded-xl px-3 py-3">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">⚡ Solar</p>
                                    <p className="text-base font-black text-slate-800">{weather.solar_radiation ?? '—'}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">W/m²</p>
                                </div>
                            </div>

                            {/* 6-Hour Hourly Forecast */}
                            {hourly.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">6-Hour Forecast</p>
                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                                        {hourly.map((h, i) => (
                                            <div key={i} className="bg-white border border-slate-100 rounded-xl px-2 py-2 text-center">
                                                <p className="text-[9px] text-slate-400 font-bold">
                                                    {new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}
                                                </p>
                                                <p className="text-sm my-1">{weatherCodeEmoji(h.code)}</p>
                                                <p className="text-xs font-black text-slate-800">{h.temp}°</p>
                                                <p className="text-[9px] text-blue-600 font-bold mt-0.5">💨 {h.wind}</p>
                                                {h.precip_prob > 0 && (
                                                    <p className="text-[9px] text-sky-600 font-bold">🌧 {h.precip_prob}%</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            </>
                        )}
                    </div>
                    {/* Assigned Work — KML Files + LBD Blocks */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">My Assigned Work</h4>
                        {assignments === null ? (
                            <p className="text-xs text-slate-400 italic animate-pulse">Loading assignments...</p>
                        ) : assignments.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No files or blocks assigned to you yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {assignments.filter(a => a.assignment_type !== 'lbd').length > 0 && (
                                    <div className="bg-slate-800/80 border border-cyan-700/30 rounded-xl overflow-hidden">
                                        <div className="px-3 py-1.5 bg-cyan-900/30 border-b border-cyan-700/30">
                                            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">📍 KML / Files</span>
                                        </div>
                                        <div className="divide-y divide-slate-700/30">
                                            {assignments.filter(a => a.assignment_type !== 'lbd').map(a => (
                                                <div key={a.id} className="flex items-center justify-between px-3 py-2">
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-200">{a.file_name || 'File'}</p>
                                                        {a.notes && <p className="text-[10px] text-slate-400">{a.notes}</p>}
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const token = localStorage.getItem('skylens_token');
                                                                const resp = await fetch(`/api/deployments/${mission.id}/files/${a.file_id}/download`, {
                                                                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                                                                });
                                                                if (!resp.ok) { if (a.file_url) { window.open(a.file_url, '_blank'); return; } return alert('Download failed'); }
                                                                const blob = await resp.blob();
                                                                const url = URL.createObjectURL(blob);
                                                                const anchor = document.createElement('a');
                                                                anchor.href = url; anchor.download = a.file_name || 'file';
                                                                anchor.click(); URL.revokeObjectURL(url);
                                                            } catch { if (a.file_url) window.open(a.file_url, '_blank'); }
                                                        }}
                                                        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                                                    ><Download className="w-3 h-3" /> Download</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {assignments.filter(a => a.assignment_type === 'lbd').length > 0 && (
                                    <div className="bg-slate-800/80 border border-amber-700/30 rounded-xl overflow-hidden">
                                        <div className="px-3 py-1.5 bg-amber-900/30 border-b border-amber-700/30">
                                            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">⚡ LBD Blocks</span>
                                        </div>
                                        <div className="divide-y divide-slate-700/30">
                                            {assignments.filter(a => a.assignment_type === 'lbd').map(a => (
                                                <div key={a.id} className="flex items-center justify-between px-3 py-2">
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-200">{a.asset_name || 'Block'}</p>
                                                        {a.asset_key && <p className="text-[10px] text-slate-400 font-mono">{a.asset_key}</p>}
                                                        {a.notes && <p className="text-[10px] text-slate-400 italic">{a.notes}</p>}
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.asset_status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {a.asset_status || '—'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Operational Protocols */}
                    <PilotProtocolsPanel missionId={mission.id} />

                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Mission Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {/* Download KML */}
                        <button
                            onClick={handleKMLDownload}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-900/30 hover:border-cyan-400/60 transition-all shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download KML
                        </button>

                        {/* Download Parameters */}
                        <button
                            onClick={handleParamsDownload}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-violet-500/40 text-violet-300 text-xs font-bold hover:bg-violet-900/30 hover:border-violet-400/60 transition-all shadow-sm"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Parameters
                        </button>

                        {/* Upload Flight Data */}
                        <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-900/30 hover:border-emerald-400/60 transition-all shadow-sm ${uploading ? 'opacity-60' : ''}`}>
                            <Upload className="w-3.5 h-3.5" />
                            {uploading ? 'Uploading...' : 'Upload Data'}
                            <input
                                type="file" multiple className="hidden"
                                disabled={uploading}
                                accept=".jpg,.jpeg,.png,.webp,.tiff,.heic,.mp4,.mov,.kml,.kmz,.zip,.csv,.xls,.xlsx,.pdf,.las,.laz"
                                onChange={handleUpload}
                            />
                        </label>

                        {/* Daily Report */}
                        <button
                            onClick={onDailyReport}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-900/30 hover:border-amber-400/60 transition-all shadow-sm"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Daily Report
                        </button>
                    </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PilotDashboardV2: React.FC = () => {
    const { user } = useAuth();
    const [missions, setMissions] = useState<AssignedMission[]>([]);
    const [perf, setPerf] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [reportMissionId, setReportMissionId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [missRes, perfRes] = await Promise.allSettled([
                apiClient.get('/pilot/secure/missions'),      // ← /secure/ join via deployment_personnel
                apiClient.get('/pilot/secure/me/performance'),
            ]);

            if (missRes.status === 'fulfilled' && missRes.value.data.success) {
                const raw = missRes.value.data.data || [];
                setMissions(raw);
            }

            if (perfRes.status === 'fulfilled' && perfRes.value.data.success) {
                setPerf(perfRes.value.data.performance);
            }
        } catch (e) {
            console.error('[PilotDashboard] load error', e);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { load(); }, [load]);

    const firstName = (user as any)?.fullName?.split(' ')[0] || (user as any)?.full_name?.split(' ')[0] || 'Pilot';

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-400 rounded-full animate-spin" />
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Loading...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 pb-32 pt-14 md:pt-0 md:pb-24">
            {/* Header — matches admin dashboard page header style */}
            <div className="bg-slate-900 border-b border-slate-700 px-6 py-5 shadow-2xl">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Plane className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Axis Pilot Terminal</span>
                        </div>
                        <h1 className="text-2xl font-black text-white">
                            {firstName}
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {missions.length} active assignment{missions.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={load}
                        className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-all"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4 text-slate-300" />
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">

                {/* ── Section 1: My Assigned Missions ──────────────────────── */}
                <section>
                    {/* Section header — matches admin dashboard section header with accent rule */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-blue-400 rounded-full" />
                        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5" />
                            My Assigned Missions
                        </h2>
                    </div>

                    {missions.length === 0 ? (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-10 text-center">
                            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                                <CheckSquare className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-slate-200 font-semibold text-sm">No missions currently assigned</p>
                            <p className="text-slate-500 text-xs mt-1">Await new dispatch from command</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {missions.map(mission => (
                                <MissionCard
                                    key={mission.id}
                                    mission={mission}
                                    onDailyReport={() => setReportMissionId(mission.id)}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Section 2: My Performance Snapshot ───────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 bg-blue-400 rounded-full" />
                        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5" />
                            My Performance Snapshot
                        </h2>
                    </div>

                    {perf ? (
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Total Assigned', value: perf.totalMissionsAssigned.toString(), icon: <Activity className="w-4 h-4" />, accent: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
                                { label: 'Completed', value: perf.missionsCompleted.toString(), icon: <CheckCircle className="w-4 h-4" />, accent: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                                { label: 'In Progress', value: perf.missionsInProgress.toString(), icon: <Clock className="w-4 h-4" />, accent: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                                { label: 'Completion Rate', value: `${perf.completionPercentage}%`, icon: <Target className="w-4 h-4" />, accent: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                                { label: 'Avg Daily Rate', value: perf.avgDailyCompletionRate > 0 ? `${perf.avgDailyCompletionRate}%` : '–', icon: <TrendingUp className="w-4 h-4" />, accent: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                                { label: 'Active Days', value: perf.totalActiveDays.toString(), icon: <Calendar className="w-4 h-4" />, accent: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
                            ].map(stat => (
                                <div key={stat.label} className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 shadow-sm">
                                    <div className={`inline-flex items-center gap-1.5 mb-3 px-2 py-1 rounded-lg ${stat.bg} border ${stat.border}`}>
                                        <span className={stat.accent}>{stat.icon}</span>
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${stat.accent}`}>{stat.label}</span>
                                    </div>
                                    <div className="text-2xl font-black text-white">{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-centerow-sm">
                            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                                <BarChart3 className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-slate-300 text-sm font-medium">No performance data yet</p>
                            <p className="text-slate-500 text-xs mt-1">Performance data will appear after your first mission logs are submitted.</p>
                        </div>
                    )}

                    {/* Zero financial disclosure notice */}
                    <p className="text-[10px] text-slate-600 text-center mt-3">
                        Performance metrics shown are operational only. Financial data is not accessible through pilot accounts.
                    </p>
                </section>
            </div>

            {/* Daily Report Modal */}
            {reportMissionId && (
                <DailyReportModal
                    missionId={reportMissionId}
                    onClose={() => setReportMissionId(null)}
                />
            )}
        </div>
    );
};

export default PilotDashboardV2;
