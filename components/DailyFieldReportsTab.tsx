import React, { useState, useEffect, useRef } from 'react';
import { FileText, Loader2, CloudSun, AlertTriangle, ChevronDown, ChevronUp, Plane, Clock, Layers, User, Thermometer, Wind, Sun, Download, Printer, Trash2 } from 'lucide-react';
import apiClient from '../src/services/apiClient';

interface FieldReport {
    id: string;
    date: string;
    pilotName: string;
    pilotEmail: string | null;
    missionsFlown: number;
    blocksCompleted: number;
    hoursWorked: number;
    issuesEncountered: string | null;
    weatherConditionsReported: string | null;
    aiReport: string | null;
    weatherSnapshot: {
        tempMin?: number; tempMax?: number; avgWindSpeed?: number;
        totalPrecipitation?: number; conditions: string;
        hourlyConditions?: string; temperature?: number;
        wind_speed?: number; precipitation?: number;
    } | null;
    irradianceSnapshot: {
        peakGhi_wm2?: number | null; avgGhi_wm2?: number | null;
        totalEnergy_wh?: number | null; description: string; ghi_wm2?: number | null;
    } | null;
    isIncident: boolean;
    incidentSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    incidentSummary: string | null;
    createdAt: string;
}

interface Props { deploymentId: string; missionTitle?: string; }

const incidentBadge = (severity: string) => {
    const map: Record<string, string> = {
        critical: 'bg-red-900/40 text-red-300 border border-red-700',
        high:     'bg-orange-900/40 text-orange-300 border border-orange-700',
        medium:   'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
        low:      'bg-blue-900/40 text-blue-300 border border-blue-700',
    };
    return map[severity] || 'bg-slate-700 text-slate-300';
};

const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
};

