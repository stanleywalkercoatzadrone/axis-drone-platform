import React, { useState } from 'react';
import { FileText, Cloud, CheckCircle, Sun, Wind, CloudLightning, Activity } from 'lucide-react';
import apiClient from '../../../services/apiClient';

export const DRAFT_KEY = (missionId: string) => `daily_report_draft_${missionId}`;

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
        critical: 'bg-red-500/10 text-red-400 border-red-500/30',
        high:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
        medium:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
        low:      'bg-blue-500/10 text-blue-400 border-blue-500/30',
        none:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-slate-900/90 border border-slate-700/50 rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl backdrop-blur-2xl">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-800/60 flex items-center justify-between sticky top-0 bg-slate-900/90 backdrop-blur-2xl z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                            <FileText className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight">Daily Field Report</h3>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">
                                {step === 'form' ? (savedDraft ? '✏️ Draft loaded' : 'Auto-saved as you type') : step === 'previewing' ? '👁 Review before sending' : '✅ Submitted to admin'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-all text-xl leading-none">&times;</button>
                </div>

                {/* ── STEP 1: Form ── */}
                {step === 'form' && (
                    <div className="p-6 space-y-5">
                        {/* Report Date */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                                Report Date <span className="font-normal text-slate-600">(change to backfill a missed day)</span>
                            </label>
                            <input type="date"
                                value={form.reportDate}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => updateField('reportDate', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Flights Flown</label>
                                <input type="number" min="0" value={form.missionsFlownCount}
                                    onChange={e => updateField('missionsFlownCount', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                    placeholder="0" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Blocks Completed</label>
                                <input type="number" min="0" value={form.blocksCompleted}
                                    onChange={e => updateField('blocksCompleted', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                    placeholder="0" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Hours Worked</label>
                            <input type="number" min="0" step="0.5" value={form.hoursWorked}
                                onChange={e => updateField('hoursWorked', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                placeholder="0.0" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Issues Encountered</label>
                            <input type="text" value={form.issuesEncountered}
                                onChange={e => updateField('issuesEncountered', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                placeholder="Equipment, access, airspace..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Field Notes</label>
                            <textarea rows={4} value={form.notes}
                                onChange={e => updateField('notes', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                placeholder="Detailed field notes — add to this throughout the day..." />
                        </div>

                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3">
                            <Cloud className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                            <p className="text-xs text-indigo-200 leading-relaxed">Weather &amp; solar irradiance will be automatically captured from your site location when you generate the preview.</p>
                        </div>

                        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">{error}</p>}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button type="button" onClick={saveDraft}
                                className="py-3.5 rounded-2xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-black uppercase tracking-widest transition-all">
                                {draftSaved ? '✓ Saved' : '💾 Save Draft'}
                            </button>
                            <button type="button" onClick={handlePreview} disabled={generating}
                                className="py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60 transition-all shadow-lg shadow-indigo-500/20">
                                {generating ? 'Generating…' : '👁 Preview'}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 text-center font-bold">Your report is saved automatically. You can close and return to finish later.</p>
                    </div>
                )}

                {/* ── STEP 1.5: Generating spinner ── */}
                {generating && (
                    <div className="p-12 text-center">
                        <div className="w-14 h-14 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6" />
                        <p className="text-white font-black text-sm uppercase tracking-widest">Generating AI Preview…</p>
                        <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mt-2">Fetching site weather · solar irradiance · Gemini analysis</p>
                    </div>
                )}

                {/* ── STEP 2: Preview ── */}
                {step === 'previewing' && !generating && (
                    <div className="p-6 space-y-6">
                        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-indigo-300">Review your AI-generated report below, then approve to send to admin.</p>
                        </div>

                        {/* Incident badge */}
                        {incidentInfo?.severity && incidentInfo.severity !== 'none' && (
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest ${incidentColors[incidentInfo.severity] || incidentColors['none']}`}>
                                <span>⚠</span>
                                <span>{incidentInfo.severity} Severity Incident</span>
                                {incidentInfo.summary && <span className="font-normal tracking-normal ml-1 text-white/80">— {incidentInfo.summary}</span>}
                            </div>
                        )}

                        {/* Weather strip */}
                        {weatherSnap && (
                            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-5">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">📡 Auto-Captured Site Conditions</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                                    <div className="flex items-center gap-2"><Sun className="w-4 h-4 text-amber-500 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.temperature}°F</span></div>
                                    <div className="flex items-center gap-2"><Wind className="w-4 h-4 text-blue-400 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.wind_speed} mph</span></div>
                                    <div className="flex items-center gap-2"><Cloud className="w-4 h-4 text-cyan-400 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.precipitation} mm precip</span></div>
                                    <div className="flex items-center gap-2"><CloudLightning className="w-4 h-4 text-indigo-400 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.conditions}</span></div>
                                    {irradianceSnap?.ghi_wm2 != null && (
                                        <div className="flex items-center gap-2 col-span-2 pt-2 border-t border-slate-700/50 mt-1">
                                            <Activity className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                            <span className="text-slate-400 font-bold">GHI <span className="text-white">{irradianceSnap.ghi_wm2} W/m²</span> · DNI <span className="text-white">{irradianceSnap.dni_wm2} W/m²</span> · <span className="text-amber-500">{irradianceSnap.description}</span></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* AI Report — editable */}
                        {aiReport !== null ? (
                            <div className="border border-indigo-500/30 rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                                <div className="bg-indigo-600/20 backdrop-blur-md px-5 py-3 flex items-center justify-between border-b border-indigo-500/30">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-black text-indigo-100 uppercase tracking-widest">AI Field Report</span>
                                    </div>
                                    <span className="text-[9px] text-indigo-300 uppercase tracking-widest font-bold">Editable</span>
                                </div>
                                <textarea
                                    rows={8}
                                    value={aiReport}
                                    onChange={e => setAiReport(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-900 text-sm text-slate-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y font-medium"
                                />
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 text-center italic font-bold">AI report generation timed out — your data will still be saved.</p>
                        )}

                        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">{error}</p>}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button type="button" onClick={() => setStep('form')}
                                className="py-3.5 rounded-2xl border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-black uppercase tracking-widest transition-all">
                                ← Back
                            </button>
                            <button type="button" onClick={handleApproveAndSubmit} disabled={submitting}
                                className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/20">
                                {submitting ? 'Submitting…' : '✓ Approve'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Submitted ── */}
                {step === 'submitted' && (
                    <div className="p-8 space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h4 className="text-white font-black text-lg uppercase tracking-tight">Report Sent</h4>
                            <p className="text-slate-400 text-xs mt-1 font-bold">Your field report and AI analysis are now in the admin mission log.</p>
                        </div>

                        {weatherSnap && (
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Captured Site Conditions</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <div className="flex items-center gap-2"><Sun className="w-4 h-4 text-amber-500 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.temperature}°F</span></div>
                                    <div className="flex items-center gap-2"><Wind className="w-4 h-4 text-blue-400 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.wind_speed} mph</span></div>
                                    <div className="flex items-center gap-2"><Cloud className="w-4 h-4 text-cyan-400 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.precipitation} mm</span></div>
                                    <div className="flex items-center gap-2"><CloudLightning className="w-4 h-4 text-indigo-400 flex-shrink-0" /><span className="text-slate-300 font-bold">{weatherSnap.conditions}</span></div>
                                </div>
                            </div>
                        )}
                        {aiReport && (
                            <div className="border border-slate-700/50 rounded-2xl overflow-hidden">
                                <div className="bg-slate-800/80 px-4 py-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Field Report</span>
                                </div>
                                <div className="p-4 bg-slate-900 max-h-40 overflow-y-auto">
                                    {aiReport.split('\n\n').filter(Boolean).map((para, i) => (
                                        <p key={i} className={`text-xs text-slate-400 font-medium leading-relaxed ${i > 0 ? 'mt-3' : ''}`}>{para}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReportModal;