// ── CSV Export ─────────────────────────────────────────────────────────────────
// ── Shared print HTML builder ──────────────────────────────────────────────────
function buildPrintHTML(reports: FieldReport[], missionTitle: string) {
    const totalF = reports.reduce((s,r) => s + (parseFloat(String(r.missionsFlown))||0), 0);
    const totalB = reports.reduce((s,r) => s + (parseFloat(String(r.blocksCompleted))||0), 0);
    const totalH = reports.reduce((s,r) => s + (parseFloat(String(r.hoursWorked))||0), 0);
    const inc    = reports.filter(r => r.isIncident).length;

    const cards = reports.map(r => `
        <div class="report-card ${r.isIncident ? 'incident' : ''}">
            <div class="report-header">
                <div>
                    <div class="report-date">${fmt(r.date)}</div>
                    <div class="report-pilot">👤 ${r.pilotName || 'Unknown Pilot'}</div>
                </div>
                <div class="report-metrics">
                    <span>✈ ${parseFloat(String(r.missionsFlown))||0} flights</span>
                    <span>▦ ${parseFloat(String(r.blocksCompleted))||0} blocks</span>
                    <span>⏱ ${parseFloat(String(r.hoursWorked))||0}h</span>
                    ${r.isIncident ? `<span class="badge-incident">⚠ ${(r.incidentSeverity||'').toUpperCase()}</span>` : '<span class="badge-ok">✓ Normal</span>'}
                </div>
            </div>
            ${r.weatherSnapshot ? `<div class="section"><strong>Weather:</strong> ${r.weatherSnapshot.conditions}${r.weatherSnapshot.tempMin !== undefined ? ` · ${r.weatherSnapshot.tempMin}–${r.weatherSnapshot.tempMax}°F · ${r.weatherSnapshot.avgWindSpeed} mph` : ''}</div>` : ''}
            ${r.weatherConditionsReported ? `<div class="section"><strong>Pilot Weather Note:</strong> ${r.weatherConditionsReported}</div>` : ''}
            ${r.aiReport ? `<div class="section ai-report"><strong>AI Field Report:</strong><p>${r.aiReport.replace(/\n/g, '<br>')}</p></div>` : ''}
            ${r.isIncident && r.incidentSummary ? `<div class="section incident-box"><strong>Incident — ${(r.incidentSeverity||'').toUpperCase()}:</strong><p>${r.incidentSummary}</p></div>` : ''}
            ${r.issuesEncountered && !r.isIncident ? `<div class="section"><strong>Issues:</strong> ${r.issuesEncountered}</div>` : ''}
        </div>
    `).join('');

    return `
        <style>
            #axis-print-root * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',Arial,sans-serif; }
            #axis-print-root { color:#1e293b; background:#fff; padding:32px; }
            #axis-print-root .page-title { font-size:22px; font-weight:800; color:#0f172a; border-bottom:3px solid #0ea5e9; padding-bottom:12px; margin-bottom:8px; }
            #axis-print-root .page-meta { font-size:12px; color:#64748b; margin-bottom:24px; }
            #axis-print-root .summary-bar { display:flex; gap:20px; background:#f1f5f9; border-radius:8px; padding:14px 20px; margin-bottom:24px; font-size:13px; }
            #axis-print-root .summary-bar strong { font-size:18px; display:block; color:#0f172a; }
            #axis-print-root .report-card { border:1px solid #e2e8f0; border-radius:10px; padding:20px; margin-bottom:20px; page-break-inside:avoid; }
            #axis-print-root .report-card.incident { border-color:#f97316; background:#fff7ed; }
            #axis-print-root .report-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
            #axis-print-root .report-date { font-size:15px; font-weight:700; color:#0f172a; }
            #axis-print-root .report-pilot { font-size:13px; color:#475569; margin-top:3px; }
            #axis-print-root .report-metrics { display:flex; gap:12px; flex-wrap:wrap; }
            #axis-print-root .report-metrics span { font-size:12px; font-weight:600; background:#f1f5f9; padding:2px 10px; border-radius:20px; }
            #axis-print-root .badge-incident { background:#ffedd5 !important; color:#c2410c !important; }
            #axis-print-root .badge-ok { background:#dcfce7 !important; color:#15803d !important; }
            #axis-print-root .section { margin-top:12px; font-size:13px; color:#334155; line-height:1.6; }
            #axis-print-root .ai-report { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
            #axis-print-root .ai-report p { margin-top:6px; color:#475569; }
            #axis-print-root .incident-box { background:#fff7ed; border:1px solid #f97316; border-radius:8px; padding:12px; color:#9a3412; }
            #axis-print-root .footer { margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; text-align:center; }
        </style>
        <div class="page-title">Daily Field Reports</div>
        <div class="page-meta">Mission: ${missionTitle} &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-US',{dateStyle:'long'})} &nbsp;·&nbsp; ${reports.length} report${reports.length!==1?'s':''}</div>
        <div class="summary-bar">
            <div><strong>${totalF}</strong>Total Flights</div>
            <div><strong>${totalB}</strong>Total Blocks</div>
            <div><strong>${totalH.toFixed(1)}h</strong>Total Hours</div>
            <div><strong>${inc}</strong>Incidents</div>
            <div><strong>${reports.length}</strong>Days Reported</div>
        </div>
        ${cards}
        <div class="footer">Axis Drone Platform · Coatza Drone USA · Confidential</div>
    `;
}

// ── Inject into current page and print (bypasses popup blockers) ───────────────
function triggerPrint(reports: FieldReport[], missionTitle: string) {
    const existing = document.getElementById('axis-print-root');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'axis-print-root';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:#fff;z-index:99999;overflow:auto;';
    el.innerHTML = buildPrintHTML(reports, missionTitle);
    document.body.appendChild(el);

    // Show the print div, trigger print, then remove
    el.style.display = 'block';
    window.print();
    el.style.display = 'none';
    // Clean up after a brief delay
    setTimeout(() => el.remove(), 2000);
}

// ── PDF export (same as print — "Save as PDF" in browser dialog) ───────────────
function exportPDF(reports: FieldReport[], missionTitle: string) {
    triggerPrint(reports, missionTitle);
}

// ── Component ──────────────────────────────────────────────────────────────────
const DailyFieldReportsTab: React.FC<Props> = ({ deploymentId, missionTitle = 'Mission' }) => {
    const [reports, setReports] = useState<FieldReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadReports = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get(`/deployments/${deploymentId}/pilot-reports`);
            setReports(res.data.data || []);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally { setLoading(false); }
    };

    const handleDelete = async (reportId: string, reportDate: string, pilotName: string) => {
        if (!confirm(`Delete the report by ${pilotName} on ${fmt(reportDate)}?\n\nThis cannot be undone.`)) return;
        setDeletingId(reportId);
        try {
            await apiClient.delete(`/deployments/${deploymentId}/pilot-reports/${reportId}`);
            setReports(prev => prev.filter(r => r.id !== reportId));
            if (expandedId === reportId) setExpandedId(null);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Delete failed');
        } finally { setDeletingId(null); }
    };

    useEffect(() => { loadReports(); }, [deploymentId]);

    if (loading) return (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading field reports...</span>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center py-16 text-red-400 gap-2 text-sm">
            <AlertTriangle className="w-5 h-5" /><span>{error}</span>
        </div>
    );

    if (reports.length === 0) return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium text-slate-400">No field reports submitted yet</p>
            <p className="text-xs text-slate-500 opacity-60">Pilot daily reports will appear here as they are submitted.</p>
        </div>
    );

    const totalFlights = reports.reduce((s, r) => s + (parseFloat(String(r.missionsFlown)) || 0), 0);
    const totalBlocks  = reports.reduce((s, r) => s + (parseFloat(String(r.blocksCompleted)) || 0), 0);
    const totalHours   = reports.reduce((s, r) => s + (parseFloat(String(r.hoursWorked)) || 0), 0);
    const incidents    = reports.filter(r => r.isIncident).length;

    return (
        <div className="space-y-3">
            {/* Header bar with export actions */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        {reports.length} Report{reports.length !== 1 ? 's' : ''}
                    </p>
                    {/* Summary pills */}
                    <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <span className="bg-slate-800 px-2 py-0.5 rounded-full">✈ {totalFlights} flights</span>
                        <span className="bg-slate-800 px-2 py-0.5 rounded-full">▦ {totalBlocks} blocks</span>
                        <span className="bg-slate-800 px-2 py-0.5 rounded-full">⏱ {totalHours.toFixed(1)}h</span>
                    </div>
                    {incidents > 0 && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-orange-300 bg-orange-900/30 border border-orange-700/50 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            {incidents} Incident{incidents !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                {/* Export buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => exportPDF(reports, missionTitle)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded-lg hover:bg-emerald-900/40 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" /> Export PDF
                    </button>
                    <button
                        onClick={() => triggerPrint(reports, missionTitle)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-300 bg-blue-900/20 border border-blue-700/40 rounded-lg hover:bg-blue-900/40 transition-colors"
                    >
                        <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                </div>
            </div>

            {/* Report cards */}
            {reports.map((report) => {
                const isExpanded = expandedId === report.id;
                return (
                    <div
                        key={report.id}
                        className={`group border rounded-xl overflow-hidden transition-all ${
                            report.isIncident ? 'border-orange-700/50 bg-orange-900/10' : 'border-white/10 bg-slate-800'
                        }`}
                    >
                        {/* Header row */}
                        <div
                            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => setExpandedId(isExpanded ? null : report.id)}
                        >
                            <div className="shrink-0">
                                <p className="text-xs font-bold text-white uppercase tracking-wider">{fmt(report.date)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Submitted {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 px-3 border-l border-white/10">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-sm font-semibold text-slate-200">{report.pilotName}</span>
                            </div>
                            <div className="flex items-center gap-4 flex-1 ml-2">
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Plane className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="font-bold text-white">{report.missionsFlown}</span>
                                    <span className="text-slate-500">flights</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                                    <span className="font-bold text-white">{report.blocksCompleted}</span>
                                    <span className="text-slate-500">blocks</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="font-bold text-white">{report.hoursWorked}h</span>
                                </div>
                                {report.weatherSnapshot && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 border-l border-white/10 pl-4">
                                        <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                                        <span>
                                            {report.weatherSnapshot.tempMin !== undefined
                                                ? `${report.weatherSnapshot.tempMin}–${report.weatherSnapshot.tempMax}°F · ${report.weatherSnapshot.conditions}`
                                                : `${report.weatherSnapshot.temperature}°F · ${report.weatherSnapshot.conditions}`
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>
                            {report.isIncident && (
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${incidentBadge(report.incidentSeverity)}`}>
                                    ⚠ {report.incidentSeverity}
                                </span>
                            )}
                            <div className="ml-auto flex items-center gap-2">
                                {/* Delete button — visible on hover */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(report.id, report.date, report.pilotName); }}
                                    disabled={deletingId === report.id}
                                    title="Delete report"
                                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-all border border-transparent hover:border-red-700/40"
                                >
                                    {deletingId === report.id
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <Trash2 className="w-3 h-3" />}
                                </button>
                                <div className="shrink-0 text-slate-500">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                            </div>
                        </div>

                        {/* Expanded body */}
                        {isExpanded && (
                            <div className="border-t border-white/10 px-5 py-5 space-y-5 bg-slate-900/60">
                                {report.aiReport && (
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                            AI Field Report
                                        </p>
                                        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-slate-800 border border-white/10 rounded-lg p-4">
                                            {report.aiReport}
                                        </div>
                                    </div>
                                )}
                                {(report.weatherSnapshot || report.irradianceSnapshot) && (
                                    <div className="grid grid-cols-2 gap-3">
                                        {report.weatherSnapshot && (
                                            <div className="bg-slate-800 border border-white/10 rounded-lg p-4 space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Weather (Full Day)</p>
                                                {report.weatherSnapshot.tempMin !== undefined ? (
                                                    <>
                                                        <div className="flex items-center gap-2 text-sm text-slate-300"><Thermometer className="w-3.5 h-3.5 text-red-400" /><span>{report.weatherSnapshot.tempMin}°F – {report.weatherSnapshot.tempMax}°F</span></div>
                                                        <div className="flex items-center gap-2 text-sm text-slate-300"><Wind className="w-3.5 h-3.5 text-blue-400" /><span>Avg {report.weatherSnapshot.avgWindSpeed} mph</span></div>
                                                        <div className="flex items-center gap-2 text-sm text-slate-300"><CloudSun className="w-3.5 h-3.5 text-amber-400" /><span>{report.weatherSnapshot.conditions}</span></div>
                                                        {report.weatherSnapshot.hourlyConditions && <div className="text-xs text-slate-500 pt-1 border-t border-white/10">{report.weatherSnapshot.hourlyConditions}</div>}
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2 text-sm text-slate-300"><Thermometer className="w-3.5 h-3.5 text-red-400" /><span>{report.weatherSnapshot.temperature}°F</span></div>
                                                        <div className="flex items-center gap-2 text-sm text-slate-300"><Wind className="w-3.5 h-3.5 text-blue-400" /><span>{report.weatherSnapshot.wind_speed} mph</span></div>
                                                        <div className="flex items-center gap-2 text-sm text-slate-300"><CloudSun className="w-3.5 h-3.5 text-amber-400" /><span>{report.weatherSnapshot.conditions}</span></div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {report.irradianceSnapshot && (
                                            <div className="bg-slate-800 border border-white/10 rounded-lg p-4 space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Solar Irradiance</p>
                                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                                    <Sun className="w-3.5 h-3.5 text-yellow-400" />
                                                    <span>
                                                        {report.irradianceSnapshot.peakGhi_wm2 != null
                                                            ? `Peak ${report.irradianceSnapshot.peakGhi_wm2} W/m² · Avg ${report.irradianceSnapshot.avgGhi_wm2 ?? 'N/A'} W/m²`
                                                            : report.irradianceSnapshot.ghi_wm2 != null
                                                            ? `${report.irradianceSnapshot.ghi_wm2} W/m² GHI` : 'N/A'}
                                                    </span>
                                                </div>
                                                {report.irradianceSnapshot.totalEnergy_wh != null && (
                                                    <div className="text-xs text-slate-500">~{report.irradianceSnapshot.totalEnergy_wh} Wh/m² total</div>
                                                )}
                                                <p className="text-xs text-slate-500">{report.irradianceSnapshot.description}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {report.isIncident && report.incidentSummary && (
                                    <div className={`rounded-lg p-4 border ${incidentBadge(report.incidentSeverity)}`}>
                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1.5">Incident Report — {report.incidentSeverity?.toUpperCase()}</p>
                                        <p className="text-sm">{report.incidentSummary}</p>
                                    </div>
                                )}
                                {report.issuesEncountered && !report.isIncident && (
                                    <div className="bg-slate-800 border border-white/10 rounded-lg p-4">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Issues Encountered</p>
                                        <p className="text-sm text-slate-300">{report.issuesEncountered}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default DailyFieldReportsTab;
